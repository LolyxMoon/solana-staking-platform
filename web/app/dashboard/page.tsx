"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { TrendingUp, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserStakedPools } from "@/components/UserStakedPools";

type FeaturedPool = {
  id: string;
  poolId: number;
  tokenMint: string;
  name: string;
  symbol: string;
  type: "locked" | "unlocked";
  apr?: number | null;
  apy?: number | null;
  logo?: string | null;
  featured: boolean;
};

export default function Dashboard() {
  const { connected, publicKey } = useWallet();
  const router = useRouter();
  const [featuredPools, setFeaturedPools] = useState<FeaturedPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStakers: 0,
    totalValueLocked: 0,
    totalStakes: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch featured pools
  useEffect(() => {
    async function fetchFeaturedPools() {
      try {
        setLoading(true);
        
        // Fetch all pools - API already orders by featured first
        const response = await fetch('/api/pools');
        
        if (!response.ok) throw new Error('Failed to fetch pools');
        
        const pools = await response.json();
        
        // API returns array directly and orders by featured first
        // Just take first 5 featured pools
        const featured = pools.filter((pool: FeaturedPool) => pool.featured).slice(0, 5);
        setFeaturedPools(featured);
        
      } catch (error) {
        console.error('Error fetching featured pools:', error);
        setFeaturedPools([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    }

    fetchFeaturedPools();
  }, []);

  // Fetch platform stats
  useEffect(() => {
    async function fetchStats() {
      try {
        setStatsLoading(true);
        
        console.log('📊 Fetching platform stats...');
        const response = await fetch('/api/stats');
        
        if (!response.ok) throw new Error('Failed to fetch stats');
        
        const data = await response.json();
        
        console.log('✅ Stats received:', data);
        
        setStats({
          totalStakers: data.totalStakers || 0,
          totalValueLocked: data.totalValueLocked || 0,
          totalStakes: data.totalStakes || 0
        });
        
      } catch (error) {
        console.error('❌ Error fetching stats:', error);
      } finally {
        setStatsLoading(false);
      }
    }

    fetchStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleStakeNow = (poolId: string) => {
    // Navigate to pools page with the specific pool
    router.push(`/pools?highlight=${poolId}`);
  };

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2" style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Staking Dashboard
          </h1>
          <p className="text-sm sm:text-base text-gray-500">Monitor your staking platform</p>
        </div>

        {/* Featured Pools Section */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span style={{ color: '#fb57ff' }}>⭐</span>
              Featured Pools
            </h2>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 animate-pulse">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-full bg-white/[0.05]"></div>
                    <div className="w-20 h-4 bg-white/[0.05] rounded"></div>
                    <div className="w-16 h-3 bg-white/[0.05] rounded"></div>
                    <div className="w-16 h-6 bg-white/[0.05] rounded"></div>
                    <div className="w-full h-9 bg-white/[0.05] rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : featuredPools.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              {featuredPools.map((pool) => (
                <div 
                  key={pool.id} 
                  className="bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] rounded-lg p-3 sm:p-4 transition-all duration-200"
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    {pool.logo ? (
                      <img src={pool.logo} alt={pool.name} className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-white/[0.1]" />
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{ background: 'rgba(251, 87, 255, 0.2)' }}>
                        {pool.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="w-full">
                      <h3 className="font-bold text-white text-sm sm:text-base truncate" title={pool.name}>
                        {pool.name}
                      </h3>
                      <p className="text-gray-500 text-xs truncate">{pool.symbol}</p>
                    </div>
                    <div className="w-full">
                      <p className="text-xl sm:text-2xl font-bold" style={{ color: '#fb57ff' }}>
                        {pool.type === "locked" ? pool.apy : pool.apr}%
                      </p>
                      <p className="text-xs text-gray-500">{pool.type === "locked" ? "APY" : "APR"}</p>
                    </div>
                    <button 
                      onClick={() => handleStakeNow(pool.id)}
                      className="w-full px-3 py-2 text-white rounded-lg font-medium transition-all text-sm"
                      style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                    >
                      Stake Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No featured pools available</p>
              <p className="text-gray-600 text-xs mt-1">Set pools as featured in the admin panel</p>
            </div>
          )}
        </div>

        {/* Stats Grid - Only platform-wide stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          
          {/* Total Value Locked */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 sm:p-5 hover:bg-white/[0.04] transition-all">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="text-gray-500 text-xs sm:text-sm">Total Value Locked</div>
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#fb57ff' }} />
            </div>
            {statsLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-white/[0.05] rounded w-24 mb-1"></div>
                <div className="h-3 bg-white/[0.05] rounded w-16"></div>
              </div>
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold text-white">
                  {stats.totalValueLocked.toLocaleString(undefined, { 
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2 
                  })}
                </div>
                <div className="text-xs mt-1" style={{ color: '#fb57ff' }}>Tokens Staked</div>
              </>
            )}
          </div>

          {/* Total Stakers */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 sm:p-5 hover:bg-white/[0.04] transition-all">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="text-gray-500 text-xs sm:text-sm">Total Stakers</div>
              <Users className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#fb57ff' }} />
            </div>
            {statsLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-white/[0.05] rounded w-16 mb-1"></div>
                <div className="h-3 bg-white/[0.05] rounded w-20"></div>
              </div>
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold text-white">
                  {stats.totalStakers.toLocaleString()}
                </div>
                <div className="text-xs mt-1" style={{ color: '#fb57ff' }}>
                  {stats.totalStakes} Total Stakes
                </div>
              </>
            )}
          </div>

        </div>

        {/* User's Staked Pools Section */}
        <UserStakedPools />

        {/* Recent Activity */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Recent Activity</h2>
          
          {connected ? (
            <div className="space-y-2 sm:space-y-3">
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 sm:p-4">
                <div>
                  <div className="text-white font-semibold text-sm">No activity yet</div>
                  <div className="text-gray-500 text-xs mt-1">Your transactions will appear here</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <div className="text-sm sm:text-base text-gray-500">Connect your wallet to view activity</div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}