import { Connection, PublicKey } from "@solana/web3.js";

const REFLECTION_ACCOUNT = new PublicKey("32LnFBRBgvRWfpJ8wE91DEaEiQPLqhMpyYuHhG751nWM");
const TOKEN_A = new PublicKey("9sG4nh2q1sUC38qwrK1fiXbzhDLuroyPMNw3UmBprtYX");
const TOKEN_B = new PublicKey("HCU61GCHAFjGtJcdeBCdCF6bvAmTLpdWQMGK2cfVpYZw");

async function checkReflectionAccount() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  console.log("🔍 Checking Reflection Account Info\n");
  
  try {
    const accountInfo = await connection.getParsedAccountInfo(REFLECTION_ACCOUNT);
    const data = accountInfo.value.data;
    
    if ('parsed' in data) {
      console.log("Mint:", data.parsed.info.mint);
      console.log("Balance:", data.parsed.info.tokenAmount.uiAmount);
      
      if (data.parsed.info.mint === TOKEN_B.toString()) {
        console.log("\n✅ This is Token B (Reward Token)");
        console.log("💡 Send Token B, not Token A!");
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

checkReflectionAccount();
