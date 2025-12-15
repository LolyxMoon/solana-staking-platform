"use client";

import { useState, useEffect } from "react";
import PoolCard from "@/components/PoolCard";
import { useToast } from "@/components/ToastContainer";
import { PoolCardSkeleton, LoadingSpinner } from "@/components/SkeletonLoaders";
import { Search, Filter, X, SlidersHorizontal, Grid3x3, List, Plus } from "lucide-react";
import { usePoolData } from "@/hooks/usePoolData";
import CreatePoolModal from "@/components/CreatePoolModal";
import { useWallet } from "@solana/wallet-adapter-react";

type Pool = {
  id: string;
  poolId: number; // ✅ NEW: Pool number
  tokenMint: string; // ✅ NEW: Replaces mintAddress
  name: string;
  symbol: string;
  type: "locked" | "unlocked";
  lockPeriod?: number | null;
  apr?: number | null;
  apy?: number | null;
  rateMode?: number;
  totalStaked: number;
  rewards?: string | null;
  logo?: string | null;
  pairAddress?: string | null;
  hidden?: boolean;
  featured?: boolean;
  createdAt?: string;
  hasSelfReflections?: boolean;
  hasExternalReflections?: boolean;
  externalReflectionMint?: string | null;
  reflectionTokenAccount?: string | null;
  reflectionTokenSymbol?: string | null;
};

