const anchor = require("@coral-xyz/anchor");
const { Connection, PublicKey } = require("@solana/web3.js");
const fs = require("fs");

async function checkAdmin() {
  const idl = JSON.parse(fs.readFileSync("./target/idl/staking_program.json", "utf-8"));
  const connection = new Connection("https://api.devnet.solana.com");
  const programId = new PublicKey("FgU9q7ucXm3JCFY8ByT7RrCtCJAHBGjA2rxjaqZkaDBV");
  const program = new anchor.Program(idl, programId, { connection });
  const [platformPDA] = PublicKey.findProgramAddressSync([Buffer.from("platform_v2")], programId);
  
  const platform = await program.account.platform.fetch(platformPDA);
  console.log("Platform Admin:", platform.admin.toString());
  console.log("Fee Collector:", platform.feeCollector.toString());
  console.log("\nYour wallet:", "9zS3TWXEWQnYU2xFSMB7wvv7JuBJpcPtxw9kaf1STzvR");
}

checkAdmin();
