import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("gLHaGJsZ6G7AXZxoDL9EsSWkRbKAWhFHi73gVfNXuzK");
const NEW_FEE_COLLECTOR = new PublicKey("ecfvkqWdJiYJRyUtWvuYpPWP5faf9GBcA1K6TaDW7wS");
const RPC = "https://api.devnet.solana.com";

async function updateFeeCollector() {
  // Read IDL
  const idl = JSON.parse(fs.readFileSync("./target/idl/staking_program.json", "utf-8"));
  
  // Read keypair (admin wallet)
  const keypairPath = process.env.KEYPAIR_PATH || "/home/shaunking1988/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  
  const connection = new Connection(RPC, "confirmed");
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {});
  
  const program = new Program(idl as any, provider);
  
  // Get platform PDA
  const [platformPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform_v2")],
    PROGRAM_ID
  );
  
  console.log("Updating fee collector...");
  console.log("Platform PDA:", platformPDA.toString());
  console.log("Admin:", keypair.publicKey.toString());
  console.log("New Fee Collector:", NEW_FEE_COLLECTOR.toString());
  
  try {
    // Fetch current config
    const platform = await program.account.platform.fetch(platformPDA);
    console.log("\n📋 Current Platform Config:");
    console.log("- Current Fee Collector:", platform.feeCollector.toString());
    
    // Update fee collector
    const tx = await program.methods
      .updateFeeCollector(NEW_FEE_COLLECTOR)
      .accounts({
        platform: platformPDA,
        admin: keypair.publicKey,
      })
      .rpc();
    
    console.log("\n✅ Fee collector updated!");
    console.log("Transaction:", tx);
    
    // Verify
    const updatedPlatform = await program.account.platform.fetch(platformPDA);
    console.log("\n✅ New Fee Collector:", updatedPlatform.feeCollector.toString());
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

updateFeeCollector();