// fetch-idl.js
const { Connection, PublicKey } = require("@solana/web3.js");
const fs = require("fs");

const PROGRAM_ID = "EkXfrxgj3AQd3ejggAedo72wEiVd9hqt2pdqfjTvZvv1";
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function fetchIdl() {
  try {
    const programId = new PublicKey(PROGRAM_ID);
    
    // Get the IDL account (it's stored at a PDA)
    const [idlAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("anchor:idl"), programId.toBuffer()],
      programId
    );

    console.log("Fetching IDL from:", idlAddress.toString());
    
    const accountInfo = await connection.getAccountInfo(idlAddress);
    
    if (!accountInfo) {
      console.error("❌ No IDL found on-chain. The program might not have been deployed with Anchor.");
      process.exit(1);
    }

    // Parse the IDL (skip first 8 bytes which are the discriminator)
    const idlData = accountInfo.data.slice(8);
    const idl = JSON.parse(idlData.toString());
    
    // Save to file
    fs.writeFileSync("./lib/staking.json", JSON.stringify(idl, null, 2));
    console.log("✅ IDL saved to ./lib/staking.json");
    console.log("IDL name:", idl.name);
    console.log("Instructions:", idl.instructions?.length || 0);
  } catch (error) {
    console.error("❌ Error fetching IDL:", error.message);
  }
}

fetchIdl();