export default function PoolsClient({ pools }: { pools: Pool[] }) {
  const [sortBy, setSortBy] = useState<"az" | "za" | "rate" | "newest">("az");
  const [filterType, setFilterType] = useState<"all" | "locked" | "unlocked">("all");
  const [filterFeatured, setFilterFeatured] = useState(false);
  const [apyMin, setApyMin] = useState<number>(0);
  const [apyMax, setApyMax] = useState<number>(1000);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showCreatePoolModal, setShowCreatePoolModal] = useState(false);
  
  const { showInfo, showSuccess } = useToast();
  const { connected } = useWallet();
  
  const { loadPoolsData, loadAllPoolData } = usePoolData();

  // Batch load all pool data on mount
  useEffect(() => {
    const uniqueMints = [...new Set(pools.map(p => p.tokenMint).filter(Boolean))];
    if (uniqueMints.length > 0) {
      loadPoolsData(uniqueMints);
    }
    
    // Load all pool projects and stakes in batch
    const poolInfos = pools.map(p => ({ tokenMint: p.tokenMint, poolId: p.poolId }));
    if (poolInfos.length > 0) {
      loadAllPoolData(poolInfos);
    }
  }, [pools, loadPoolsData, loadAllPoolData]);

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Load saved view preference
  useEffect(() => {
    const savedView = localStorage.getItem("poolsViewMode");
    if (savedView === "list" || savedView === "grid") {
      setViewMode(savedView);
    }
  }, []);

  // Save view preference
  const toggleViewMode = () => {
    const newMode = viewMode === "grid" ? "list" : "grid";
    setViewMode(newMode);
    localStorage.setItem("poolsViewMode", newMode);
  };

  // ✅ NEW: Count pools per token to show "Pool X of Y"
  const poolCountByToken = pools.reduce((acc, pool) => {
    const key = pool.tokenMint;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ✅ Apply Filters
  const filteredPools = pools.filter((pool) => {
    if (filterType !== "all" && pool.type !== filterType) return false;
    if (filterFeatured && !pool.featured) return false;

    const rate = pool.type === "locked" ? Number(pool.apy ?? 0) : Number(pool.apr ?? 0);
    if (rate < apyMin || rate > apyMax) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = pool.name.toLowerCase().includes(query);
      const matchesSymbol = pool.symbol.toLowerCase().includes(query);
      if (!matchesName && !matchesSymbol) return false;
    }

    return true;
  });

  // ✅ Apply Sorting
  const sortedPools = [...filteredPools].sort((a, b) => {
    if (sortBy === "az") return a.name.localeCompare(b.name);
    if (sortBy === "za") return b.name.localeCompare(a.name);
    if (sortBy === "rate") {
      const rateA = a.type === "locked" ? Number(a.apy ?? 0) : Number(a.apr ?? 0);
      const rateB = b.type === "locked" ? Number(b.apy ?? 0) : Number(b.apr ?? 0);
      return rateB - rateA;
    }
    if (sortBy === "newest") {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    }
    return 0;
  });

  // Clear all filters
  const clearFilters = () => {
    setFilterType("all");
    setFilterFeatured(false);
    setApyMin(0);
    setApyMax(1000);
    setSearchQuery("");
    showInfo("Filters cleared!");
  };

  const hasActiveFilters = filterType !== "all" || filterFeatured || apyMin > 0 || apyMax < 1000 || searchQuery !== "";

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-2">
          <div className="h-8 sm:h-10 w-48 sm:w-64 bg-white/[0.05] rounded animate-pulse" />
          <div className="h-4 sm:h-5 w-32 sm:w-48 bg-white/[0.05] rounded animate-pulse" />
        </div>

        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 sm:p-6">
          <div className="h-10 w-full bg-white/[0.05] rounded animate-pulse mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 bg-white/[0.05] rounded animate-pulse" />
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <PoolCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header - MOBILE RESPONSIVE */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2" style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Staking Pools
          </h1>
          <p className="text-sm sm:text-base text-gray-400">
            Showing <span className="font-semibold" style={{ color: '#fb57ff' }}>{sortedPools.length}</span> of{" "}
            <span className="font-semibold" style={{ color: '#fb57ff' }}>{pools.length}</span> pools
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {/* Create Pool Button */}
          <button
            onClick={() => {
              if (!connected) {
                showInfo("Please connect your wallet to create a pool");
                return;
              }
              setShowCreatePoolModal(true);
            }}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all active:scale-95 text-sm sm:text-base flex-1 sm:flex-initial min-h-[44px] font-semibold"
            style={{ 
              background: 'linear-gradient(45deg, black, #fb57ff)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(45deg, #fb57ff, black)';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(45deg, black, #fb57ff)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Create Pool</span>
          </button>

          {/* View Toggle Button - MOBILE RESPONSIVE */}
          <button
            onClick={toggleViewMode}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] rounded-lg transition-all active:scale-95 text-sm sm:text-base flex-1 sm:flex-initial min-h-[44px]"
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
            title={viewMode === "grid" ? "Switch to List View" : "Switch to Grid View"}
          >
            {viewMode === "grid" ? (
              <>
                <List className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">List</span>
              </>
            ) : (
              <>
                <Grid3x3 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Grid</span>
              </>
            )}
          </button>

          {/* Toggle Filters Button - MOBILE RESPONSIVE */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] rounded-lg transition-all active:scale-95 text-sm sm:text-base flex-1 sm:flex-initial min-h-[44px]"
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
          >
            <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <span className="text-white text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#fb57ff' }}>
                {[filterType !== "all", filterFeatured, apyMin > 0 || apyMax < 1000, searchQuery !== ""].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters Section - MOBILE RESPONSIVE */}
      {showFilters && (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 animate-in slide-in-from-top duration-300">
          {/* Search Bar - MOBILE RESPONSIVE */}
          <div className="relative mb-4">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder="Search pools by name or symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-2.5 sm:py-3 bg-white/[0.02] border border-white/[0.05] rounded-lg text-white placeholder-gray-600 focus:outline-none transition-colors text-sm sm:text-base min-h-[48px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors active:scale-90"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
          </div>

          {/* Filter Controls - MOBILE RESPONSIVE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
            {/* Sort By - MOBILE RESPONSIVE */}
            <div>
              <label className="block text-xs sm:text-sm text-gray-400 mb-2 font-medium">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/[0.02] border border-white/[0.05] rounded-lg text-white focus:outline-none transition-colors text-sm sm:text-base min-h-[48px] cursor-pointer"
              >
                <option value="az">A → Z</option>
                <option value="za">Z → A</option>
                <option value="rate">Highest Rate</option>
                <option value="newest">Newest First</option>
              </select>
            </div>

            {/* Pool Type - MOBILE RESPONSIVE */}
            <div>
              <label className="block text-xs sm:text-sm text-gray-400 mb-2 font-medium">Pool Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/[0.02] border border-white/[0.05] rounded-lg text-white focus:outline-none transition-colors text-sm sm:text-base min-h-[48px] cursor-pointer"
              >
                <option value="all">All Pools</option>
                <option value="locked">Locked Only</option>
                <option value="unlocked">Flexible Only</option>
              </select>
            </div>

            {/* APY/APR Range - MOBILE RESPONSIVE */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs sm:text-sm text-gray-400 mb-2 font-medium">Min Rate (%)</label>
              <input
                type="number"
                min="0"
                max={apyMax}
                value={apyMin}
                onChange={(e) => setApyMin(Number(e.target.value))}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/[0.02] border border-white/[0.05] rounded-lg text-white focus:outline-none transition-colors text-sm sm:text-base min-h-[48px]"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs sm:text-sm text-gray-400 mb-2 font-medium">Max Rate (%)</label>
              <input
                type="number"
                min={apyMin}
                max="1000"
                value={apyMax}
                onChange={(e) => setApyMax(Number(e.target.value))}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/[0.02] border border-white/[0.05] rounded-lg text-white focus:outline-none transition-colors text-sm sm:text-base min-h-[48px]"
              />
            </div>
          </div>

          {/* Featured Toggle & Clear Button - MOBILE RESPONSIVE */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <label className="flex items-center gap-2 sm:gap-3 cursor-pointer bg-white/[0.02] px-4 py-3 rounded-lg hover:bg-white/[0.04] transition-colors border border-white/[0.05] flex-1 sm:flex-initial min-h-[48px]">
              <input
                type="checkbox"
                checked={filterFeatured}
                onChange={(e) => setFilterFeatured(e.target.checked)}
                className="w-4 h-4 sm:w-5 sm:h-5 rounded border-white/[0.1] cursor-pointer"
                style={{ accentColor: '#fb57ff' }}
              />
              <span className="text-sm sm:text-base text-white font-medium">Featured Only <span style={{ color: '#fb57ff' }}>⭐</span></span>
            </label>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg font-semibold transition-all active:scale-95 text-sm sm:text-base min-h-[48px]"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pools Grid/List - MOBILE RESPONSIVE */}
      {sortedPools.length === 0 ? (
        <div className="text-center py-12 sm:py-16 animate-in zoom-in-95 duration-300">
          <div className="text-5xl sm:text-6xl mb-4">🔍</div>
          <p className="text-lg sm:text-xl text-white mb-2 font-semibold">No pools found</p>
          <p className="text-sm sm:text-base text-gray-600 mb-4">Try adjusting your filters to see more results</p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 sm:px-6 py-2.5 sm:py-3 text-white rounded-lg font-semibold transition-all active:scale-95 shadow-lg text-sm sm:text-base min-h-[48px]"
              style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        // GRID VIEW - MOBILE RESPONSIVE
        <div className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-in fade-in duration-500">
          {sortedPools.map((pool, index) => (
            <div
              key={pool.id}
              className="animate-in slide-in-from-bottom duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <PoolCard 
                {...pool}
                poolId={pool.poolId}
                tokenMint={pool.tokenMint}
                showPoolNumber={poolCountByToken[pool.tokenMint] > 1}
                totalPoolsForToken={poolCountByToken[pool.tokenMint]}
              />
            </div>
          ))}
        </div>
       ) : (
        // LIST VIEW - Use PoolCard component
        <div className="space-y-3 animate-in fade-in duration-500">
          {sortedPools.map((pool, index) => (
            <div
              key={pool.id}
              className="animate-in slide-in-from-left duration-300"
              style={{ animationDelay: `${index * 20}ms` }}
            >
              <PoolCard 
                {...pool}
                poolId={pool.poolId}
                tokenMint={pool.tokenMint}
                showPoolNumber={poolCountByToken[pool.tokenMint] > 1}
                totalPoolsForToken={poolCountByToken[pool.tokenMint]}
              />
            </div>
          ))}
        </div>
      )}

      {/* Create Pool Modal */}
      {showCreatePoolModal && (
        <CreatePoolModal
          onClose={() => setShowCreatePoolModal(false)}
          onSuccess={() => {
            setShowCreatePoolModal(false);
            showSuccess("✅ Pool created successfully! Refreshing...");
            // Reload the page to show new pool
            setTimeout(() => window.location.reload(), 1500);
          }}
        />
      )}
    </div>
  );
}