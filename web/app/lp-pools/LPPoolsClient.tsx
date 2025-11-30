"use client";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Plus, TrendingUp, Lock, Unlock } from "lucide-react";
import LPPoolCard from "@/components/LPPoolCard";
import CreateLPPoolModal from "@/components/CreateLPPoolModal";

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
  hidden?: boolean;
  featured?: boolean;
  isLPPool?: boolean;
  rewardTokenMint?: string | null;
  rewardTokenSymbol?: string | null;
};

export default function LPPoolsClient({ pools: initialPools }: { pools: LPPool[] }) {
  const { publicKey } = useWallet();
  const [pools, setPools] = useState(initialPools);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "locked" | "unlocked">("all");

  const filteredPools = pools.filter(pool => {
    if (filterType === "all") return true;
    return pool.type === filterType;
  });

  const refreshPools = async () => {
    try {
      const response = await fetch('/api/lp-pools');
      if (response.ok) {
        const data = await response.json();
        setPools(data);
      }
    } catch (error) {
      console.error('Error refreshing LP pools:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2" style={{ 
          background: 'linear-gradient(45deg, white, #fb57ff)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent' 
        }}>
          LP Farming Pools
        </h1>
        <p className="text-gray-400">
          Stake your LP tokens and earn rewards
        </p>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFilterType("all")}
            className={`px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
              filterType === "all"
                ? 'text-white'
                : 'bg-white/[0.05] text-gray-400 hover:bg-white/[0.08]'
            }`}
            style={filterType === "all" ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}
          >
            All Pools
          </button>
          <button
            onClick={() => setFilterType("locked")}
            className={`px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              filterType === "locked"
                ? 'text-white'
                : 'bg-white/[0.05] text-gray-400 hover:bg-white/[0.08]'
            }`}
            style={filterType === "locked" ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}
          >
            <Lock className="w-4 h-4" />
            Locked
          </button>
          <button
            onClick={() => setFilterType("unlocked")}
            className={`px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              filterType === "unlocked"
                ? 'text-white'
                : 'bg-white/[0.05] text-gray-400 hover:bg-white/[0.08]'
            }`}
            style={filterType === "unlocked" ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}
          >
            <Unlock className="w-4 h-4" />
            Flexible
          </button>
        </div>

        {publicKey ? (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(45deg, #fb57ff, black)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(45deg, black, #fb57ff)'}
          >
            <Plus className="w-5 h-5" />
            Create LP Pool
          </button>
        ) : (
          <WalletMultiButton 
            style={{
              background: 'linear-gradient(45deg, black, #fb57ff)',
              height: '42px',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}
          />
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-6">
          <div className="text-gray-400 text-sm mb-2">Total LP Pools</div>
          <div className="text-3xl font-bold" style={{ color: '#fb57ff' }}>
            {pools.length}
          </div>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-6">
          <div className="text-gray-400 text-sm mb-2">Active Pools</div>
          <div className="text-3xl font-bold text-white">
            {pools.filter(p => !p.hidden).length}
          </div>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-6">
          <div className="text-gray-400 text-sm mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Average APY
          </div>
          <div className="text-3xl font-bold" style={{ color: '#fb57ff' }}>
            {pools.length > 0 
              ? (pools.reduce((acc, p) => acc + (p.apy || 0), 0) / pools.length).toFixed(1)
              : '0'}%
          </div>
        </div>
      </div>

      {/* Pools Grid */}
      {filteredPools.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🏊</div>
          <p className="text-gray-400 text-lg mb-4">
            {filterType === "all" 
              ? "No LP pools available yet" 
              : `No ${filterType} LP pools available`}
          </p>
          {publicKey && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 rounded-lg font-semibold transition-all inline-flex items-center gap-2"
              style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
            >
              <Plus className="w-5 h-5" />
              Create First LP Pool
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPools.map((pool) => (
            <LPPoolCard key={pool.id} pool={pool} />
          ))}
        </div>
      )}

      {/* Create Pool Modal */}
      {showCreateModal && (
        <CreateLPPoolModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={refreshPools}
        />
      )}
    </div>
  );
}