import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";

async function main() {
  // Setup
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load your deploy wallet
  const keypairFile = fs.readFileSync(
    "/home/shaunking1988/.config/solana/id.json",
    "utf-8"
  );
  const keypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(keypairFile))
  );
  
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  
  // Load lottery IDL from file
  const lotteryIdl = JSON.parse(
    fs.readFileSync("./lib/lottery.json", "utf-8")
  );
  
  // Load lottery program
  const program = new Program(lotteryIdl as any, provider);
  
  // Your admin wallet (for calling admin functions later)
  const adminWallet = new PublicKey("9zS3TWXEWQnYU2xFSMB7wvv7JuBJpcPtxw9kaf1STzvR");
  
  console.log("Lottery Program ID:", program.programId.toString());
  console.log("Deploy wallet:", wallet.publicKey.toString());
  console.log("Admin wallet:", adminWallet.toString());
  
  // Derive PDAs
  const [lotteryState] = PublicKey.findProgramAddressSync(
    [Buffer.from("lottery_state")],
    program.programId
  );
  
  const [prizeVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("prize_vault")],
    program.programId
  );
  
  console.log("Lottery State PDA:", lotteryState.toString());
  console.log("Prize Vault PDA:", prizeVault.toString());
  
  try {
    // Initialize the lottery with admin wallet
    const tx = await program.methods
      .initialize(adminWallet)
      .accounts({
        lotteryState: lotteryState,
        prizeVault: prizeVault,
        admin: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    
    console.log("✅ Lottery initialized!");
    console.log("Transaction signature:", tx);
    console.log("Admin set to:", adminWallet.toString());
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
