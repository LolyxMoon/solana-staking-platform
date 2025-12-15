"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";

interface UserStake {
  id: string;
  tokenMint: string;
  poolId: number;
  stakedAmount: string;
  poolName: string;
  poolSymbol: string;
  poolLogo?: string;
  apy?: number;
  apr?: number;
  type: "locked" | "unlocked";
}

export function UserStakedPools() {
  const { connected, publicKey } = useWallet();
  const router = useRouter();
  const [stakes, setStakes] = useState<UserStake[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStaked, setTotalStaked] = useState(0);

  useEffect(() => {
    if (!connected || !publicKey) {
      setStakes([]);
      setLoading(false);
      return;
    }

    const fetchUserStakes = async () => {
      try {
        setLoading(true);
        console.log('📊 Fetching user stakes for:', publicKey.toString());

        const response = await fetch(`/api/stakes/user/${publicKey.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch user stakes');
        }

        const data = await response.json();
        console.log('✅ User stakes received:', data);

        setStakes(data.stakes || []);
        setTotalStaked(data.totalStaked || 0);

      } catch (error) {
        console.error('❌ Error fetching user stakes:', error);
        setStakes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserStakes();

    // Refresh every 30 seconds
    const interval = setInterval(fetchUserStakes, 120000);
    return () => clearInterval(interval);
  }, [connected, publicKey]);

  if (!connected) {
    return (
      <div className="bg-white/[0.02] rounded-lg p-4 sm:p-6 border border-white/[0.05]">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-4">Your Staked Pools</h2>
        <div className="text-center py-8">
          <p className="text-gray-500">Connect your wallet to view your stakes</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white/[0.02] rounded-lg p-4 sm:p-6 border border-white/[0.05]">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-4">Your Staked Pools</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/[0.05]"></div>
                  <div>
                    <div className="w-24 h-4 bg-white/[0.05] rounded mb-2"></div>
                    <div className="w-16 h-3 bg-white/[0.05] rounded"></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="w-20 h-4 bg-white/[0.05] rounded mb-2"></div>
                  <div className="w-16 h-3 bg-white/[0.05] rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stakes.length === 0) {
    return (
      <div className="bg-white/[0.02] rounded-lg p-4 sm:p-6 border border-white/[0.05]">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-4">Your Staked Pools</h2>
        <div className="text-center py-8">
          <div className="text-gray-500 mb-4">You haven't staked in any pools yet</div>
          <button
            onClick={() => router.push('/pools')}
            className="px-6 py-2 text-white rounded-lg font-semibold transition-all"
            style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
          >
            Browse Pools
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] rounded-lg p-4 sm:p-6 border border-white/[0.05]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-white">Your Staked Pools</h2>
        <div className="text-right">
          <div className="text-xs sm:text-sm text-gray-500">Total Staked</div>
          <div className="text-base sm:text-lg font-bold text-white">
            {totalStaked.toLocaleString(undefined, { maximumFractionDigits: 2 })} Tokens
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {stakes.map((stake) => (
          <div
            key={stake.id}
            onClick={() => router.push(`/pools?highlight=${stake.tokenMint}`)}
            className="bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] rounded-lg p-3 sm:p-4 transition-all cursor-pointer group"
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
          >
            <div className="flex items-center justify-between">
              {/* Left side - Pool info */}
              <div className="flex items-center gap-3">
                {stake.poolLogo ? (
                  <img
                    src={stake.poolLogo}
                    alt={stake.poolName}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-white/[0.1] transition-all"
                  />
                ) : (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: 'rgba(251, 87, 255, 0.2)' }}>
                    {stake.poolSymbol.slice(0, 2)}
                  </div>
                )}
                <div>
                  <div className="font-bold text-white transition-colors text-sm sm:text-base">
                    {stake.poolName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {stake.poolSymbol} • Pool #{stake.poolId}
                  </div>
                </div>
              </div>

              {/* Right side - Stake amount & APY */}
              <div className="text-right">
                <div className="font-bold text-white flex items-center gap-2 justify-end text-sm sm:text-base">
                  <TrendingUp className="w-4 h-4" style={{ color: '#fb57ff' }} />
                  {(Number(stake.stakedAmount) / 1e9).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-xs text-gray-500">
                  {stake.type === "locked" && stake.apy ? (
                    <span style={{ color: '#fb57ff' }}>{stake.apy}% APY</span>
                  ) : stake.type === "unlocked" && stake.apr ? (
                    <span style={{ color: '#fb57ff' }}>{stake.apr}% APR</span>
                  ) : (
                    "Staked"
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => router.push('/pools')}
        className="w-full mt-4 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] text-white rounded-lg font-semibold transition-all text-sm"
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
      >
        View All Pools
      </button>
    </div>
  );
}