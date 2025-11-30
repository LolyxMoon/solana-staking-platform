import { PublicKey } from "@solana/web3.js";

/**
 * PROGRAM ID CONFIGURATION
 * 
 * IMPORTANT: Update this after deploying your contract!
 * 
 * Steps:
 * 1. Deploy: `anchor deploy`
 * 2. Copy the Program ID from the deployment output
 * 3. Replace "PLACEHOLDER_PROGRAM_ID" below with your actual Program ID
 * 4. Update lib.rs: declare_id!("YOUR_PROGRAM_ID");
 * 5. Rebuild: `anchor build`
 * 6. Redeploy: `anchor deploy`
 */

// ⚠️ REPLACE THIS WITH YOUR DEPLOYED PROGRAM ID
export const PROGRAM_ID_STRING = "PLACEHOLDER_PROGRAM_ID";

// PublicKey instance for use in transactions
export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);

/**
 * Network Configuration
 */
export const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";

export const RPC_ENDPOINT = 
  NETWORK === "mainnet-beta"
    ? process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET || "https://api.mainnet-beta.solana.com"
    : process.env.NEXT_PUBLIC_SOLANA_RPC_DEVNET || "https://api.devnet.solana.com";

/**
 * PDA Seed Constants
 * These must match your Rust program exactly
 */
export const SEEDS = {
  PLATFORM_CONFIG: "platform_config",
  PROJECT: "project",
  STAKING_VAULT: "staking_vault",
  REWARD_VAULT: "reward_vault",
  REFLECTION_VAULT: "reflection_vault",
  USER_STAKE: "user_stake",
} as const;

/**
 * Helper function to derive Platform Config PDA
 */
export function getPlatformConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.PLATFORM_CONFIG)],
    PROGRAM_ID
  );
}

/**
 * Helper function to derive Project PDA
 * @param tokenMint - The token mint public key
 */
export function getProjectPDA(tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.PROJECT), tokenMint.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Helper function to derive Staking Vault PDA
 * @param projectPDA - The project PDA
 */
export function getStakingVaultPDA(projectPDA: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.STAKING_VAULT), projectPDA.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Helper function to derive Reward Vault PDA
 * @param projectPDA - The project PDA
 */
export function getRewardVaultPDA(projectPDA: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.REWARD_VAULT), projectPDA.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Helper function to derive Reflection Vault PDA
 * @param projectPDA - The project PDA
 */
export function getReflectionVaultPDA(projectPDA: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.REFLECTION_VAULT), projectPDA.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Helper function to derive User Stake PDA
 * @param projectPDA - The project PDA
 * @param userWallet - The user's wallet public key
 */
export function getUserStakePDA(projectPDA: PublicKey, userWallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.USER_STAKE), projectPDA.toBuffer(), userWallet.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Validation helper
 */
export function isProgramIdConfigured(): boolean {
  return PROGRAM_ID_STRING !== "PLACEHOLDER_PROGRAM_ID";
}

/**
 * Throws error if Program ID is not configured
 */
export function assertProgramIdConfigured(): void {
  if (!isProgramIdConfigured()) {
    throw new Error(
      "Program ID not configured! Please deploy your contract and update PROGRAM_ID_STRING in programId.ts"
    );
  }
}