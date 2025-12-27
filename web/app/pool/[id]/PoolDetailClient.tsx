"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { 
  ArrowLeft, 
  Lock, 
  Coins, 
  Clock, 
  TrendingUp, 
  Share2,
  ExternalLink,
  Sparkles,
  Info,
  Loader2,
  X,
  Code,
  Copy,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { useStakingProgram } from "@/hooks/useStakingProgram";
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { usePoolData } from "@/hooks/usePoolData";
import { useToast } from "@/components/ToastContainer";
import { useRealtimeRewards } from "@/utils/calculatePendingRewards";
import IntegrateModal from "@/components/IntegrateModal";
import { useSound } from '@/hooks/useSound';

// Helper function to safely convert decimal amounts to token units
function toTokenAmount(amount: number, decimals: number): string {
  const amountStr = amount.toString();
  const [whole, fraction = ''] = amountStr.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const combined = whole + paddedFraction;
  return combined.replace(/^0+/, '') || '0';
}

interface Pool {
  id: string;
  name: string;
  symbol: string;
  tokenAddress: string;
  tokenMint: string;
  logo: string | null;
  apy: number;
  rateBpsPerYear: number;
  rateMode: number;
  lockPeriodDays: number | null;
  duration: number;
  totalStaked: number | null;
  expectedRewards: number | null;
  isPaused: boolean;
  poolId: number | null;
  reflectionEnabled: boolean;
  reflectionType: string | null;
  reflectionMint: string | null;
  isInitialized: boolean;
  createdAt: Date;
  creatorWallet: string | null;
}

interface PoolDetailClientProps {
  pool: Pool;
}

