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
  Copy
} from "lucide-react";
import Link from "next/link";
import { useStakingProgram } from "@/hooks/useStakingProgram";
import ManageLiquidityModal from "@/components/ManageLiquidityModal";
import { getDexInfo } from "@/lib/liquidity-router";
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { useToast } from "@/components/ToastContainer";
import { useRealtimeRewards } from "@/utils/calculatePendingRewards";
import IntegrateModal from "@/components/IntegrateModal";

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
  raydiumPoolAddress?: string | null;
  dexType?: string | null;
  dexPoolAddress?: string | null;
}

interface PoolDetailClientProps {
  pool: Pool;
}

export default function PoolDetailClient({ pool }: PoolDetailClientProps) {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showIntegrateModal, setShowIntegrateModal] = useState(false);
  const [showLiquidityModal, setShowLiquidityModal] = useState(false);

  const [tokenDecimals, setTokenDecimals] = useState<number>(9);
  const decimalsMultiplier = useMemo(() => Math.pow(10, tokenDecimals), [tokenDecimals]);
  
  const effectiveMintAddress = pool.tokenAddress;
  const { balance: tokenBalance, loading: balanceLoading } = useSolanaBalance(effectiveMintAddress);

  useEffect(() => {
    if (!effectiveMintAddress || !connection) return;
    
    const fetchDecimals = async () => {
      try {
        const mintInfo = await connection.getParsedAccountInfo(new PublicKey(effectiveMintAddress));
        const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;
        setTokenDecimals(decimals);
        console.log(`✅ Token decimals for ${pool.symbol}:`, decimals);
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
  const [isLoadingAPY, setIsLoadingAPY] = useState(true);

  // Use database value as source of truth for initialization status
  const isInitialized = pool.isInitialized;
  const isPaused = pool.isPaused || false;
  const poolId = pool.poolId ?? 0;

  // Calculate display APY (same logic as PoolCard)
  const displayAPY = dynamicRate ?? pool.apy ?? 0;

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

  // Fetch project data and pool rate (for real-time data, not for initialization check)
  useEffect(() => {
    if (!effectiveMintAddress || !isInitialized) {
      setIsLoadingAPY(false);
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
            console.log(`🔢 Total Staked calculation: ${project.totalStaked} / ${decimalsMultiplier} = ${totalStaked}`);
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
        // Don't throw - this is just for real-time data
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
        // User cancelled or share failed, fallback to copy
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

  const handleModalSubmit = async () => {
    if (!effectiveMintAddress || !openModal) return;

    setIsProcessing(true);
    try {
      let txSignature: string | null = null;

      switch (openModal) {
        case "stake":
          const stakeAmount = Math.floor(amount * decimalsMultiplier);
          txSignature = await blockchainStake(effectiveMintAddress, stakeAmount, poolId);
          
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
          const unstakeAmount = Math.floor(amount * decimalsMultiplier);
          txSignature = await blockchainUnstake(effectiveMintAddress, poolId, unstakeAmount);
          
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
          txSignature = await blockchainClaimRewards(effectiveMintAddress, poolId);
          break;

        case "claimReflections":
          if (pool.reflectionMint) {
            txSignature = await blockchainClaimReflections(effectiveMintAddress, poolId, pool.reflectionMint);
          }
          break;
      }

      if (txSignature) {
        showToast(
          `${openModal.charAt(0).toUpperCase() + openModal.slice(1)} successful!`,
          "success"
        );
      }

      setOpenModal(null);
      setAmount(0);
      
      // Refresh data
      const userStake = await getUserStake(effectiveMintAddress, poolId);
      if (userStake) {
        setUserStakedAmount(userStake.amount / decimalsMultiplier);
        setUserStakeTimestamp(userStake.stakeTimestamp);
        setStakeData(userStake);
      }
    } catch (error: any) {
      console.error(`${openModal} error:`, error);
      showToast(
        error.message || `Failed to ${openModal}`,
        "error"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const lockupInfo = (() => {
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
  })();

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
                <span className="text-sm text-gray-400">APY</span>
              </div>
              {isLoadingAPY ? (
                <p className="text-2xl font-bold text-gray-400">Loading...</p>
              ) : (
                <p className="text-2xl font-bold">{displayAPY.toFixed(2)}%</p>
              )}
            </div>

            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-[#fb57ff]" />
                <span className="text-sm text-gray-400">Lock Period</span>
              </div>
              <p className="text-2xl font-bold">{formatLockPeriod(pool.lockPeriodDays)}</p>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-[#fb57ff]" />
                <span className="text-sm text-gray-400">Duration</span>
              </div>
              <p className="text-2xl font-bold">{pool.duration} days</p>
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
                  {onChainTotalStaked > 0 
                    ? `${onChainTotalStaked.toLocaleString()} ${pool.symbol}`
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
              {pool.dexType && pool.dexPoolAddress && (
                <>
                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
                    <span className="text-gray-400">DEX</span>
                    {(() => {
                      const dexInfo = getDexInfo(pool.dexType as any);
                      return (
                        <div 
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                          style={{ 
                            background: `${dexInfo.color}20`,
                            border: `1px solid ${dexInfo.color}50`,
                            color: dexInfo.color 
                          }}
                        >
                          <span>{dexInfo.icon}</span>
                          <span>{dexInfo.displayName}</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Pool/Pair Address</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-white/[0.05] px-2 py-1 rounded">
                        {pool.dexPoolAddress.slice(0, 8)}...{pool.dexPoolAddress.slice(-8)}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(pool.dexPoolAddress!);
                          showToast('Copied DEX pool address!', 'success');
                        }}
                        className="text-[#fb57ff] hover:underline"
                        title="Copy address"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={getDexInfo(pool.dexType as any).url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#fb57ff] hover:underline"
                        title={`View on ${getDexInfo(pool.dexType as any).displayName}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </>
              )}
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
                {/* Manage Liquidity Button - Show if either field exists */}
                {(pool.dexPoolAddress || pool.raydiumPoolAddress) && pool.dexType && (
                  <button
                    onClick={() => setShowLiquidityModal(true)}
                    className="w-full px-6 py-3 rounded-lg font-semibold transition-all"
                    style={{ background: 'linear-gradient(45deg, #6366f1, #8b5cf6)' }}
                  >
                    💧 Manage Liquidity
                  </button>
                )}

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

      {/* Modal */}
      {openModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black/90 rounded-2xl max-w-md w-full border border-white/[0.05] p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold capitalize">{openModal.replace(/([A-Z])/g, ' $1').trim()}</h3>
              <button
                onClick={() => {
                  setOpenModal(null);
                  setAmount(0);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {(openModal === "stake" || openModal === "unstake") && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">
                    Amount ({pool.symbol})
                  </label>
                  <input
                    type="number"
                    value={amount || ''}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#fb57ff]/50"
                  />
                  <div className="flex items-center justify-between mt-2 text-sm">
                    <span className="text-gray-400">
                      Available: {openModal === "stake" ? tokenBalance.toFixed(4) : userStakedAmount.toFixed(4)} {pool.symbol}
                    </span>
                    <button
                      onClick={() => setAmount(openModal === "stake" ? tokenBalance : userStakedAmount)}
                      className="text-[#fb57ff] hover:underline"
                    >
                      Max
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleModalSubmit}
                  disabled={isProcessing || amount <= 0}
                  className="w-full px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `${openModal.charAt(0).toUpperCase() + openModal.slice(1)}`
                  )}
                </button>
              </div>
            )}

            {(openModal === "claimRewards" || openModal === "claimReflections") && (
              <div className="space-y-4">
                <div className="p-4 bg-[#fb57ff]/10 border border-[#fb57ff]/30 rounded-lg">
                  <p className="text-sm text-gray-300 text-center">
                    {openModal === "claimRewards" 
                      ? `You will claim ${realtimeRewards.toFixed(4)} ${pool.symbol}`
                      : `You will claim ${reflectionBalance.toFixed(4)} reflection tokens`
                    }
                  </p>
                </div>

                <button
                  onClick={handleModalSubmit}
                  disabled={isProcessing}
                  className="w-full px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    'Confirm Claim'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Integrate Modal */}
      <IntegrateModal
        isOpen={showIntegrateModal}
        onClose={() => setShowIntegrateModal(false)}
        poolId={pool.id}
      />

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
          rewardTokenSymbol={pool.symbol}
        />
      )}
    </div>
  );
}