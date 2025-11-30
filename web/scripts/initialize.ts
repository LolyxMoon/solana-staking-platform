import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("BK7fM9EC2kYVSwc1H9MNia6ZZRo6ALP1YLgYaWmMR49W");
const ADMIN_WALLET = new PublicKey("ecfvkqWdJiYJRyUtWvuYpPWP5faf9GBcA1K6TaDW7wS");
const RPC = "https://api.devnet.solana.com";

async function initialize() {
  // Read IDL
  const idl = JSON.parse(fs.readFileSync("./lib/solana_staking_platform.json", "utf-8"));
  
  // Read keypair
  const keypairPath = process.env.KEYPAIR_PATH || "./keypair.json";
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  
  const connection = new Connection(RPC, "confirmed");
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {});
  
  const program = new Program(idl as any, provider);
  
  // Get platform config PDA
  const [platformConfigPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform_config")],
    PROGRAM_ID
  );
  
  console.log("Initializing platform...");
  console.log("Platform Config PDA:", platformConfigPDA.toString());
  console.log("Admin Wallet:", ADMIN_WALLET.toString());
  
  try {
    const tx = await program.methods
      .initializePlatform(ADMIN_WALLET)
      .accounts({
        platformConfig: platformConfigPDA,
        authority: keypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log("✅ Platform initialized!");
    console.log("Transaction:", tx);
  } catch (error) {
    console.error("Error:", error);
  }
}

initialize();
