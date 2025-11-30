import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { getProgram, getPDAs } from "./anchor-program";

/**
 * Calculate the REAL APY from on-chain data
 * This cannot be faked - it's based on actual deposited rewards
 */
export async function calculateRealAPY(
  connection: Connection,
  wallet: AnchorWallet | undefined,
  tokenMint: string,
  poolId: number = 0
): Promise<{
  realAPY: number;
  totalRewardsDeposited: number;
  totalRewardsClaimed: number;
  availableRewards: number;
  vaultBalance: number; // ✅ ADD THIS LINE
  totalStaked: number;
  rewardRate: number;
}> {
  try {
    if (!wallet) {
      throw new Error("Wallet not connected");
    }

    const tokenMintPubkey = new PublicKey(tokenMint);
    const [projectPDA] = getPDAs.project(tokenMintPubkey, poolId);
    
    // Fetch on-chain project data
    const program = getProgram(wallet, connection);
    const projectData = await program.account.project.fetch(projectPDA);
    
    // ✅ ADD THIS ENTIRE SECTION - Fetch ACTUAL vault balance from blockchain
    const [rewardVaultPDA] = getPDAs.rewardVault(tokenMintPubkey, poolId);
    let vaultBalance = 0;

    try {
      const vaultAccountInfo = await connection.getTokenAccountBalance(rewardVaultPDA);
      vaultBalance = parseFloat(vaultAccountInfo.value.amount) / Math.pow(10, vaultAccountInfo.value.decimals);
      console.log("✅ Fetched actual vault balance:", vaultBalance);
    } catch (error) {
      console.error("⚠️ Could not fetch vault balance, using calculated value:", error);
      // Fallback to calculated if fetch fails
    }
    
    // ✅ FIX: Get token decimals to convert raw amounts to UI amounts
    const mintInfo = await connection.getParsedAccountInfo(tokenMintPubkey);
    const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;
    const divisor = Math.pow(10, decimals);
    
    // Convert raw amounts to UI amounts
    const totalRewardsDeposited = projectData.totalRewardsDeposited.toNumber() / divisor;
    const totalRewardsClaimed = projectData.totalRewardsClaimed.toNumber() / divisor;
    const totalStaked = projectData.totalStaked.toNumber() / divisor;
    const poolDurationSeconds = projectData.poolDurationSeconds.toNumber();
    const rewardRate = (projectData.rewardRatePerSecond?.toNumber() || 0) / divisor;
    
    // ✅ CHANGED - Use actual vault balance (accounts for transfer tax)
    // Fallback to calculated value if vault fetch failed
    const availableRewards = vaultBalance > 0 ? vaultBalance : (totalRewardsDeposited - totalRewardsClaimed);
    
    console.log("📊 APY Calculation (using actual vault balance):", {
      vaultBalance,
      totalRewardsDeposited,
      totalRewardsClaimed,
      calculatedAvailable: totalRewardsDeposited - totalRewardsClaimed,
      actualAvailable: availableRewards,
      difference: vaultBalance - (totalRewardsDeposited - totalRewardsClaimed)
    });
    
    // If no staking yet or no rewards, APY is 0
    if (totalStaked === 0 || availableRewards === 0) {
      return {
        realAPY: 0,
        totalRewardsDeposited,
        totalRewardsClaimed,
        availableRewards,
        vaultBalance, // ✅ ADDED
        totalStaked,
        rewardRate,
      };
    }
    
    // Calculate real APY based on available rewards
    const durationYears = poolDurationSeconds / (365 * 24 * 60 * 60);
    const realAPY = (availableRewards / totalStaked / durationYears) * 100;
    
    return {
      realAPY: Math.max(0, realAPY), // Ensure non-negative
      totalRewardsDeposited,
      totalRewardsClaimed,
      availableRewards,
      vaultBalance: 0,

      totalStaked,
      rewardRate,
    };
    
  } catch (error) {
    console.error("Error calculating real APY:", error);
    return {
      realAPY: 0,
      totalRewardsDeposited: 0,
      totalRewardsClaimed: 0,
      availableRewards: 0,
      totalStaked: 0,
      rewardRate: 0,
    };
  }
}

/**
 * Calculate estimated APY based on planned reward deposit
 * This is used during pool creation to show what APY they'll achieve
 */
export function calculateEstimatedAPY(
  rewardAmount: number,
  expectedTotalStaked: number,
  durationDays: number
): number {
  if (expectedTotalStaked === 0 || rewardAmount === 0 || durationDays === 0) {
    return 0;
  }
  
  const durationYears = durationDays / 365;
  const estimatedAPY = (rewardAmount / expectedTotalStaked / durationYears) * 100;
  
  return Math.max(0, estimatedAPY);
}

/**
 * Calculate required rewards to achieve target APY
 */
export function calculateRequiredRewards(
  targetAPY: number,
  expectedTotalStaked: number,
  durationDays: number
): number {
  if (expectedTotalStaked === 0 || durationDays === 0) {
    return 0;
  }
  
  const durationYears = durationDays / 365;
  const requiredRewards = (targetAPY / 100) * expectedTotalStaked * durationYears;
  
  return Math.max(0, requiredRewards);
}

/**
 * Fetch current pool statistics from chain
 */
export async function getPoolStatistics(
  connection: Connection,
  wallet: AnchorWallet | undefined,
  tokenMint: string,
  poolId: number = 0
) {
  try {
    if (!wallet) {
      throw new Error("Wallet not connected");
    }

    const tokenMintPubkey = new PublicKey(tokenMint);
    const [projectPDA] = getPDAs.project(tokenMintPubkey, poolId);
    
    const program = getProgram(wallet, connection);
    const projectData = await program.account.project.fetch(projectPDA);
    
    // ✅ FIX: Get token decimals for proper conversion
    const mintInfo = await connection.getParsedAccountInfo(tokenMintPubkey);
    const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;
    const divisor = Math.pow(10, decimals);
    
    return {
      isInitialized: projectData.isInitialized,
      isPaused: projectData.isPaused,
      totalStaked: projectData.totalStaked.toNumber() / divisor,
      totalRewardsDeposited: projectData.totalRewardsDeposited.toNumber() / divisor,
      totalRewardsClaimed: projectData.totalRewardsClaimed.toNumber() / divisor,
      poolDurationSeconds: projectData.poolDurationSeconds.toNumber(),
      lockupSeconds: projectData.lockupSeconds.toNumber(),
      rateBpsPerYear: projectData.rateBpsPerYear.toNumber(),
      poolStartTime: projectData.poolStartTime.toNumber(),
      poolEndTime: projectData.poolEndTime.toNumber(),
    };
  } catch (error) {
    console.error("Error fetching pool statistics:", error);
    return null;
  }
}