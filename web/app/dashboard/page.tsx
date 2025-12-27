"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { 
  TrendingUp, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  Gift, 
  AlertTriangle, 
  ExternalLink, 
  Coins,
  Wallet,
  RefreshCw,
  Zap,
  Link2,
  ChevronRight,
  Loader2
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { UserStakedPools } from "@/components/UserStakedPools";
import { usePoolData } from "@/hooks/usePoolData";
import { useStakingProgram } from "@/hooks/useStakingProgram";
import { calculatePendingRewards } from "@/utils/calculatePendingRewards";
import BatchOperationModal, { BatchTxStep, BatchOperationType } from "@/components/BatchOperationModal";
import { toast } from "sonner";

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
  hidden?: boolean; 
  featuredOrder?: number;
  decimals?: number;
};

type Activity = {
  id: string;
  type: string;
  amount: number;
  timestamp: string;
  txSignature?: string;
  pool?: {
    name: string;
    symbol: string;
    logo?: string;
  };
};

type UserStakeFromAPI = {
  id: string;
  tokenMint: string;
  poolId: number;
  stakedAmount: string;
  stakePda: string;
  poolName: string;
  poolSymbol: string;
  poolLogo: string | null;
  apy: number | null;
  apr: number | null;
  type: "locked" | "unlocked";
};

type ReferralStats = {
  totalReferrals: number;
  referredPools: {
    id: string;
    name: string;
    symbol: string;
    logo?: string;
    createdAt: string;
    referralSplitPercent: number;
  }[];
};

