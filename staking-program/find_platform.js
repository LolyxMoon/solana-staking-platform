const anchor = require("@coral-xyz/anchor");
const programId = new anchor.web3.PublicKey("FgU9q7ucXm3JCFY8ByT7RrCtCJAHBGjA2rxjaqZkaDBV");
const [platformPda, bump] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("platform_v2")],
  programId
);
console.log("Platform PDA:", platformPda.toString());
