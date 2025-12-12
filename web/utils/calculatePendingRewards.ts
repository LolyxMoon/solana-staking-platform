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
    
    const totalStaked = BigInt(project.totalStaked.toString());
    const lastUpdateTime = stake.lastClaimTime?.toNumber() || stake.lastStakeTimestamp?.toNumber() || project.lastUpdateTime.toNumber();
    const poolEndTime = project.poolEndTime.toNumber();
    
    const stakeAmount = BigInt(stake.amount.toString());
    const rewardsPending = BigInt(stake.rewardsPending.toString());
    
    // ✅ Get rate mode (0 = Fixed APY, 1 = Variable)
    const rateMode = project.rateMode ?? 1;  // Default to variable if not set
    const rateBpsPerYear = BigInt(project.rateBpsPerYear?.toString() || '0');
    const rewardRatePerSecond = BigInt(project.rewardRatePerSecond?.toString() || '0');

    console.log("🔍 Calculation Input:", {
      rateMode,
      rateBpsPerYear: rateBpsPerYear.toString(),
      rewardRatePerSecond: rewardRatePerSecond.toString(),
      totalStaked_tokens: Number(totalStaked) / Math.pow(10, decimals),
      stakeAmount_tokens: Number(stakeAmount) / Math.pow(10, decimals),
      timeSinceLastUpdate: currentTime - lastUpdateTime,
      currentTime: new Date().toISOString(),
    });

    // Calculate effective time (stop at pool end time)
    if (currentTime <= lastUpdateTime) {
      return Number(rewardsPending) / Math.pow(10, decimals);
    }

    const timeDelta = currentTime - lastUpdateTime;
    const effectiveTime = currentTime > poolEndTime 
      ? Math.max(0, poolEndTime - lastUpdateTime)
      : timeDelta;
    
    if (effectiveTime <= 0) {
      return Number(rewardsPending) / Math.pow(10, decimals);
    }

    let earnedLamports: bigint;

    if (rateMode === 0) {
      // ✅ FIXED APY MODE
      // Formula: (stakeAmount × rateBpsPerYear × effectiveTime) / (10000 × 31536000)
      // This gives: stake × (APY/100) × (time/year) = earned
      const SECONDS_PER_YEAR = 31536000n;
      const BPS_DIVISOR = 10000n;
      
      const numerator = stakeAmount * rateBpsPerYear * BigInt(effectiveTime);
      earnedLamports = numerator / (BPS_DIVISOR * SECONDS_PER_YEAR);
      
      console.log("🔍 Fixed APY Calculation:", {
        formula: "(stake × rateBps × time) / (10000 × 31536000)",
        stakeAmount: stakeAmount.toString(),
        rateBpsPerYear: rateBpsPerYear.toString(),
        effectiveTime,
        earnedLamports: earnedLamports.toString(),
      });
      
    } else {
      // ✅ VARIABLE/DYNAMIC MODE
      // Formula: (stakeAmount × rewardRatePerSecond × effectiveTime) / totalStaked
      // User gets proportional share of pool emissions
      
      if (totalStaked === 0n) {
        return Number(rewardsPending) / Math.pow(10, decimals);
      }
      
      const numerator = stakeAmount * rewardRatePerSecond * BigInt(effectiveTime);
      earnedLamports = numerator / totalStaked;
      
      console.log("🔍 Variable Mode Calculation:", {
        formula: "(stake × rate × time) / totalStaked",
        numerator: numerator.toString(),
        earnedLamports: earnedLamports.toString(),
      });
    }
    
    // Total pending = previously pending + newly earned
    const totalPendingLamports = rewardsPending + earnedLamports;
    const totalPending = Number(totalPendingLamports) / Math.pow(10, decimals);

    console.log("🔍 Reward Calculation:", {
      effectiveTime,
      earnedLamports: earnedLamports.toString(),
      earnedTokens: Number(earnedLamports) / Math.pow(10, decimals),
      rewardsPending_tokens: Number(rewardsPending) / Math.pow(10, decimals),
      totalPending_tokens: totalPending,
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

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [project, stake]);

  return rewards;
}