import { useState, useEffect } from 'react';
import BN from 'bn.js';

export function calculatePendingRewards(
  project: any,
  stake: any,
  decimals: number = 9
): number {
  try {
    // If user has no stake, no rewards
    if (!stake || !stake.amount || stake.amount.toString() === '0') {
      return 0;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    
    // ✅ Use BigInt for large numbers to avoid precision loss
    const rewardRatePerSecond = BigInt(project.rewardRatePerSecond.toString());
    const totalStaked = BigInt(project.totalStaked.toString());
    const lastUpdateTime = project.lastUpdateTime.toNumber();
    const poolEndTime = project.poolEndTime.toNumber();
    
    const stakeAmount = BigInt(stake.amount.toString());
    const rewardsPending = BigInt(stake.rewardsPending.toString());

    console.log("🔍 Calculation Input:", {
      rewardRatePerSecond: rewardRatePerSecond.toString(),
      totalStaked_tokens: Number(totalStaked) / Math.pow(10, decimals),
      stakeAmount_tokens: Number(stakeAmount) / Math.pow(10, decimals),
      timeSinceLastUpdate: currentTime - lastUpdateTime,
      currentTime: new Date().toISOString(),
    });

    // Calculate effective time (stop at pool end time)
    if (currentTime <= lastUpdateTime || totalStaked === 0n) {
      return Number(rewardsPending) / Math.pow(10, decimals);
    }

    const timeDelta = currentTime - lastUpdateTime;
    const effectiveTime = currentTime > poolEndTime 
      ? Math.max(0, poolEndTime - lastUpdateTime)
      : timeDelta;
    
    if (effectiveTime <= 0) {
      return Number(rewardsPending) / Math.pow(10, decimals);
    }

    // Formula: (stakeAmount × rewardRatePerSecond × effectiveTime) / totalStaked
    //
    // Breaking it down:
    // - rewardRatePerSecond is in lamports/second for the ENTIRE POOL
    // - multiply by effectiveTime (seconds) = total pool distribution
    // - multiply by stakeAmount (user's lamports staked)
    // - divide by totalStaked = user's proportional share
    //
    // This gives us: (user_stake / total_staked) × pool_rate × time = user's lamports earned
    
    const numerator = stakeAmount * rewardRatePerSecond * BigInt(effectiveTime);
    const earnedLamports = numerator / totalStaked; // Divide by totalStaked for proportional share
    
    // Total pending = previously pending + newly earned
    const totalPendingLamports = rewardsPending + earnedLamports;
    const totalPending = Number(totalPendingLamports) / Math.pow(10, decimals);

    console.log("🔍 Reward Calculation:", {
      effectiveTime,
      numerator: numerator.toString(),
      earnedLamports: earnedLamports.toString(),
      earnedTokens: Number(earnedLamports) / Math.pow(10, decimals),
      rewardsPending_tokens: Number(rewardsPending) / Math.pow(10, decimals),
      totalPending_tokens: totalPending,
      perSecondRate: Number(earnedLamports) / effectiveTime / Math.pow(10, decimals),
    });
    
    return totalPending;
    
  } catch (error) {
    console.error("Error calculating pending rewards:", error);
    return 0;
  }
}

export function formatRewards(rewards: number): string {
  if (rewards === 0) return "0";
  if (rewards < 0.000001) return "< 0.000001";
  if (rewards < 1) return rewards.toFixed(6);
  if (rewards < 1000) return rewards.toFixed(4);
  return rewards.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function useRealtimeRewards(
  project: any,
  stake: any,
  decimals: number = 9
): number {
  const [rewards, setRewards] = useState(0);

  useEffect(() => {
    if (!project || !stake) return;

    const calculate = () => {
      const pending = calculatePendingRewards(project, stake, decimals);
      setRewards(pending);
      console.log("🔄 UI Update:", { timestamp: new Date().toISOString(), pending });
    };

    // Calculate immediately
    calculate();

    // Update every 1 second for smooth real-time display
    const interval = setInterval(calculate, 1000);

    return () => clearInterval(interval);
  }, [project, stake]);

  return rewards;
}