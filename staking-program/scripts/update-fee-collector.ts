// @ts-nocheck
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("FgU9q7ucXm3JCFY8ByT7RrCtCJAHBGjA2rxjaqZkaDBV");
const NEW_FEE_COLLECTOR = new PublicKey("66oZ17EyWhmRXPYpuVpoojvmaz3AZWAaewekTWqJFhfB");
const RPC = "https://api.devnet.solana.com";

async function updateFeeCollector() {
  const idl = JSON.parse(fs.readFileSync("./target/idl/staking_program.json", "utf-8"));
  const keypairPath = "/home/shaunking1988/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  const connection = new Connection(RPC, "confirmed");
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {});
  const program = new Program(idl as any, provider);
  const [platformPDA] = PublicKey.findProgramAddressSync([Buffer.from("platform_v2")], PROGRAM_ID);
  console.log("Updating fee collector...");
  console.log("Platform PDA:", platformPDA.toString());
  console.log("New Fee Collector:", NEW_FEE_COLLECTOR.toString());
  try {
    const platform = await program.account.platform.fetch(platformPDA);
    console.log("\nCurrent Fee Collector:", platform.feeCollector.toString());
    const tx = await program.methods.updateFeeCollector(NEW_FEE_COLLECTOR).accounts({platform: platformPDA, admin: keypair.publicKey}).rpc();
    console.log("\n✅ Updated! Transaction:", tx);
    const updated = await program.account.platform.fetch(platformPDA);
    console.log("✅ New Fee Collector:", updated.feeCollector.toString());
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

updateFeeCollector();
