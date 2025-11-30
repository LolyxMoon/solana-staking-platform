import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { StakingProgram } from "../target/types/staking_program";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const program = anchor.workspace.StakingProgram as Program<StakingProgram>;
  
  // Your pool's pool_id
  const poolId = new anchor.BN(1); // Change if different
  const tokenMint = new PublicKey("So11111111111111111111111111111111111111112"); // Native SOL
  
  const [projectPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("project"), tokenMint.toBuffer(), poolId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );
  
  console.log("Pool PDA:", projectPda.toString());
  
  const projectData = await program.account.project.fetch(projectPda);
  console.log("\nCurrent state:");
  console.log("- last_reflection_balance:", projectData.lastReflectionBalance.toString());
  console.log("- reflection_per_token_stored:", projectData.reflectionPerTokenStored.toString());
  
  // Call update_pool_reflection to reset the balance
  console.log("\nResetting reflection state...");
  
  const tx = await program.methods
    .updatePoolReflection(tokenMint, poolId)
    .accounts({
      admin: provider.wallet.publicKey,
    })
    .rpc();
    
  console.log("✅ Reset transaction:", tx);
}

main();
