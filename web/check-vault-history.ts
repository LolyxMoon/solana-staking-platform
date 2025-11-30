import { Connection, PublicKey } from "@solana/web3.js";

const REFLECTION_ACCOUNT = new PublicKey("32LnFBRBgvRWfpJ8wE91DEaEiQPLqhMpyYuHhG751nWM");

async function checkVaultHistory() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  console.log("📜 Checking Reflection Vault Transaction History\n");
  console.log("Vault:", REFLECTION_ACCOUNT.toString());
  
  try {
    const signatures = await connection.getSignaturesForAddress(REFLECTION_ACCOUNT, { limit: 10 });
    
    console.log(`\nFound ${signatures.length} transactions:\n`);
    
    for (const sig of signatures) {
      console.log("─────────────────────────────────────");
      console.log("Signature:", sig.signature);
      console.log("Block Time:", new Date(sig.blockTime! * 1000).toISOString());
      console.log("Status:", sig.err ? "❌ Failed" : "✅ Success");
      console.log("Explorer:", `https://explorer.solana.com/tx/${sig.signature}?cluster=devnet`);
    }
    
    // Get current balance
    const balance = await connection.getTokenAccountBalance(REFLECTION_ACCOUNT);
    console.log("\n─────────────────────────────────────");
    console.log("Current Balance:", balance.value.uiAmount);
    
  } catch (error) {
    console.error("Error:", error);
  }
}

checkVaultHistory();
