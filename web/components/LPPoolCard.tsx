"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Lock, Unlock, Coins } from "lucide-react";
import { useStakingProgram } from "@/hooks/useStakingProgram";
import ManageLiquidityModal from "./ManageLiquidityModal";
import { getDexInfo } from "@/lib/liquidity-router";
import { useRealtimeRewards, formatRewards } from "@/utils/calculatePendingRewards";

type LPPool = {
  id: string;
  poolId: number;
  tokenMint: string;
  name: string;
  symbol: string;
  type: "locked" | "unlocked";
  lockPeriod?: number | null;
  apr?: number | null;
  apy?: number | null;
  totalStaked: number;
  rewards?: string | null;
  logo?: string | null;
  featured?: boolean;
  rewardTokenMint?: string | null;
  rewardTokenSymbol?: string | null;
  raydiumPoolAddress?: string | null;
  dexType?: string | null;
  dexPoolAddress?: string | null;
};

export default function LPPoolCard({ pool }: { pool: LPPool }) {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { getPoolRate, getUserStake, getProjectInfo } = useStakingProgram();
  
  const [dynamicRate, setDynamicRate] = useState<number | null>(null);
  const [projectData, setProjectData] = useState<any>(null);
  const [stakeData, setStakeData] = useState<any>(null);
  const [onChainTotalStaked, setOnChainTotalStaked] = useState<number>(0);
  const [tokenDecimals, setTokenDecimals] = useState<number>(9);
  const [showLiquidityModal, setShowLiquidityModal] = useState(false);

  const decimalsMultiplier = useMemo(() => Math.pow(10, tokenDecimals), [tokenDecimals]);

  // Fetch token decimals
  useEffect(() => {
    if (!pool.tokenMint || !connection) return;
    
    const fetchDecimals = async () => {
      try {
        const mintInfo = await connection.getParsedAccountInfo(new PublicKey(pool.tokenMint));
        const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;
        setTokenDecimals(decimals);
      } catch (error) {
        console.error("Error fetching decimals:", error);
        setTokenDecimals(9);
      }
    };
    
    fetchDecimals();
  }, [pool.tokenMint, connection]);

  // Fetch user stake and project data
  useEffect(() => {
    if (!connected || !pool.tokenMint) {
      setStakeData(null);
      setProjectData(null);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch user stake
        const userStake = await getUserStake(pool.tokenMint, pool.poolId);
        if (userStake) {
          setStakeData(userStake);
        } else {
          setStakeData(null);
        }

        // Fetch project data
        const project = await getProjectInfo(pool.tokenMint, pool.poolId);
        if (project) {
          setProjectData(project);
          
          // Get total staked from on-chain
          if (project.totalStaked) {
            const totalStaked = Number(project.totalStaked) / decimalsMultiplier;
            setOnChainTotalStaked(totalStaked);
          }
        } else {
          setProjectData(null);
        }
      } catch (error) {
        console.error("Error fetching LP pool data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000); // Update every 15 seconds
    return () => clearInterval(interval);
  }, [connected, pool.tokenMint, pool.poolId, decimalsMultiplier]);

  // Fetch dynamic rate from blockchain (same as PoolCard)
  useEffect(() => {
    if (!connected || !pool.tokenMint) {
      return;
    }

    const fetchDynamicRate = async () => {
      try {
        const result = await getPoolRate(pool.tokenMint, pool.poolId);
        setDynamicRate(result.rate);
      } catch (error) {
        // Silent fail
      }
    };

    fetchDynamicRate();
    const interval = setInterval(fetchDynamicRate, 120000); // Update every 2 minutes
    return () => clearInterval(interval);
  }, [connected, pool.tokenMint, pool.poolId]);

  // Calculate realtime rewards (same as PoolCard)
  const realtimeRewards = useRealtimeRewards(projectData, stakeData);

  // Calculate display rate (same logic as PoolCard line 705)
  const rate = dynamicRate ?? (pool.type === "locked" ? pool.apy : pool.apr) ?? 0;

  const rewardsDisplay = realtimeRewards > 0 
    ? `${formatRewards(realtimeRewards)} ${pool.rewardTokenSymbol || pool.symbol}` 
    : pool.rewardTokenSymbol || pool.rewards || pool.symbol;

  return (
    <div 
      onClick={() => router.push(`/lp-pool/${pool.id}`)}
      className="bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all duration-200 rounded-lg p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 relative group cursor-pointer"
      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
    >
      {/* Top badges */}
      <div className="absolute -top-2 left-2 sm:-top-2 sm:left-3 flex flex-wrap gap-1 items-start z-20">
        <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs font-semibold border backdrop-blur-sm" style={{ background: 'rgba(251, 87, 255, 0.2)', borderColor: 'rgba(251, 87, 255, 0.5)', color: '#fb57ff' }}>
          LP Pool #{pool.poolId}
        </div>
        {pool.featured && (
          <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs font-semibold border backdrop-blur-sm flex items-center gap-1" style={{ background: 'rgba(251, 87, 255, 0.2)', borderColor: 'rgba(251, 87, 255, 0.5)', color: '#fb57ff' }}>
            ⭐ <span className="hidden sm:inline">Featured</span>
          </div>
        )}
      </div>

      {/* Token Info */}
      <div className="flex items-center gap-2 sm:gap-3 relative z-10">
        <div className="relative flex-shrink-0">
          {pool.logo ? (
            <img src={pool.logo} alt={pool.symbol} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full border-2 border-white/[0.1]" />
          ) : (
            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base md:text-lg" style={{ background: 'rgba(251, 87, 255, 0.2)' }}>
              {pool.symbol.slice(0, 2)}
            </div>
          )}
          {pool.type === "locked" ? (
            <Lock className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white rounded-full p-0.5" style={{ background: '#fb57ff' }} />
          ) : (
            <Unlock className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white rounded-full p-0.5" style={{ background: '#fb57ff' }} />
          )}
        </div>
        
        <div className="flex-1 min-w-0 overflow-hidden">
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-white truncate leading-tight">{pool.name} LP</h2>
          <p className="text-gray-400 text-[10px] sm:text-xs leading-tight">{pool.symbol}</p>
        </div>
      </div>

      {/* APY Display */}
      <div className="relative z-10">
        <div className="p-2.5 sm:p-3 md:p-4 rounded-lg text-center bg-white/[0.02] border border-white/[0.05]">
          <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 uppercase tracking-wide mb-0.5">
            {pool.type === "locked" ? "APY" : "APR"}
          </p>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold leading-none truncate" style={{ color: '#fb57ff' }} title={`${typeof rate === 'number' ? rate.toFixed(2) : rate ?? "-"}%`}>
            {typeof rate === 'number' ? rate.toFixed(2) : rate ?? "-"}%
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm relative z-10">
        <div className="bg-white/[0.02] p-2 rounded-lg border border-white/[0.05]">
          <p className="text-gray-500 text-[9px] sm:text-[10px] md:text-xs mb-0.5 leading-tight">Total Staked</p>
          <p className="text-white font-semibold text-[11px] sm:text-xs md:text-sm leading-tight truncate">
            {onChainTotalStaked > 0 ? `${onChainTotalStaked.toLocaleString()} LP` : '0 LP'}
          </p>
        </div>
        
        <div className="bg-white/[0.02] p-2 rounded-lg border border-white/[0.05]">
          <p className="text-gray-500 text-[9px] sm:text-[10px] md:text-xs mb-0.5 leading-tight">
            {connected ? "Your Rewards" : "Rewards"}
          </p>
          <p className="text-white font-semibold text-[11px] sm:text-xs md:text-sm leading-tight truncate">
            {connected 
              ? (realtimeRewards > 0 ? formatRewards(realtimeRewards) : '0.0000')
              : (pool.rewardTokenSymbol || pool.symbol)
            }
          </p>
        </div>
      </div>

      {/* DEX Badge */}
      {pool.dexType && pool.dexPoolAddress && (
        <div className="bg-white/[0.02] p-2 rounded-lg border border-white/[0.05] relative z-10">
          {(() => {
            const dexInfo = getDexInfo(pool.dexType as any);
            return (
              <div className="flex items-center justify-between">
                <span className="text-[9px] sm:text-[10px] md:text-xs text-gray-400">DEX</span>
                <div 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold"
                  style={{ 
                    background: `${dexInfo.color}20`,
                    border: `1px solid ${dexInfo.color}50`,
                    color: dexInfo.color 
                  }}
                >
                  <span>{dexInfo.icon}</span>
                  <span>{dexInfo.displayName}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Lock Period Info */}
      <div className="bg-white/[0.02] p-2 rounded-lg border border-white/[0.05] relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {pool.type === "locked" ? (
              <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-400 flex-shrink-0" />
            ) : (
              <Unlock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-400 flex-shrink-0" />
            )}
            <span className="text-[9px] sm:text-[10px] md:text-xs text-gray-400">
              {pool.type === "locked" ? "Lock Period" : "Type"}
            </span>
          </div>
          <span className={`text-white font-bold text-[11px] sm:text-xs md:text-sm ${
            pool.type === "locked" ? "text-yellow-400" : "text-green-400"
          }`}>
            {pool.type === "locked" 
              ? `${pool.lockPeriod || 0} days` 
              : "Flexible"
            }
          </span>
        </div>
      </div>

      {/* Manage Liquidity Button - Show if either field exists */}
      {(pool.dexPoolAddress || pool.raydiumPoolAddress) && pool.dexType && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowLiquidityModal(true);
          }}
          className="w-full text-white py-2 px-2 rounded-lg text-xs font-medium transition-all min-h-[36px] leading-tight relative z-10 mb-2"
          style={{ background: 'linear-gradient(45deg, #6366f1, #8b5cf6)' }}
        >
          💧 Manage Liquidity
        </button>
      )}

      {/* View Pool Button */}
      <button
        className="w-full text-white py-2 px-2 rounded-lg text-xs font-medium transition-all min-h-[36px] leading-tight relative z-10"
        style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
        onClick={(e) => {
          e.stopPropagation();
          router.push(`/lp-pool/${pool.id}`);
        }}
      >
        View LP Pool →
      </button>

      {/* Manage Liquidity Modal */}
      {showLiquidityModal && (pool.dexPoolAddress || pool.raydiumPoolAddress) && pool.dexType && (
        <ManageLiquidityModal
          isOpen={showLiquidityModal}
          onClose={() => setShowLiquidityModal(false)}
          poolId={pool.id}
          poolName={pool.name}
          lpTokenMint={pool.tokenMint}
          dexType={pool.dexType as any}
          dexPoolAddress={pool.dexPoolAddress || pool.raydiumPoolAddress || ''}
          rewardTokenSymbol={pool.rewardTokenSymbol}
        />
      )}
    </div>
  );
}