export default function PoolDetailClient({ pool }: PoolDetailClientProps) {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { showToast } = useToast();
  const { playSound } = useSound();
  const [copied, setCopied] = useState(false);
  const [showIntegrateModal, setShowIntegrateModal] = useState(false);

  const [tokenDecimals, setTokenDecimals] = useState<number>(9);
  const decimalsMultiplier = useMemo(() => Math.pow(10, tokenDecimals), [tokenDecimals]);
  
  const effectiveMintAddress = pool.tokenAddress;
  const { balance: tokenBalance, loading: balanceLoading } = useSolanaBalance(effectiveMintAddress);
  
  const { loadAllPoolData, getPoolProject, isPoolDataLoading } = usePoolData();

  // Fee constants (same as PoolCard)
  const platformFeePercent = 2;
  const flatSolFee = 0.005;
  
  // Use database value as source of truth for initialization status
  const isInitialized = pool.isInitialized;
  const isPaused = pool.isPaused || false;
  const poolId = pool.poolId ?? 0;

  // Load pool data from blockchain on mount
  useEffect(() => {
    if (effectiveMintAddress && poolId !== undefined) {
      loadAllPoolData([{ tokenMint: effectiveMintAddress, poolId }]);
    }
  }, [effectiveMintAddress, poolId, loadAllPoolData]);

  useEffect(() => {
    if (!effectiveMintAddress || !connection) return;
    
    const fetchDecimals = async () => {
      try {
        const mintInfo = await connection.getParsedAccountInfo(new PublicKey(effectiveMintAddress));
        const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;
        setTokenDecimals(decimals);
      } catch (error) {
        console.error("Error fetching decimals:", error);
        setTokenDecimals(9);
      }
    };
    
    fetchDecimals();
  }, [effectiveMintAddress, connection, pool.symbol]);

  // Staking functionality
  const { 
    stake: blockchainStake, 
    unstake: blockchainUnstake, 
    claimRewards: blockchainClaimRewards,
    claimReflections: blockchainClaimReflections,
    refreshReflections,
    getUserStake,
    calculateRewards,
    getPoolRate,
    getProjectInfo,
  } = useStakingProgram();
  
  const [openModal, setOpenModal] = useState<"stake" | "unstake" | "claimRewards" | "claimReflections" | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [userStakedAmount, setUserStakedAmount] = useState<number>(0);
  const [userStakeTimestamp, setUserStakeTimestamp] = useState<number>(0);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [dynamicRate, setDynamicRate] = useState<number | null>(null);
  const [projectData, setProjectData] = useState<any>(null);
  const [stakeData, setStakeData] = useState<any>(null);
  const [reflectionBalance, setReflectionBalance] = useState<number>(0);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [userRewardsData, setUserRewardsData] = useState<number>(0);
  const [onChainTotalStaked, setOnChainTotalStaked] = useState<number>(0);
  const [isLoadingAPR, setIsLoadingAPR] = useState(true);

  // Get blockchain project data
  const blockchainProject = getPoolProject(effectiveMintAddress, poolId);
  
  // Fee calculation (same as PoolCard)
  const feeCalculation = useMemo(() => {
    if (!amount || amount <= 0) return { tokenFee: 0, solFee: flatSolFee, amountAfterFee: 0 };
    const tokenFee = (amount * platformFeePercent) / 100;
    const amountAfterFee = amount - tokenFee;
    return { tokenFee, solFee: flatSolFee, amountAfterFee };
  }, [amount, platformFeePercent, flatSolFee]);

  // Calculate display values from blockchain (same as PoolCard)
  const displayAPR = useMemo(() => {
    if (!blockchainProject) return dynamicRate ?? pool.apy ?? 0;
    
    if (blockchainProject.rateMode === 0) {
      // Locked pool - static APY
      return blockchainProject.rateBpsPerYear?.toNumber?.() 
        ? blockchainProject.rateBpsPerYear.toNumber() / 100 
        : (blockchainProject.rateBpsPerYear || 0) / 100;
    } else {
      // Variable pool - calculate APR
      const rewardRatePerSecond = BigInt(blockchainProject.rewardRatePerSecond?.toString() || '0');
      const totalStaked = BigInt(blockchainProject.totalStaked?.toString() || '1');
      
      if (totalStaked > 0n && rewardRatePerSecond > 0n) {
        const SECONDS_PER_YEAR = 31_536_000;
        const annualRewards = rewardRatePerSecond * BigInt(SECONDS_PER_YEAR);
        return Number((annualRewards * 10000n) / totalStaked) / 100;
      }
    }
    return dynamicRate ?? pool.apy ?? 0;
  }, [blockchainProject, dynamicRate, pool.apy]);

  // Get lock period and duration from blockchain
  const displayLockPeriod = useMemo(() => {
    if (blockchainProject?.lockupSeconds) {
      const days = Math.floor(blockchainProject.lockupSeconds.toNumber?.() 
        ? blockchainProject.lockupSeconds.toNumber() / 86400 
        : blockchainProject.lockupSeconds / 86400);
      return days > 0 ? days : null;
    }
    return pool.lockPeriodDays;
  }, [blockchainProject, pool.lockPeriodDays]);

  const displayDuration = useMemo(() => {
    if (blockchainProject?.poolDurationSeconds) {
      const seconds = blockchainProject.poolDurationSeconds.toNumber?.() 
        ? blockchainProject.poolDurationSeconds.toNumber() 
        : blockchainProject.poolDurationSeconds;
      return Math.floor(seconds / 86400);
    }
    return pool.duration;
  }, [blockchainProject, pool.duration]);

  // Get total staked from blockchain
  const displayTotalStaked = useMemo(() => {
    if (blockchainProject?.totalStaked) {
      const raw = blockchainProject.totalStaked.toString();
      return parseFloat(raw) / decimalsMultiplier;
    }
    return onChainTotalStaked || pool.totalStaked || 0;
  }, [blockchainProject, onChainTotalStaked, pool.totalStaked, decimalsMultiplier]);

  const realtimeRewards = useRealtimeRewards(projectData, stakeData);

  const shareUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/pool/${pool.id}` 
    : '';

  // Fetch user stake data
  useEffect(() => {
    if (!publicKey || !connected || !effectiveMintAddress || !isInitialized) return;

    const fetchUserStake = async () => {
      try {
        const userStake = await getUserStake(effectiveMintAddress, poolId);
        
        if (userStake) {
          setUserStakedAmount(userStake.amount / decimalsMultiplier);
          setUserStakeTimestamp(userStake.stakeTimestamp);
          setStakeData(userStake);

          const rewardsCalc = await calculateRewards(effectiveMintAddress, poolId);
          if (rewardsCalc !== null) {
            setUserRewardsData(rewardsCalc / decimalsMultiplier);
          }
        }
      } catch (error) {
        console.error("⚠️ Error fetching user stake:", error);
      }
    };

    fetchUserStake();
    const interval = setInterval(fetchUserStake, 60000);
    return () => clearInterval(interval);
  }, [publicKey, connected, effectiveMintAddress, poolId, isInitialized]);

  // Fetch SOL balance
  useEffect(() => {
    if (!publicKey || !connected || !connection) return;
    
    const fetchSolBalance = async () => {
      try {
        const balance = await connection.getBalance(publicKey);
        setSolBalance(balance / 1e9);
      } catch (error) {
        console.error("Error fetching SOL balance:", error);
      }
    };
    
    fetchSolBalance();
  }, [publicKey, connected, connection]);

  // Fetch project data and pool rate (for real-time data, not for initialization check)
  useEffect(() => {
    if (!effectiveMintAddress || !isInitialized) {
      setIsLoadingAPR(false);
      return;
    }

    const fetchProjectData = async () => {
      try {
        const project = await getProjectInfo(effectiveMintAddress, poolId);
        if (project) {
          setProjectData(project);
          
          // Get total staked from on-chain
          if (project.totalStaked) {
            const totalStaked = Number(project.totalStaked) / decimalsMultiplier;
            setOnChainTotalStaked(totalStaked);
          }
        }

        const rateData = await getPoolRate(effectiveMintAddress, poolId);
        if (rateData && rateData.rate !== null && rateData.rate !== undefined) {
          setDynamicRate(rateData.rate);
        }
        
        setIsLoadingAPY(false);
      } catch (error) {
        console.error("⚠️ Error fetching project data (non-critical):", error);
        setIsLoadingAPY(false);
      }
    };

    fetchProjectData();
    const interval = setInterval(fetchProjectData, 120000);
    return () => clearInterval(interval);
  }, [effectiveMintAddress, poolId, isInitialized, tokenDecimals]);

  // Fetch reflection balance
  useEffect(() => {
    if (!publicKey || !connected || !effectiveMintAddress || !pool.reflectionEnabled || !isInitialized) return;

    const fetchReflectionBalance = async () => {
      setReflectionLoading(true);
      try {
        const balance = await refreshReflections(effectiveMintAddress, poolId);
        if (balance !== null) {
          setReflectionBalance(balance / decimalsMultiplier);
        }
      } catch (error) {
        console.error("⚠️ Error fetching reflection balance:", error);
      } finally {
        setReflectionLoading(false);
      }
    };

    fetchReflectionBalance();
    const interval = setInterval(fetchReflectionBalance, 120000);
    return () => clearInterval(interval);
  }, [publicKey, connected, effectiveMintAddress, pool.reflectionEnabled, poolId, isInitialized]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${pool.name} Staking Pool`,
          text: `Stake ${pool.symbol} and earn rewards!`,
          url: shareUrl,
        });
      } catch (error) {
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatLockPeriod = (days: number | null) => {
    if (!days) return "Flexible";
    if (days >= 365) return `${Math.floor(days / 365)} year${days >= 730 ? 's' : ''}`;
    if (days >= 30) return `${Math.floor(days / 30)} month${days >= 60 ? 's' : ''}`;
    return `${days} days`;
  };

  const lockupInfo = useMemo(() => {
    if (!pool.lockPeriodDays || !userStakeTimestamp) {
      return { isLocked: false, remainingTime: 0, lockEndDate: null };
    }

    const lockPeriodMs = pool.lockPeriodDays * 24 * 60 * 60 * 1000;
    const stakeDate = new Date(userStakeTimestamp * 1000);
    const lockEndDate = new Date(stakeDate.getTime() + lockPeriodMs);
    const now = Date.now();
    const isLocked = now < lockEndDate.getTime();
    const remainingTime = Math.max(0, lockEndDate.getTime() - now);

    return { isLocked, remainingTime, lockEndDate };
  }, [pool.lockPeriodDays, userStakeTimestamp]);

  // Validation function (same as PoolCard)
  const validateTransaction = (): { valid: boolean; error?: string } => {
    if (!effectiveMintAddress) return { valid: false, error: "Pool not properly configured" };
    if (!isInitialized) return { valid: false, error: "Pool not initialized yet" };
    if (isPaused) return { valid: false, error: "Pool is paused" };

    if (openModal === "stake") {
      if (amount <= 0) return { valid: false, error: "Enter an amount" };
      if (amount > tokenBalance) return { valid: false, error: "Insufficient token balance" };
      const requiredSol = flatSolFee + 0.00089088;
      if (solBalance < requiredSol) return { valid: false, error: `Need ${requiredSol.toFixed(5)} SOL for fees` };
    }

    if (openModal === "unstake") {
      if (amount <= 0) return { valid: false, error: "Enter an amount" };
      if (amount > userStakedAmount) return { valid: false, error: "Cannot unstake more than staked" };
      if (lockupInfo.isLocked) return { valid: false, error: "Tokens are still locked" };
    }

    if (openModal === "claimRewards") {
      if (realtimeRewards <= 0) return { valid: false, error: "No rewards to claim" };
    }

    if (openModal === "claimReflections") {
      if (reflectionBalance <= 0) return { valid: false, error: "No reflections to claim" };
    }

    return { valid: true };
  };

  const handleQuickSelect = (percent: number) => {
    if (openModal === "stake") {
      setAmount((tokenBalance * percent) / 100);
    } else if (openModal === "unstake") {
      setAmount((userStakedAmount * percent) / 100);
    }
  };

  const handleModalSubmit = async () => {
    const validation = validateTransaction();
    if (!validation.valid) {
      playSound('error');
      showToast(`❌ ${validation.error}`, "error");
      return;
    }

    setIsProcessing(true);
    try {
      let txSignature: string | null = null;

      switch (openModal) {
        case "stake":
          const stakeAmount = toTokenAmount(amount, tokenDecimals);
          txSignature = await blockchainStake(effectiveMintAddress!, stakeAmount, poolId);
          
          playSound('success');
          showToast(`✅ Staked ${amount.toFixed(4)} ${pool.symbol}! TX: ${txSignature.slice(0, 8)}...`, "success");
                  
          try {
            await fetch("/api/user-stakes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                poolId: pool.id,
                walletAddress: publicKey?.toBase58(),
                amount: stakeAmount,
                transactionSignature: txSignature,
              }),
            });
          } catch (err) {
            console.error("Failed to save stake to DB:", err);
          }
          break;

        case "unstake":
          // Leave 0.1 token dust if user is unstaking 100% to preserve reward claim ability
          const dustAmount = 0.1;
          const isFullUnstake = amount >= userStakedAmount * 0.9999;
          const hasEnoughForDust = userStakedAmount > dustAmount * 2;
          
          const finalUnstakeAmount = (isFullUnstake && hasEnoughForDust) 
            ? amount - dustAmount 
            : amount;
          
          const unstakeAmount = toTokenAmount(finalUnstakeAmount, tokenDecimals);
          txSignature = await blockchainUnstake(effectiveMintAddress!, poolId, unstakeAmount);
          
          playSound('success');
          showToast(`✅ Unstaked ${amount.toFixed(4)} ${pool.symbol}! TX: ${txSignature.slice(0, 8)}...`, "success");
                  
          try {
            await fetch("/api/user-stakes", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                poolId: pool.id,
                walletAddress: publicKey?.toBase58(),
                amount: unstakeAmount,
                transactionSignature: txSignature,
              }),
            });
          } catch (err) {
            console.error("Failed to save unstake to DB:", err);
          }
          break;

        case "claimRewards":
          txSignature = await blockchainClaimRewards(effectiveMintAddress!, poolId);
          playSound('success');
          showToast(`✅ Claimed rewards! TX: ${txSignature.slice(0, 8)}...`, "success");
          break;

        case "claimReflections":
          txSignature = await blockchainClaimReflections(effectiveMintAddress!, poolId);
          playSound('success');
          showToast(`✅ Claimed reflections! TX: ${txSignature.slice(0, 8)}...`, "success");
          break;
      }

      setOpenModal(null);
      setAmount(0);
      
      // Refresh data after action
      setTimeout(async () => {
        try {
          const userStake = await getUserStake(effectiveMintAddress!, poolId);
          if (userStake) {
            setUserStakedAmount(userStake.amount / decimalsMultiplier);
            setUserStakeTimestamp(userStake.stakeTimestamp);
            setStakeData(userStake);
          }
          const project = await getProjectInfo(effectiveMintAddress!, poolId);
          setProjectData(project);
        } catch (error) {
          console.error("Error refreshing data:", error);
        }
      }, 2000);

    } catch (error: any) {
      // Handle "already processed" as success
      if (error.message?.includes("may have succeeded") || 
          error.message?.includes("already been processed") ||
          error.message?.includes("already processed")) {
        playSound('success');
        showToast(`✅ Transaction succeeded! Refreshing...`, "success");
        setTimeout(() => window.location.reload(), 1500);
        return;
      }
      
      playSound('error');
      let errorMessage = "Transaction failed";
      if (error.message.includes("User rejected")) {
        errorMessage = "Transaction cancelled";
      } else if (error.message.includes("insufficient")) {
        errorMessage = "Insufficient balance";
      } else if (error.message.includes("LockupNotExpired")) {
        errorMessage = "Tokens still locked";
      } else if (error.message.includes("ProjectPaused")) {
        errorMessage = "Pool is paused";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showToast(`❌ ${errorMessage}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const isStakeDisabled = !connected || !effectiveMintAddress || !isInitialized || isPaused;
  const isUnstakeDisabled = !connected || !effectiveMintAddress || !isInitialized || isPaused || userStakedAmount <= 0 || lockupInfo.isLocked;
  const isClaimDisabled = !connected || !effectiveMintAddress || !isInitialized || isPaused || realtimeRewards <= 0;
  const isClaimReflectionsDisabled = !connected || !effectiveMintAddress || !isInitialized || isPaused || reflectionBalance <= 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {pool.logo && (
              <img 
                src={pool.logo} 
                alt={pool.symbol} 
                className="w-20 h-20 rounded-full border-2 border-[#fb57ff]/30"
              />
            )}
            <div>
              <h1 className="text-4xl font-bold mb-2" style={{ 
                background: 'linear-gradient(45deg, white, #fb57ff)', 
                WebkitBackgroundClip: 'text', 
                WebkitTextFillColor: 'transparent' 
              }}>
                {pool.name}
              </h1>
              <p className="text-gray-400">{pool.symbol} Staking Pool</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowIntegrateModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg font-semibold transition-all text-white"
            >
              <Code className="w-5 h-5" />
              Integrate
            </button>

            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all"
            style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
          >
            {copied ? (
              <>
                <Info className="w-5 h-5" />
                Link Copied!
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                Share Pool
              </>
            )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Stats */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-[#fb57ff]" />
                <span className="text-sm text-gray-400">APR</span>
              </div>
              {isLoadingAPR ? (
                <p className="text-2xl font-bold text-gray-400">Loading...</p>
              ) : (
                <p className="text-2xl font-bold">{displayAPR.toFixed(2)}%</p>
              )}
            </div>

            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-[#fb57ff]" />
                <span className="text-sm text-gray-400">Lock Period</span>
              </div>
              <p className="text-2xl font-bold">{formatLockPeriod(displayLockPeriod)}</p>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-[#fb57ff]" />
                <span className="text-sm text-gray-400">Duration</span>
              </div>
              <p className="text-2xl font-bold">{displayDuration} days</p>
            </div>
          </div>

          {/* Your Position */}
          {connected && (
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Your Position</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Staked Amount</p>
                  <p className="text-2xl font-bold">
                    {userStakedAmount.toLocaleString()} {pool.symbol}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Pending Rewards</p>
                  <p className="text-2xl font-bold text-[#fb57ff]">
                    {realtimeRewards.toFixed(4)} {pool.symbol}
                  </p>
                </div>
                {pool.reflectionEnabled && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Reflection Rewards</p>
                    <p className="text-2xl font-bold text-[#fb57ff]">
                      {reflectionLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin inline" />
                      ) : (
                        `${reflectionBalance.toFixed(4)}`
                      )}
                    </p>
                  </div>
                )}
                {lockupInfo.isLocked && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Unlocks In</p>
                    <p className="text-lg font-bold">
                      {Math.ceil(lockupInfo.remainingTime / (1000 * 60 * 60 * 24))} days
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pool Information */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Pool Information</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total Staked</span>
                <span className="text-white font-mono">
                  {displayTotalStaked > 0 
                    ? `${displayTotalStaked.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pool.symbol}`
                    : `0 ${pool.symbol}`
                  }
                </span>
              </div>
              {pool.reflectionEnabled && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Reflection Type</span>
                  <span className="text-white font-mono capitalize">
                    {pool.reflectionType ?? 'N/A'}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Token Mint Address</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-white/[0.05] px-2 py-1 rounded">
                    {pool.tokenMint.slice(0, 8)}...{pool.tokenMint.slice(-8)}
                  </code>
                  <a
                    href={`https://solscan.io/token/${pool.tokenMint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#fb57ff] hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
              {projectData?.address && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Pool Public Key</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-white/[0.05] px-2 py-1 rounded">
                      {projectData.address.toString().slice(0, 8)}...{projectData.address.toString().slice(-8)}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(projectData.address.toString());
                        showToast('Copied pool address!', 'success');
                      }}
                      className="text-[#fb57ff] hover:underline"
                      title="Copy address"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <a
                      href={`https://solscan.io/account/${projectData.address.toString()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#fb57ff] hover:underline"
                      title="View on Solscan"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Pool ID</span>
                <span className="text-white font-mono text-xs break-all">
                  {pool.id}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Created</span>
                <span className="text-white">
                  {new Date(pool.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Action Card */}
        <div className="lg:col-span-1">
          <div className="bg-white/[0.02] border border-[#fb57ff]/30 rounded-lg p-6 sticky top-6">
            <h2 className="text-2xl font-bold mb-6 text-center">Actions</h2>
            
            {!connected ? (
              <div className="text-center">
                <p className="text-gray-400 mb-4">Connect your wallet to start staking</p>
                <Link href="/pools">
                  <button
                    className="w-full px-6 py-3 rounded-lg font-semibold transition-all"
                    style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                  >
                    Go to Pools Page
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => setOpenModal("stake")}
                  disabled={isStakeDisabled}
                  className="w-full px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                >
                  Stake Tokens
                </button>

                <button
                  onClick={() => setOpenModal("unstake")}
                  disabled={isUnstakeDisabled}
                  className="w-full px-6 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Unstake Tokens
                </button>

                <button
                  onClick={() => setOpenModal("claimRewards")}
                  disabled={isClaimDisabled}
                  className="w-full px-6 py-3 bg-[#fb57ff]/20 hover:bg-[#fb57ff]/30 border border-[#fb57ff]/50 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Claim Rewards
                </button>

                {pool.reflectionEnabled && (
                  <button
                    onClick={() => setOpenModal("claimReflections")}
                    disabled={isClaimReflectionsDisabled}
                    className="w-full px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Claim Reflections
                  </button>
                )}

                {isPaused && (
                  <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-500 text-center">
                      Pool is currently paused
                    </p>
                  </div>
                )}

                {lockupInfo.isLocked && (
                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-sm text-blue-400 text-center">
                      <Lock className="w-4 h-4 inline mr-1" />
                      Tokens locked for {Math.ceil(lockupInfo.remainingTime / (1000 * 60 * 60 * 24))} more days
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-white/[0.05]">
              <h3 className="text-sm font-semibold mb-3 text-gray-400">Share this pool</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white/[0.05] border border-white/[0.1] rounded text-sm text-gray-400"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-[#fb57ff]/20 hover:bg-[#fb57ff]/30 border border-[#fb57ff]/50 rounded transition-colors"
                >
                  {copied ? "✓" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL - Same style as PoolCard */}
      {openModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white/[0.02] border border-white/[0.05] p-4 sm:p-6 rounded-2xl shadow-2xl w-full max-w-[calc(100vw-24px)] sm:max-w-md max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                {openModal === "stake" && "💰"}
                {openModal === "unstake" && "📤"}
                {(openModal === "claimRewards" || openModal === "claimReflections") && "🎁"}
                <span className="truncate capitalize">{openModal.replace(/([A-Z])/g, ' $1').trim()}</span>
              </h2>
              <button
                onClick={() => { setOpenModal(null); setAmount(0); }}
                disabled={isProcessing}
                className="text-gray-400 hover:text-white transition-colors text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
              >
                ✕
              </button>
            </div>

            {/* Token Info */}
            <div className="bg-white/[0.02] border border-white/[0.05] p-2.5 sm:p-3 rounded-lg mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
              {pool.logo && <img src={pool.logo} alt={pool.name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold text-sm sm:text-base truncate">{pool.name}</p>
                <p className="text-gray-400 text-xs sm:text-sm">{pool.symbol}</p>
              </div>
            </div>

            {(openModal === "stake" || openModal === "unstake") && (
              <>
                {/* Balance Display */}
                <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <p className="text-gray-400 text-xs sm:text-sm font-semibold">
                      {openModal === "stake" ? "Available Balance" : "Staked Amount"}
                    </p>
                    {balanceLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  </div>
                  <p className="text-white font-bold text-xl sm:text-2xl break-all">
                    {openModal === "stake" 
                      ? `${tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${pool.symbol}`
                      : `${userStakedAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${pool.symbol}`
                    }
                  </p>
                </div>

                {/* Amount Input */}
                <div className="mb-3 sm:mb-4">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                    Amount to {openModal}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount || ''}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full p-2.5 sm:p-3 pr-12 sm:pr-16 rounded-lg bg-white/[0.02] text-white border border-white/[0.05] focus:border-[#fb57ff] focus:outline-none text-base sm:text-lg font-semibold"
                      placeholder="0.00"
                      disabled={isProcessing}
                      max={openModal === "stake" ? tokenBalance : userStakedAmount}
                    />
                    <span className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-xs sm:text-sm">
                      {pool.symbol}
                    </span>
                  </div>
                </div>

                {/* Fee Breakdown for Stake */}
                {openModal === "stake" && amount > 0 && (
                  <div className="mb-3 sm:mb-4 p-3 bg-white/[0.02] border border-white/[0.05] rounded-lg space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Stake Amount:</span>
                      <span className="text-white font-semibold">{amount.toFixed(4)} {pool.symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Token Fee ({platformFeePercent}%):</span>
                      <span className="text-yellow-400">-{feeCalculation.tokenFee.toFixed(4)} {pool.symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">SOL Fee:</span>
                      <span className="text-yellow-400">-{flatSolFee} SOL</span>
                    </div>
                    <div className="border-t border-white/[0.05] pt-2 flex justify-between">
                      <span className="font-semibold" style={{ color: '#fb57ff' }}>You'll Stake:</span>
                      <span className="font-bold" style={{ color: '#fb57ff' }}>{feeCalculation.amountAfterFee.toFixed(4)} {pool.symbol}</span>
                    </div>
                  </div>
                )}

                {/* Quick Select Buttons */}
                <div className="grid grid-cols-3 gap-2 mb-3 sm:mb-4">
                  {[25, 50, 100].map((percent) => (
                    <button
                      key={percent}
                      onClick={() => handleQuickSelect(percent)}
                      disabled={isProcessing}
                      className="px-2 py-2.5 sm:py-2 bg-white/[0.05] hover:bg-white/[0.08] active:bg-white/[0.1] border border-white/[0.05] rounded-lg text-xs sm:text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
                    >
                      {percent}%
                    </button>
                  ))}
                </div>

                {/* Range Slider */}
                <div className="mb-4 sm:mb-6">
                  <input
                    type="range"
                    min="0"
                    max={openModal === "stake" ? tokenBalance : userStakedAmount}
                    step={(openModal === "stake" ? tokenBalance : userStakedAmount) / 100}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    disabled={isProcessing}
                    className="w-full h-2 bg-white/[0.05] rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor: '#fb57ff' }}
                  />
                  <div className="flex justify-between text-[10px] sm:text-xs text-gray-400 mt-1">
                    <span>0</span>
                    <span>{(openModal === "stake" ? tokenBalance : userStakedAmount).toFixed(2)}</span>
                  </div>
                </div>

                {/* Warnings */}
                {openModal === "stake" && amount > 0 && solBalance < (flatSolFee + 0.00089088) && (
                  <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs sm:text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Need {(flatSolFee + 0.00089088).toFixed(5)} SOL for fees (you have {solBalance.toFixed(5)})</span>
                  </div>
                )}

                {openModal === "stake" && amount > tokenBalance && (
                  <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs sm:text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Insufficient balance</span>
                  </div>
                )}

                {openModal === "unstake" && lockupInfo.isLocked && (
                  <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2 text-yellow-400 text-xs sm:text-sm">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span>Unlocks in {Math.ceil(lockupInfo.remainingTime / (1000 * 60 * 60 * 24))} days</span>
                  </div>
                )}

                {openModal === "unstake" && amount > userStakedAmount && (
                  <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs sm:text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Cannot unstake more than staked amount</span>
                  </div>
                )}

                {openModal === "unstake" && realtimeRewards > 0 && !lockupInfo.isLocked && (
                  <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-xs sm:text-sm">
                    💡 You have unclaimed rewards! After unstaking, click "Claim Rewards" to collect them.
                  </div>
                )}
              </>
            )}

            {(openModal === "claimRewards" || openModal === "claimReflections") && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 text-xs sm:text-sm mb-1.5 sm:mb-2">
                  {openModal === "claimRewards" ? "Available to claim:" : "Available reflections:"}
                </p>
                <p className="text-white font-bold text-lg sm:text-xl break-all">
                  {openModal === "claimRewards" 
                    ? `${realtimeRewards.toFixed(4)} ${pool.symbol}`
                    : `${reflectionBalance.toFixed(4)} tokens`
                  }
                </p>
                {openModal === "claimRewards" && pool.lockPeriodDays && (
                  <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-1">
                    <p className="text-blue-400 text-xs font-medium">💡 Before you claim:</p>
                    <p className="text-blue-300 text-xs">
                      <strong>Want to keep earning?</strong> Claim now and restake your rewards — your lock timer restarts.
                    </p>
                    <p className="text-blue-300 text-xs">
                      <strong>Want to leave the pool?</strong> Unstake your tokens first, then claim your rewards.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => { setOpenModal(null); setAmount(0); }}
                disabled={isProcessing}
                className="flex-1 px-3 sm:px-4 py-3 bg-white/[0.05] hover:bg-white/[0.08] active:bg-white/[0.1] border border-white/[0.05] rounded-lg text-sm sm:text-base font-semibold transition-all disabled:opacity-50 min-h-[48px]"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSubmit}
                disabled={isProcessing || !validateTransaction().valid}
                className="flex-1 px-3 sm:px-4 py-3 rounded-lg text-sm sm:text-base font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px] text-white"
                style={{ background: (isProcessing || !validateTransaction().valid) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(45deg, black, #fb57ff)' }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Processing...</span>
                    <span className="sm:hidden">Wait...</span>
                  </>
                ) : (
                  <>
                    Confirm
                    {(openModal === "stake" || openModal === "unstake") && amount > 0 && (
                      <span className="hidden sm:inline"> {amount.toFixed(2)} {pool.symbol}</span>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Integrate Modal */}
      <IntegrateModal
        isOpen={showIntegrateModal}
        onClose={() => setShowIntegrateModal(false)}
        poolId={pool.id}
      />
    </div>
  );
}