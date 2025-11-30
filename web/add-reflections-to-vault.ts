import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { 
  getAssociatedTokenAddress, 
  TOKEN_PROGRAM_ID,
  createTransferInstruction
} from "@solana/spl-token";
import fs from "fs";

const TOKEN_B = new PublicKey("HCU61GCHAFjGtJcdeBCdCF6bvAmTLpdWQMGK2cfVpYZw");
const REFLECTION_ACCOUNT = new PublicKey("32LnFBRBgvRWfpJ8wE91DEaEiQPLqhMpyYuHhG751nWM");

async function addReflectionsToVault() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const wallet = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  console.log("Adding Reflection Tokens to Vault");
  console.log("Wallet:", wallet.publicKey.toString());

  try {
    const yourTokenAccount = await getAssociatedTokenAddress(TOKEN_B, wallet.publicKey);
    const balance = await connection.getTokenAccountBalance(yourTokenAccount);
    console.log("Your Token B Balance:", balance.value.uiAmount);

    if (!balance.value.uiAmount || balance.value.uiAmount === 0) {
      console.error("No Token B to send!");
      return;
    }

    const amountToSend = 100 * 1e9;
    console.log("Sending 100 Token B to reflection vault...");

    const transferIx = createTransferInstruction(
      yourTokenAccount,
      REFLECTION_ACCOUNT,
      wallet.publicKey,
      amountToSend,
      [],
      TOKEN_PROGRAM_ID
    );

    const transaction = new anchor.web3.Transaction().add(transferIx);
    const signature = await anchor.web3.sendAndConfirmTransaction(connection, transaction, [wallet]);

    console.log("Success!");
    console.log("TX:", signature);

    const reflectionBalance = await connection.getTokenAccountBalance(REFLECTION_ACCOUNT);
    console.log("Reflection Vault Balance:", reflectionBalance.value.uiAmount);

  } catch (error) {
    console.error("Error:", error);
  }
}

addReflectionsToVault().catch(console.error);