export default function Dashboard() {
  const { connected, publicKey } = useWallet();
  const router = useRouter();
  
  // Hooks - use cached data from usePoolData to avoid hammering RPC
  const { 
    loadAllPoolData,
    loadPoolsData,
    getPoolProject, 
    getUserStake: getCachedUserStake,
    getDecimals,
    getPrice,
    isPoolDataLoading 
  } = usePoolData();
  const { claimRewards, stake, batchClaimRewards, batchCompound } = useStakingProgram();
  
  // Existing state
  const [featuredPools, setFeaturedPools] = useState<FeaturedPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [dynamicRates, setDynamicRates] = useState<Map<string, number>>(new Map());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [stats, setStats] = useState({
    totalStakers: 0,
    totalValueLocked: 0,
    totalStakes: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // New state for enhanced features
  const [userStakes, setUserStakes] = useState<UserStakeFromAPI[]>([]);
  const [userStakesLoading, setUserStakesLoading] = useState(false);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [claimingAll, setClaimingAll] = useState(false);
  const [compounding, setCompounding] = useState(false);
  const [rewardsRefreshTick, setRewardsRefreshTick] = useState(0);

  // Batch operation modal state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchOperationType, setBatchOperationType] = useState<BatchOperationType>("claim");
  const [batchSteps, setBatchSteps] = useState<BatchTxStep[]>([]);
  const [currentBatchStep, setCurrentBatchStep] = useState(0);
  const [batchSuccessCount, setBatchSuccessCount] = useState(0);
  const [batchFailCount, setBatchFailCount] = useState(0);
  const [batchComplete, setBatchComplete] = useState(false);
  const [totalPoolsInBatch, setTotalPoolsInBatch] = useState(0);
  const [gasSaved, setGasSaved] = useState(0);

  // Real-time rewards ticker - updates calculation every second
  useEffect(() => {
    if (!connected || userStakes.length === 0) return;
    
    const interval = setInterval(() => {
      setRewardsRefreshTick(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [connected, userStakes.length]);

  // Calculate pending rewards DYNAMICALLY using existing utility
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stakesWithCachedData = useMemo(() => {
    return userStakes.map(stake => {
      const cachedStake = getCachedUserStake(stake.tokenMint, stake.poolId);
      const cachedProject = getPoolProject(stake.tokenMint, stake.poolId);
      const decimals = getDecimals(stake.tokenMint);
      const { price } = getPrice(stake.tokenMint);
      
      // Use existing calculatePendingRewards utility
      const pendingRewards = cachedProject && cachedStake 
        ? calculatePendingRewards(cachedProject, cachedStake, decimals)
        : 0;
      
      const stakedAmountHuman = Number(stake.stakedAmount) / Math.pow(10, decimals);
      const stakedUsd = price ? stakedAmountHuman * price : null;
      const pendingUsd = price ? pendingRewards * price : null;
      
      return {
        ...stake,
        pendingRewards,
        decimals,
        stakedAmountHuman,
        stakedUsd,
        pendingUsd,
        price,
      };
    });
  }, [userStakes, getCachedUserStake, getPoolProject, getDecimals, getPrice, rewardsRefreshTick]);

  // Calculate totals from cached user stakes
  const totalPendingRewards = useMemo(() => 
    stakesWithCachedData.reduce((sum, stake) => sum + stake.pendingRewards, 0),
    [stakesWithCachedData]
  );
  
  const totalStakedValue = useMemo(() => 
    stakesWithCachedData.reduce((sum, stake) => sum + stake.stakedAmountHuman, 0),
    [stakesWithCachedData]
  );

  const totalStakedUsd = useMemo(() => {
    const total = stakesWithCachedData.reduce((sum, stake) => {
      return sum + (stake.stakedUsd || 0);
    }, 0);
    return total > 0 ? total : null;
  }, [stakesWithCachedData]);

  const totalPendingUsd = useMemo(() => {
    const total = stakesWithCachedData.reduce((sum, stake) => {
      return sum + (stake.pendingUsd || 0);
    }, 0);
    return total > 0 ? total : null;
  }, [stakesWithCachedData]);
  
  const stakesWithRewards = useMemo(() => 
    stakesWithCachedData.filter(stake => stake.pendingRewards > 0),
    [stakesWithCachedData]
  );

  // Fetch user stakes from API (database) - no RPC calls
  const fetchUserStakes = useCallback(async () => {
    if (!connected || !publicKey) {
      setUserStakes([]);
      return;
    }

    try {
      setUserStakesLoading(true);
      const response = await fetch(`/api/stakes/user/${publicKey.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch stakes');
      const data = await response.json();
      
      if (!data.success || !data.stakes) {
        setUserStakes([]);
        return;
      }

      setUserStakes(data.stakes);
      
      // Batch load on-chain data for all user stakes
      if (data.stakes.length > 0) {
        const poolInfos = data.stakes.map((s: UserStakeFromAPI) => ({
          tokenMint: s.tokenMint,
          poolId: s.poolId
        }));
        
        // Load decimals for these tokens (batched via getMultipleAccountsInfo)
        const uniqueMints = [...new Set(data.stakes.map((s: UserStakeFromAPI) => s.tokenMint))];
        await loadPoolsData(uniqueMints);
        
        // Load project and stake accounts (2 RPC calls total via getMultipleAccountsInfo)
        await loadAllPoolData(poolInfos);
      }
    } catch (error) {
      console.error('Error fetching user stakes:', error);
      setUserStakes([]);
    } finally {
      setUserStakesLoading(false);
    }
  }, [connected, publicKey, loadAllPoolData, loadPoolsData]);

  useEffect(() => {
    fetchUserStakes();
    // Refresh every 60s - uses cached data so minimal RPC impact
    const interval = setInterval(fetchUserStakes, 60000);
    return () => clearInterval(interval);
  }, [fetchUserStakes]);

  // Fetch referral stats (API call, no RPC)
  useEffect(() => {
    async function fetchReferralStats() {
      if (!connected || !publicKey) {
        setReferralStats(null);
        return;
      }

      try {
        setReferralLoading(true);
        const response = await fetch(`/api/referrals/stats?wallet=${publicKey.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch referral stats');
        const data = await response.json();
        setReferralStats(data);
      } catch (error) {
        console.error('Error fetching referral stats:', error);
        setReferralStats(null);
      } finally {
        setReferralLoading(false);
      }
    }

    fetchReferralStats();
  }, [connected, publicKey]);

  // Fetch featured pools
  useEffect(() => {
    async function fetchFeaturedPools() {
      try {
        setLoading(true);
        const response = await fetch('/api/pools');
        if (!response.ok) throw new Error('Failed to fetch pools');
        const pools = await response.json();
        const featured = pools
          .filter((pool: FeaturedPool) => pool.featured && !pool.hidden)
          .sort((a: FeaturedPool, b: FeaturedPool) => (a.featuredOrder || 99) - (b.featuredOrder || 99))
          .slice(0, 5);
        setFeaturedPools(featured);
        
        // Batch load blockchain data for featured pools
        if (featured.length > 0) {
          const poolInfos = featured.map((p: FeaturedPool) => ({ 
            tokenMint: p.tokenMint, 
            poolId: p.poolId 
          }));
          
          // Load decimals (batched)
          const uniqueMints = [...new Set(featured.map((p: FeaturedPool) => p.tokenMint))];
          await loadPoolsData(uniqueMints);
          
          // Load project accounts (1-2 RPC calls via getMultipleAccountsInfo)
          await loadAllPoolData(poolInfos);
        }
      } catch (error) {
        console.error('Error fetching featured pools:', error);
        setFeaturedPools([]);
      } finally {
        setLoading(false);
      }
    }

    fetchFeaturedPools();
  }, [loadAllPoolData, loadPoolsData]);

  // Calculate dynamic rates from CACHED blockchain data (no RPC calls here)
  useEffect(() => {
    if (featuredPools.length === 0 || isPoolDataLoading) return;
    
    const rates = new Map<string, number>();
    
    featuredPools.forEach(pool => {
      const project = getPoolProject(pool.tokenMint, pool.poolId);
      if (!project) return;
      
      if (project.rateMode === 0) {
        // Locked pool - static APY
        const rate = project.rateBpsPerYear?.toNumber?.() 
          ? project.rateBpsPerYear.toNumber() / 100 
          : (project.rateBpsPerYear || 0) / 100;
        rates.set(pool.id, rate);
      } else {
        // Variable pool - calculate APR
        const rewardRatePerSecond = BigInt(project.rewardRatePerSecond?.toString() || '0');
        const totalStaked = BigInt(project.totalStaked?.toString() || '0');
        
        if (totalStaked > 0n && rewardRatePerSecond > 0n) {
          const SECONDS_PER_YEAR = 31_536_000;
          const annualRewards = rewardRatePerSecond * BigInt(SECONDS_PER_YEAR);
          const apr = Number((annualRewards * 10000n) / totalStaked) / 100;
          rates.set(pool.id, apr);
        }
      }
    });
    
    setDynamicRates(rates);
  }, [featuredPools, getPoolProject, isPoolDataLoading]);

  // Fetch platform stats (API call, no RPC)
  useEffect(() => {
    async function fetchStats() {
      try {
        setStatsLoading(true);
        const response = await fetch('/api/stats');
        if (!response.ok) throw new Error('Failed to fetch stats');
        const data = await response.json();
        setStats({
          totalStakers: data.totalStakers || 0,
          totalValueLocked: data.totalValueLocked || 0,
          totalStakes: data.totalStakes || 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setStatsLoading(false);
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 120000);
    return () => clearInterval(interval);
  }, []);

  // Fetch recent activity (API call, no RPC)
  useEffect(() => {
    async function fetchActivity() {
      if (!connected || !publicKey) {
        setActivities([]);
        return;
      }

      try {
        setActivitiesLoading(true);
        const response = await fetch(`/api/activity/${publicKey.toString()}?limit=10`);
        if (!response.ok) throw new Error('Failed to fetch activity');
        const data = await response.json();
        setActivities(data || []);
      } catch (error) {
        console.error('Error fetching activity:', error);
        setActivities([]);
      } finally {
        setActivitiesLoading(false);
      }
    }

    fetchActivity();
    const interval = setInterval(fetchActivity, 60000);
    return () => clearInterval(interval);
  }, [connected, publicKey]);

  // Constants for batching
  const MAX_CLAIMS_PER_TX = 6;
  const MAX_COMPOUNDS_PER_TX = 3;

  // Claim all rewards handler - TRUE BATCH approach with modal
  const handleClaimAll = useCallback(async () => {
    if (!connected || !publicKey || stakesWithRewards.length === 0) return;

    const totalPools = stakesWithRewards.length;
    const totalBatches = Math.ceil(totalPools / MAX_CLAIMS_PER_TX);
    const txSaved = totalPools - totalBatches;

    // Initialize modal
    setBatchOperationType("claim");
    setBatchComplete(false);
    setBatchSuccessCount(0);
    setBatchFailCount(0);
    setCurrentBatchStep(0);
    setTotalPoolsInBatch(totalPools);
    setGasSaved(txSaved);
    
    // Create batch steps
    const steps: BatchTxStep[] = [];
    for (let i = 0; i < totalBatches; i++) {
      const startIdx = i * MAX_CLAIMS_PER_TX;
      const endIdx = Math.min(startIdx + MAX_CLAIMS_PER_TX, totalPools);
      const poolsInBatch = stakesWithRewards.slice(startIdx, endIdx);
      
      steps.push({
        id: `batch-claim-${i}`,
        batchNumber: i + 1,
        poolSymbols: poolsInBatch.map(p => p.poolSymbol),
        status: "pending",
      });
    }
    setBatchSteps(steps);
    setBatchModalOpen(true);
    setClaimingAll(true);

    let successCount = 0;
    let failCount = 0;

    try {
      // Process each batch
      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const startIdx = batchIdx * MAX_CLAIMS_PER_TX;
        const endIdx = Math.min(startIdx + MAX_CLAIMS_PER_TX, totalPools);
        const poolsInBatch = stakesWithRewards.slice(startIdx, endIdx);
        
        setCurrentBatchStep(batchIdx);
        
        // Update step to building
        setBatchSteps(prev => prev.map((step, idx) => 
          idx === batchIdx ? { ...step, status: "building" as const } : step
        ));

        try {
          // Call the batch claim function from useStakingProgram
          const result = await batchClaimRewards(
            poolsInBatch.map(p => ({
              tokenMint: p.tokenMint,
              poolId: p.poolId,
              symbol: p.poolSymbol,
            })),
            (_, __, status, txSig) => {
              setBatchSteps(prev => prev.map((step, idx) => 
                idx === batchIdx 
                  ? { ...step, status: status === 'done' ? 'success' : status, txSignature: txSig } 
                  : step
              ));
            }
          );

          // Check result
          if (result[0]?.success) {
            successCount++;
            setBatchSteps(prev => prev.map((step, idx) => 
              idx === batchIdx ? { ...step, status: "success" as const, txSignature: result[0].txSignature } : step
            ));
          } else {
            failCount++;
            setBatchSteps(prev => prev.map((step, idx) => 
              idx === batchIdx ? { ...step, status: "error" as const, error: result[0]?.error } : step
            ));
          }
          
          // Delay between batches
          if (batchIdx < totalBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (err: any) {
          console.error(`Batch ${batchIdx + 1} failed:`, err);
          failCount++;
          setBatchSteps(prev => prev.map((step, idx) => 
            idx === batchIdx ? { ...step, status: "error" as const, error: err.message?.slice(0, 50) } : step
          ));
        }
      }

      setBatchSuccessCount(successCount);
      setBatchFailCount(failCount);
      setBatchComplete(true);

      // Refresh stakes data
      if (successCount > 0) {
        await fetchUserStakes();
      }
    } catch (error) {
      console.error('Batch claim error:', error);
      setBatchComplete(true);
    } finally {
      setClaimingAll(false);
    }
  }, [connected, publicKey, stakesWithRewards, batchClaimRewards, fetchUserStakes]);

  // Compound rewards handler - TRUE BATCH approach with modal
  const handleCompound = useCallback(async () => {
    if (!connected || !publicKey || stakesWithRewards.length === 0) return;

    const totalPools = stakesWithRewards.length;
    const totalBatches = Math.ceil(totalPools / MAX_COMPOUNDS_PER_TX);
    const txSaved = (totalPools * 2) - totalBatches; // 2 txs per pool (claim+stake) vs 1 batch tx

    // Initialize modal
    setBatchOperationType("compound");
    setBatchComplete(false);
    setBatchSuccessCount(0);
    setBatchFailCount(0);
    setCurrentBatchStep(0);
    setTotalPoolsInBatch(totalPools);
    setGasSaved(txSaved);
    
    // Create batch steps
    const steps: BatchTxStep[] = [];
    for (let i = 0; i < totalBatches; i++) {
      const startIdx = i * MAX_COMPOUNDS_PER_TX;
      const endIdx = Math.min(startIdx + MAX_COMPOUNDS_PER_TX, totalPools);
      const poolsInBatch = stakesWithRewards.slice(startIdx, endIdx);
      
      steps.push({
        id: `batch-compound-${i}`,
        batchNumber: i + 1,
        poolSymbols: poolsInBatch.map(p => p.poolSymbol),
        status: "pending",
      });
    }
    setBatchSteps(steps);
    setBatchModalOpen(true);
    setCompounding(true);

    let successCount = 0;
    let failCount = 0;

    try {
      // Process each batch
      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const startIdx = batchIdx * MAX_COMPOUNDS_PER_TX;
        const endIdx = Math.min(startIdx + MAX_COMPOUNDS_PER_TX, totalPools);
        const poolsInBatch = stakesWithRewards.slice(startIdx, endIdx);
        
        setCurrentBatchStep(batchIdx);
        
        // Update step to building
        setBatchSteps(prev => prev.map((step, idx) => 
          idx === batchIdx ? { ...step, status: "building" as const } : step
        ));

        try {
          // Call the batch compound function from useStakingProgram
          const result = await batchCompound(
            poolsInBatch.map(p => ({
              tokenMint: p.tokenMint,
              poolId: p.poolId,
              symbol: p.poolSymbol,
              rewardAmount: p.pendingRewards,
              decimals: p.decimals,
            })),
            (_, __, status, txSig) => {
              setBatchSteps(prev => prev.map((step, idx) => 
                idx === batchIdx 
                  ? { ...step, status: status === 'done' ? 'success' : status, txSignature: txSig } 
                  : step
              ));
            }
          );

          // Check result
          if (result[0]?.success) {
            successCount++;
            setBatchSteps(prev => prev.map((step, idx) => 
              idx === batchIdx ? { ...step, status: "success" as const, txSignature: result[0].txSignature } : step
            ));
          } else {
            failCount++;
            setBatchSteps(prev => prev.map((step, idx) => 
              idx === batchIdx ? { ...step, status: "error" as const, error: result[0]?.error } : step
            ));
          }
          
          // Delay between batches
          if (batchIdx < totalBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (err: any) {
          console.error(`Batch ${batchIdx + 1} failed:`, err);
          failCount++;
          setBatchSteps(prev => prev.map((step, idx) => 
            idx === batchIdx ? { ...step, status: "error" as const, error: err.message?.slice(0, 50) } : step
          ));
        }
      }

      setBatchSuccessCount(successCount);
      setBatchFailCount(failCount);
      setBatchComplete(true);

      // Refresh stakes data
      if (successCount > 0) {
        await fetchUserStakes();
      }
    } catch (error) {
      console.error('Batch compound error:', error);
      setBatchComplete(true);
    } finally {
      setCompounding(false);
    }
  }, [connected, publicKey, stakesWithRewards, batchCompound, fetchUserStakes]);

  const handleStakeNow = (poolId: string) => {
    router.push(`/pools?highlight=${poolId}`);
  };

  const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "stake":
        return <ArrowUpRight className="w-4 h-4 text-green-400" />;
      case "unstake":
        return <ArrowDownRight className="w-4 h-4 text-red-400" />;
      case "claim":
        return <Gift className="w-4 h-4" style={{ color: '#fb57ff' }} />;
      case "emergency_unstake":
        return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      default:
        return <ArrowUpRight className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case "stake":
        return "Staked";
      case "unstake":
        return "Unstaked";
      case "claim":
        return "Claimed Rewards";
      case "emergency_unstake":
        return "Emergency Unstake";
      default:
        return "Transaction";
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const explorerUrl = (sig: string) => {
    const cluster = process.env.NEXT_PUBLIC_NETWORK === "mainnet-beta" ? "" : "?cluster=devnet";
    return `https://solscan.io/tx/${sig}${cluster}`;
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(decimals)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(decimals)}K`;
    return num.toLocaleString(undefined, { maximumFractionDigits: decimals });
  };

  const formatUsd = (amount: number | null) => {
    if (amount === null || amount === 0) return null;
    if (amount < 0.01) return '< $0.01';
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2" style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Staking Dashboard
          </h1>
          <p className="text-sm sm:text-base text-gray-400">Your command center for StakePoint</p>
        </div>

        {/* Portfolio Summary Section - Only show when connected */}
        {connected && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Total Staked Card */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-gray-400 text-sm">Your Total Staked</div>
                <Wallet className="w-5 h-5" style={{ color: '#fb57ff' }} />
              </div>
              {userStakesLoading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-white/[0.05] rounded w-28 mb-1"></div>
                  <div className="h-4 bg-white/[0.05] rounded w-20"></div>
                </div>
              ) : (
                <>
                  <div className="text-2xl sm:text-3xl font-bold text-white">
                    {totalStakedUsd ? formatUsd(totalStakedUsd) : formatNumber(totalStakedValue)}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {totalStakedUsd 
                      ? `${formatNumber(totalStakedValue)} tokens · ${userStakes.length} pool${userStakes.length !== 1 ? 's' : ''}`
                      : `Across ${userStakes.length} pool${userStakes.length !== 1 ? 's' : ''}`
                    }
                  </div>
                </>
              )}
            </div>

            {/* Pending Rewards Card */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-gray-400 text-sm">Pending Rewards</div>
                <Gift className="w-5 h-5" style={{ color: '#fb57ff' }} />
              </div>
              {userStakesLoading || isPoolDataLoading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-white/[0.05] rounded w-24 mb-1"></div>
                  <div className="h-4 bg-white/[0.05] rounded w-28"></div>
                </div>
              ) : (
                <>
                  <div className="text-2xl sm:text-3xl font-bold" style={{ color: '#fb57ff' }}>
                    {totalPendingUsd ? formatUsd(totalPendingUsd) : formatNumber(totalPendingRewards, 4)}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {totalPendingUsd 
                      ? `${formatNumber(totalPendingRewards, 4)} tokens · ${stakesWithRewards.length} pool${stakesWithRewards.length !== 1 ? 's' : ''}`
                      : `From ${stakesWithRewards.length} pool${stakesWithRewards.length !== 1 ? 's' : ''} with rewards`
                    }
                  </div>
                </>
              )}
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-gray-400 text-sm">Quick Actions</div>
                <Zap className="w-5 h-5" style={{ color: '#fb57ff' }} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleClaimAll}
                  disabled={claimingAll || compounding || stakesWithRewards.length === 0 || isPoolDataLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    background: stakesWithRewards.length > 0 ? 'linear-gradient(45deg, #fb57ff, #9333ea)' : 'rgba(255,255,255,0.05)',
                    color: 'white'
                  }}
                >
                  {claimingAll ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Gift className="w-4 h-4" />
                  )}
                  Claim All
                </button>
                <button
                  onClick={handleCompound}
                  disabled={claimingAll || compounding || stakesWithRewards.length === 0 || isPoolDataLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/[0.1] hover:bg-white/[0.05]"
                >
                  {compounding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Compound
                </button>
              </div>
              {stakesWithRewards.length === 0 && !userStakesLoading && !isPoolDataLoading && (
                <p className="text-xs text-gray-500 mt-2 text-center">No rewards to claim</p>
              )}
            </div>
          </div>
        )}

        {/* Referral Stats Section - Only show when connected */}
        {connected && (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5" style={{ color: '#fb57ff' }} />
                <h2 className="text-lg font-bold text-white">Referral Program</h2>
              </div>
              <button
                onClick={() => router.push('/refer')}
                className="text-sm flex items-center gap-1 hover:opacity-80 transition-opacity"
                style={{ color: '#fb57ff' }}
              >
                View Details <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            {referralLoading ? (
              <div className="animate-pulse flex gap-6">
                <div className="h-12 bg-white/[0.05] rounded w-32"></div>
                <div className="h-12 bg-white/[0.05] rounded w-48"></div>
              </div>
            ) : referralStats && referralStats.totalReferrals > 0 ? (
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-2xl font-bold text-white">{referralStats.totalReferrals}</div>
                  <div className="text-sm text-gray-400">Pools Referred</div>
                </div>
                {referralStats.referredPools.length > 0 && (
                  <div className="flex-1">
                    <div className="text-sm text-gray-400 mb-2">Recent Referrals</div>
                    <div className="flex flex-wrap gap-2">
                      {referralStats.referredPools.slice(0, 5).map(pool => (
                        <div 
                          key={pool.id}
                          className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-1.5"
                        >
                          {pool.logo ? (
                            <img src={pool.logo} alt={pool.name} className="w-5 h-5 rounded-full" />
                          ) : (
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(251, 87, 255, 0.2)' }}>
                              {pool.symbol.slice(0, 1)}
                            </div>
                          )}
                          <span className="text-sm text-white">{pool.symbol}</span>
                          <span className="text-xs text-gray-500">{pool.referralSplitPercent}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-sm">
                Share your referral link and earn from every pool created through it.
                <button
                  onClick={() => router.push('/refer')}
                  className="ml-2 underline hover:opacity-80"
                  style={{ color: '#fb57ff' }}
                >
                  Get your link
                </button>
              </div>
            )}
          </div>
        )}

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
                      <p className="text-gray-400 text-xs truncate">{pool.symbol}</p>
                    </div>
                    <div className="w-full">
                      <p className="text-xl sm:text-2xl font-bold" style={{ color: '#fb57ff' }}>
                        {dynamicRates.get(pool.id)?.toFixed(2) ?? pool.apr ?? pool.apy ?? 0}%
                      </p>
                      <p className="text-xs text-gray-400">APR</p>
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
              <p className="text-gray-400 text-sm">No featured pools available</p>
              <p className="text-gray-600 text-xs mt-1">Set pools as featured in the admin panel</p>
            </div>
          )}
        </div>

        {/* Platform Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 sm:p-5 hover:bg-white/[0.04] transition-all">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="text-gray-400 text-xs sm:text-sm">Total Value Locked</div>
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
                  ${stats.totalValueLocked.toLocaleString(undefined, { 
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2 
                  })}
                </div>
                <div className="text-xs mt-1" style={{ color: '#fb57ff' }}>USD Value</div>
              </>
            )}
          </div>

          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 sm:p-5 hover:bg-white/[0.04] transition-all">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="text-gray-400 text-xs sm:text-sm">Total Stakers</div>
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
                <div className="text-xs mt-1" style={{ color: '#fb57ff' }}>Unique Wallets</div>
              </>
            )}
          </div>

          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 sm:p-5 hover:bg-white/[0.04] transition-all">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="text-gray-400 text-xs sm:text-sm">Unique Stakes</div>
              <Coins className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#fb57ff' }} />
            </div>
            {statsLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-white/[0.05] rounded w-16 mb-1"></div>
                <div className="h-3 bg-white/[0.05] rounded w-20"></div>
              </div>
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold text-white">
                  {stats.totalStakes.toLocaleString()}
                </div>
                <div className="text-xs mt-1" style={{ color: '#fb57ff' }}>Active Positions</div>
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
            activitiesLoading ? (
              <div className="space-y-2 sm:space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 sm:p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/[0.05]"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-white/[0.05] rounded w-24 mb-2"></div>
                        <div className="h-3 bg-white/[0.05] rounded w-16"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {activities.map((activity) => (
                  <div 
                    key={activity.id} 
                    className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 sm:p-4 hover:bg-white/[0.04] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div>
                          <div className="text-white font-semibold text-sm flex items-center gap-2">
                            {getActivityLabel(activity.type)}
                            {activity.pool && (
                              <span className="text-gray-400 font-normal">
                                • {activity.pool.symbol}
                              </span>
                            )}
                          </div>
                          <div className="text-gray-400 text-xs mt-0.5">
                            {formatTimeAgo(activity.timestamp)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {activity.amount > 0 && (
                          <div className="text-right">
                            <div className="text-sm font-medium text-white">
                              {activity.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </div>
                            <div className="text-xs text-gray-400">tokens</div>
                          </div>
                        )}
                        {activity.txSignature && (
                          <a
                            href={explorerUrl(activity.txSignature)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
                            title="View on Solscan"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-400 hover:text-white" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 sm:p-4">
                <div>
                  <div className="text-white font-semibold text-sm">No activity yet</div>
                  <div className="text-gray-400 text-xs mt-1">Your staking transactions will appear here</div>
                </div>
              </div>
            )
          ) : (
            <div className="text-center py-6 sm:py-8">
              <div className="text-sm sm:text-base text-gray-400">Connect your wallet to view activity</div>
            </div>
          )}
        </div>

      </div>

      {/* Batch Operation Modal */}
      <BatchOperationModal
        isOpen={batchModalOpen}
        onClose={() => {
          setBatchModalOpen(false);
          setBatchSteps([]);
        }}
        operationType={batchOperationType}
        steps={batchSteps}
        currentStepIndex={currentBatchStep}
        totalPools={totalPoolsInBatch}
        totalBatches={batchSteps.length}
        successCount={batchSuccessCount}
        failCount={batchFailCount}
        isComplete={batchComplete}
        gasSaved={gasSaved}
      />
    </div>
  );
}