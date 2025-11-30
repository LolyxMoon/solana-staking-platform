"use client";
import { useEffect, useState, useMemo } from "react";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { useSolanaBalance } from '@/hooks/useSolanaBalance';
import { useStakingProgram } from '@/hooks/useStakingProgram';
import { useToast } from "@/components/ToastContainer";
import { LoadingSpinner } from "@/components/SkeletonLoaders";
import { useRealtimeRewards, formatRewards } from "@/utils/calculatePendingRewards";
import { 
  Lock, 
  Unlock, 
  Coins,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Sparkles,
  Repeat
} from "lucide-react";

const priceCache = new Map<string, {
  price: number | null;
  priceChange24h: number | null;
  timestamp: number;
}>();

// 🔒 GLOBAL REQUEST QUEUE - Prevents all pools from hitting RPC at once
let lastRpcCall = 0;
const MIN_RPC_DELAY = 2000; // 2 seconds between ANY RPC call across all pools

async function waitForRpcSlot() {
  const now = Date.now();
  const timeSinceLastCall = now - lastRpcCall;
  
  if (timeSinceLastCall < MIN_RPC_DELAY) {
    const waitTime = MIN_RPC_DELAY - timeSinceLastCall;
    console.log(`⏳ Waiting ${waitTime}ms before next RPC call...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRpcCall = Date.now();
}

const CACHE_DURATION = 120000; // 2 minutes
const TOKEN_DECIMALS = 9;
const DECIMALS_MULTIPLIER = Math.pow(10, TOKEN_DECIMALS);

interface PoolCardProps {
  id: string;
  poolId?: number; // ✅ NEW: Pool number (0, 1, 2...)
  tokenMint?: string; // ✅ NEW: Token mint address
  name: string;
  symbol: string;
  apr?: string;
  apy?: string | number;
  type: string;
  lockPeriod?: number | string;
  totalStaked?: string;
  rewards?: string;
  logo?: string;
  pairAddress?: string;
  mintAddress?: string;
  hasSelfReflections?: boolean;
  hasExternalReflections?: boolean;
  externalReflectionMint?: string;
  featured?: boolean;
  isPaused?: boolean;
  poolEndTime?: number;
  isInitialized?: boolean;
  platformFeePercent?: number;
  flatSolFee?: number;
  reflectionTokenAccount?: string;
  reflectionTokenSymbol?: string;
  showPoolNumber?: boolean; // ✅ NEW
  totalPoolsForToken?: number; // ✅ NEW
}

export default function PoolCard(props: PoolCardProps) {
  const { 
    id, 
    poolId = 0, // ✅ NEW: Default to 0
    tokenMint, // ✅ NEW
    name, 
    symbol, 
    apr, 
    apy, 
    type, 
    lockPeriod, 
    totalStaked, 
    rewards, 
    logo, 
    pairAddress, 
    mintAddress, 
    hasSelfReflections, 
    hasExternalReflections, 
    externalReflectionMint, 
    featured,
    isPaused, 
    poolEndTime, 
    isInitialized,
    platformFeePercent = 2,
    flatSolFee = 0.005,
    reflectionTokenAccount,
    reflectionTokenSymbol,
    showPoolNumber = false, // ✅ NEW
    totalPoolsForToken = 1, // ✅ NEW
  } = props;

  // ✅ Use tokenMint if available, fallback to mintAddress
  const effectiveMintAddress = tokenMint || mintAddress;

  // ✅ ADD THIS DEBUG LOG HERE
  console.log('🔍 PoolCard Debug:', { 
    name, 
    symbol,
    poolId, // ✅ NEW
    tokenMint: effectiveMintAddress, // ✅ NEW
    showPoolNumber, // ✅ NEW
    hasSelfReflections, 
    hasExternalReflections,
    externalReflectionMint,
    reflectionTokenSymbol
  });

  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { showSuccess, showError, showWarning } = useToast();
  
  const { balance: tokenBalance, loading: balanceLoading } = useSolanaBalance(effectiveMintAddress);
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

  const [price, setPrice] = useState<number | null>(null);
  const [priceChange24h, setPriceChange24h] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [openModal, setOpenModal] = useState<"stake" | "unstake" | "claimRewards" | "claimSelf" | "claimExternal" | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [userStakedAmount, setUserStakedAmount] = useState<number>(0);
  const [userStakeTimestamp, setUserStakeTimestamp] = useState<number>(0);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [dynamicRate, setDynamicRate] = useState<number | null>(null);

  const [projectData, setProjectData] = useState<any>(null);
  const [stakeData, setStakeData] = useState<any>(null);
  
  // ✨ Reflection balance state
  const [reflectionBalance, setReflectionBalance] = useState<number>(0);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  
  // ✅ Restore useRealtimeRewards - but it should only update every 10s, not every second
  const realtimeRewards = useRealtimeRewards(projectData, stakeData);

  const [currentTime, setCurrentTime] = useState<number>(Math.floor(Date.now() / 1000));

  // Update current time every 10 seconds for realtime rewards
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 10000); // Update every 10 seconds
    
    return () => clearInterval(interval);
  }, []);

  // ✨ Fetch reflection balance - USER'S PENDING REFLECTIONS
  useEffect(() => {
    if (!connected || !reflectionTokenAccount || !publicKey) {
      setReflectionBalance(0);
      return;
    }

    const fetchReflectionBalance = async () => {
      setReflectionLoading(true);
      try {
        // Get fresh project and stake data
        const project = await getProjectInfo(effectiveMintAddress, poolId);
        const userStake = await getUserStake(effectiveMintAddress, poolId);
        
        if (!project || !userStake || !project.reflectionVault) {
          console.log(`⚠️ [${name}] No reflection data available`);
          setReflectionBalance(0);
          return;
        }

        // Get user's staked amount (in lamports)
        const userStakedAmountLamports = userStake.amount.toNumber();
        
        if (userStakedAmountLamports === 0) {
          console.log(`⚠️ [${name}] User has no stake`);
          setReflectionBalance(0);
          return;
        }

        // Get reflection rates
        const userReflectionPerTokenPaid = userStake.reflectionPerTokenPaid 
          ? userStake.reflectionPerTokenPaid.toNumber() 
          : 0;
        
        const currentReflectionPerToken = project.reflectionPerTokenStored 
          ? project.reflectionPerTokenStored.toNumber() 
          : 0;

        // Calculate pending reflections
        const rateDifference = currentReflectionPerToken - userReflectionPerTokenPaid;
        const pendingReflectionsLamports = (rateDifference * userStakedAmountLamports) / DECIMALS_MULTIPLIER;
        const pendingReflections = pendingReflectionsLamports / LAMPORTS_PER_SOL;

        console.log(`🔍 [${name}] Reflection Calculation:`, {
          userStakedLamports: userStakedAmountLamports,
          userStakedTokens: userStakedAmountLamports / DECIMALS_MULTIPLIER,
          userRate: userReflectionPerTokenPaid,
          currentRate: currentReflectionPerToken,
          rateDiff: rateDifference,
          pendingLamports: pendingReflectionsLamports,
          pendingTokens: pendingReflections,
          reflectionToken: project.reflectionToken?.toString(),
          isNativeSOL: project.reflectionToken?.toString() === "So11111111111111111111111111111111111111112"
        });

        setReflectionBalance(Math.max(0, pendingReflections));

        } catch (error: any) {
          console.error(`❌ [${name}] Error fetching reflection balance:`, error);
          setReflectionBalance(0);
        } finally {
          setReflectionLoading(false);
        }
        };

        fetchReflectionBalance();
    
    // Refresh reflection balance every 10 seconds (same as rewards)
    const interval = setInterval(fetchReflectionBalance, 10000);
    return () => clearInterval(interval);
  }, [connected, publicKey, effectiveMintAddress, poolId, name, stakeData]);

  const lockupInfo = useMemo(() => {
    if (!lockPeriod || type !== "locked" || !userStakeTimestamp) {
      return { isLocked: false, remainingSeconds: 0, unlocksAt: null, canClaim: true };
    }

    const lockSeconds = typeof lockPeriod === 'string' ? parseInt(lockPeriod) * 86400 : lockPeriod * 86400;
    const unlocksAt = userStakeTimestamp + lockSeconds;
    const remainingSeconds = Math.max(0, unlocksAt - currentTime);
    
    return {
      isLocked: remainingSeconds > 0,
      remainingSeconds,
      unlocksAt: new Date(unlocksAt * 1000),
      canClaim: true, // ✅ Always true - claims are always allowed
    };
  }, [lockPeriod, type, userStakeTimestamp, currentTime]);

  const poolEndInfo = useMemo(() => {
    if (!poolEndTime) return { hasEnded: false, endsAt: null, remainingSeconds: 0 };
    
    const remainingSeconds = Math.max(0, poolEndTime - currentTime);
    
    return {
      hasEnded: remainingSeconds === 0,
      endsAt: new Date(poolEndTime * 1000),
      remainingSeconds,
    };
  }, [poolEndTime, currentTime]);

  const feeCalculation = useMemo(() => {
    if (!amount || amount <= 0) return { tokenFee: 0, solFee: flatSolFee, amountAfterFee: 0 };
    
    const tokenFee = (amount * platformFeePercent) / 100;
    const amountAfterFee = amount - tokenFee;
    
    return {
      tokenFee,
      solFee: flatSolFee,
      amountAfterFee,
    };
  }, [amount, platformFeePercent, flatSolFee]);

  // 🔍 CONSOLIDATED + RATE LIMITED: Fetch ALL data with global rate limiting
  useEffect(() => {
    if (!connected || !effectiveMintAddress) {
      console.warn(`⚠️ [${name}] Skipping data fetch - Connected: ${connected}, MintAddress: ${!!effectiveMintAddress}`);
      return;
    }

    const fetchAllData = async () => {
      // 🔒 WAIT FOR RPC SLOT - This prevents multiple pools from calling at once
      await waitForRpcSlot();
      
      console.log(`📡 [${name}] Fetching ALL data at ${new Date().toLocaleTimeString()}...`);
      
      try {
        // 1. Fetch dynamic rate (ONCE, not repeated)
        if (dynamicRate === null) {
          console.log(`  ↳ Getting pool rate for ${effectiveMintAddress.slice(0, 8)} poolId: ${poolId}...`);
          try {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between calls
            const result = await getPoolRate(effectiveMintAddress, poolId);
            console.log(`✅ [${name}] Got rate:`, result);
            setDynamicRate(result.rate);
            console.log(`📊 ${name} - ${result.type.toUpperCase()}: ${result.rate.toFixed(2)}%`);
          } catch (error) {
            console.error(`❌ [${name}] Error fetching pool rate:`, error);
          }
        }

        // 2. Fetch SOL balance
        if (publicKey) {
          try {
            await waitForRpcSlot(); // 🔒 Wait before SOL balance call
            const balance = await connection.getBalance(publicKey);
            setSolBalance(balance / LAMPORTS_PER_SOL);
            console.log(`💵 [${name}] SOL Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)}`);
          } catch (error) {
            console.error(`❌ [${name}] Error fetching SOL balance:`, error);
          }
        }

        // 3. Fetch user stake
        await waitForRpcSlot(); // 🔒 Wait before user stake call
        console.log(`  ↳ Getting user stake for ${effectiveMintAddress.slice(0, 8)} poolId: ${poolId}...`);
        const userStake = await getUserStake(effectiveMintAddress, poolId);
        
        if (userStake) {
          console.log(`✅ [${name}] Got user stake:`, {
            amount: userStake.amount?.toString(),
            lastStakeTimestamp: userStake.lastStakeTimestamp?.toString(),
            rewardPerTokenPaid: userStake.rewardPerTokenPaid?.toString(),
            rewardsPending: userStake.rewardsPending?.toString(),
          });
          setUserStakedAmount(userStake.amount.toNumber() / DECIMALS_MULTIPLIER);
          setUserStakeTimestamp(userStake.lastStakeTimestamp?.toNumber() || 0);
          setStakeData(userStake);
        } else {
          console.warn(`⚠️ [${name}] No user stake found`);
          setStakeData(null);
          setUserStakedAmount(0);
          setUserStakeTimestamp(0);
        }

        // 4. Fetch project info
        await waitForRpcSlot(); // 🔒 Wait before project info call
        console.log(`  ↳ Getting project info for ${effectiveMintAddress.slice(0, 8)} poolId: ${poolId}...`);
        const project = await getProjectInfo(effectiveMintAddress, poolId);
        
        if (project) {
          console.log(`✅ [${name}] Got project info:`, {
            rewardRatePerSecond: project.rewardRatePerSecond?.toString(),
            totalStaked: project.totalStaked?.toString(),
            rateMode: project.rateMode,
            rateBpsPerYear: project.rateBpsPerYear?.toString(),
          });
          setProjectData(project);
        } else {
          console.warn(`⚠️ [${name}] No project info found`);
          setProjectData(null);
        }
        
        console.log(`✅ [${name}] All data fetch complete`);
      } catch (error) {
        console.error(`❌ [${name}] Error fetching data:`, error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    };

    console.log(`🔄 [${name}] Setting up 2-minute interval for ALL data fetching`);
    fetchAllData(); // Initial fetch
    
    // ✅ Randomize interval between 120-150 seconds to prevent all pools syncing
    const randomInterval = 120000 + Math.random() * 30000;
    const interval = setInterval(fetchAllData, randomInterval);
    
    return () => {
      console.log(`🛑 [${name}] Clearing interval`);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, effectiveMintAddress, poolId]); // ✅ Added poolId to dependencies

  // 🔄 Price fetching
  useEffect(() => {
    if (!pairAddress) {
      setPriceLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchPrice() {
      const cached = priceCache.get(pairAddress);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        if (isMounted) {
          setPrice(cached.price);
          setPriceChange24h(cached.priceChange24h);
          setPriceLoading(false);
        }
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`,
          { signal: controller.signal, cache: 'no-store' }
        );

        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();
        const pairData = data?.pairs?.[0];
        
        if (isMounted && pairData) {
          const priceValue = parseFloat(pairData.priceUsd) || null;
          const priceChangeValue = parseFloat(pairData.priceChange?.h24 || 0);
          
          setPrice(priceValue);
          setPriceChange24h(priceChangeValue);
          setPriceLoading(false);
          
          priceCache.set(pairAddress, {
            price: priceValue,
            priceChange24h: priceChangeValue,
            timestamp: Date.now()
          });
        } else if (isMounted) {
          setPriceLoading(false);
        }
      } catch (err) {
        console.error(`Error fetching price for ${symbol}:`, err);
        if (isMounted) setPriceLoading(false);
      }
    }

    fetchPrice();
    const interval = setInterval(() => {
      if (isMounted) fetchPrice();
    }, 120000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pairAddress, symbol]);

  const handleQuickSelect = (percent: number) => {
    if (openModal === "stake") {
      setAmount((tokenBalance * percent) / 100);
    } else if (openModal === "unstake") {
      setAmount((userStakedAmount * percent) / 100);
    }
  };

  const validateTransaction = (): { valid: boolean; error?: string } => {
    if (!effectiveMintAddress) {
      return { valid: false, error: "Pool not properly configured" };
    }

    if (!isInitialized) {
      return { valid: false, error: "Pool not initialized yet" };
    }

    if (isPaused) {
      return { valid: false, error: "Pool is paused" };
    }

    if (openModal === "stake") {
      if (poolEndInfo.hasEnded) {
        return { valid: false, error: "Pool has ended" };
      }
      if (amount <= 0) {
        return { valid: false, error: "Enter an amount" };
      }
      if (amount > tokenBalance) {
        return { valid: false, error: "Insufficient token balance" };
      }
      const requiredSol = flatSolFee + 0.00089088;
      if (solBalance < requiredSol) {
        return { valid: false, error: `Need ${requiredSol.toFixed(5)} SOL for fees` };
      }
    }

    if (openModal === "unstake") {
      if (amount <= 0) {
        return { valid: false, error: "Enter an amount" };
      }
      if (amount > userStakedAmount) {
        return { valid: false, error: "Cannot unstake more than staked" };
      }
      if (lockupInfo.isLocked) {
        return { valid: false, error: "Tokens are still locked" };
      }
    }

    if (openModal === "claimRewards") {
      if (realtimeRewards <= 0) {
        return { valid: false, error: "No rewards to claim" };
      }
    }

    if (openModal === "claimSelf" || openModal === "claimExternal") {
      if (reflectionBalance <= 0) {
        return { valid: false, error: "No reflections to claim" };
      }
    }

    return { valid: true };
  };

  const handleConfirmAction = async () => {
    const validation = validateTransaction();
    if (!validation.valid) {
      showError(`❌ ${validation.error}`);
      return;
    }

    setIsProcessing(true);

    try {
      let txSignature: string;

      switch (openModal) {
        case "stake":
          const stakeAmount = Math.floor(amount * DECIMALS_MULTIPLIER);
          txSignature = await blockchainStake(effectiveMintAddress!, stakeAmount, poolId);
          showSuccess(`✅ Staked ${amount.toFixed(4)} ${symbol}! TX: ${txSignature.slice(0, 8)}...`);
          break;

        case "unstake":
          const unstakeAmount = Math.floor(amount * DECIMALS_MULTIPLIER);
          txSignature = await blockchainUnstake(effectiveMintAddress!, poolId, unstakeAmount);
          showSuccess(`✅ Unstaked ${amount.toFixed(4)} ${symbol}! TX: ${txSignature.slice(0, 8)}...`);
          break;

        case "claimRewards":
          txSignature = await blockchainClaimRewards(effectiveMintAddress!, poolId);
          showSuccess(`✅ Claimed rewards! TX: ${txSignature.slice(0, 8)}...`);
          break;

        case "claimSelf":
          // ✅ FIX: Validate reflection vault exists
          if (!projectData?.reflectionVault) {
            showError("❌ Reflections not enabled for this pool");
            return;
          }
          console.log("🔍 Claiming reflections with:", {
            mintAddress,
            projectData: projectData,
            reflectionVault: projectData?.reflectionVault?.toString(),
          });
          txSignature = await blockchainClaimReflections(effectiveMintAddress!, poolId);
          
          // ✅ AUTO-REFRESH: Update reflection calculations
          try {
            await refreshReflections(effectiveMintAddress!, poolId);
          } catch (refreshErr) {
            console.error("Auto-refresh failed (non-critical):", refreshErr);
          }
          
          showSuccess(`✅ Claimed reflections! TX: ${txSignature.slice(0, 8)}...`);
          break;

        case "claimExternal":
          // ✅ FIX: Validate reflection vault and external mint
          if (!projectData?.reflectionVault) {
            showError("❌ Reflections not enabled for this pool");
            return;
          }
          if (!externalReflectionMint) {
            showError("❌ External reflection mint not configured");
            return;
          }
          console.log("🔍 Claiming external reflections with:", {
            mintAddress,
            externalReflectionMint,
            projectData: projectData,
            reflectionVault: projectData?.reflectionVault?.toString(),
          });
          txSignature = await blockchainClaimReflections(effectiveMintAddress!, poolId);
          
          // ✅ AUTO-REFRESH: Update reflection calculations
          try {
            await refreshReflections(effectiveMintAddress!, poolId);
          } catch (refreshErr) {
            console.error("Auto-refresh failed (non-critical):", refreshErr);
          }
          
          showSuccess(`✅ Claimed external reflections! TX: ${txSignature.slice(0, 8)}...`);
          break;

        default:
          throw new Error("Unknown action");
      }

      setTimeout(async () => {
        try {
          const userStake = await getUserStake(effectiveMintAddress!, poolId);
          if (userStake) {
            setUserStakedAmount(userStake.amount.toNumber() / DECIMALS_MULTIPLIER);
            setUserStakeTimestamp(userStake.lastStakeTimestamp?.toNumber() || 0);
            setStakeData(userStake);
          }
          const project = await getProjectInfo(effectiveMintAddress!, poolId);
          setProjectData(project);
        } catch (error) {
          console.error("Error refreshing user data:", error);
        }
      }, 2000);

      closeModal();
    } catch (error: any) {
      console.error("Transaction error:", error);
      
      // ✅ Handle "already processed" as success
      if (error.message?.includes("may have succeeded") || 
          error.message?.includes("already been processed") ||
          error.message?.includes("already processed")) {
        
        showSuccess(`✅ Transaction succeeded! Refreshing...`);
        
        // Refresh data
        setTimeout(async () => {
          try {
            const userStake = await getUserStake(effectiveMintAddress!, poolId);
            if (userStake) {
              setUserStakedAmount(userStake.amount.toNumber() / DECIMALS_MULTIPLIER);
              setUserStakeTimestamp(userStake.lastStakeTimestamp?.toNumber() || 0);
              setStakeData(userStake);
            }
            const project = await getProjectInfo(effectiveMintAddress!, poolId);
            setProjectData(project);
            
            closeModal();
            window.location.reload(); // Full refresh to ensure UI is updated
          } catch (refreshError) {
            console.error("Error refreshing:", refreshError);
            window.location.reload(); // Fallback to full page refresh
          }
        }, 1500);
        
        return; // Don't show error
      }
      
      // Handle other errors
      let errorMessage = "Transaction failed";
      if (error.message.includes("User rejected")) {
        errorMessage = "Transaction cancelled";
      } else if (error.message.includes("insufficient")) {
        errorMessage = "Insufficient balance";
      } else if (error.message.includes("LockupNotExpired")) {
        errorMessage = "Tokens still locked";
      } else if (error.message.includes("ProjectPaused")) {
        errorMessage = "Pool is paused";
      } else if (error.message.includes("DepositsPaused")) {
        errorMessage = "Deposits paused";
      } else if (error.message.includes("WithdrawalsPaused")) {
        errorMessage = "Withdrawals paused";
      } else if (error.message.includes("ClaimsPaused")) {
        errorMessage = "Claims paused";
      } else if (error.message.includes("PoolEnded")) {
        errorMessage = "Pool has ended";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showError(`❌ ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const closeModal = () => {
    setOpenModal(null);
    setAmount(0);
  };

  const getModalTitle = () => {
    switch (openModal) {
      case "stake": return "Stake Tokens";
      case "unstake": return "Unstake Tokens";
      case "claimRewards": return "Claim Staking Rewards";
      case "claimSelf":
      case "claimExternal": return "Claim Reflections";
      default: return "";
    }
  };

  const getModalColor = () => {
    switch (openModal) {
      case "stake": return "bg-blue-600 hover:bg-blue-700 active:bg-blue-800";
      case "unstake": return "bg-red-600 hover:bg-red-700 active:bg-red-800";
      case "claimRewards":
      case "claimSelf":
      case "claimExternal": return "bg-green-600 hover:bg-green-700 active:bg-green-800";
      default: return "bg-gray-600 hover:bg-gray-700";
    }
  };

  const handleRefreshReflections = async () => {
    if (!effectiveMintAddress) {
      showError("❌ Token mint missing");
      return;
    }

    setIsProcessing(true);
    
    try {
      showWarning("🔄 Refreshing reflections...");
      
      // Call refresh_reflections on-chain
      await refreshReflections(effectiveMintAddress, poolId);
      
      // Wait a moment for transaction to settle
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Reload user stake data
      const userStake = await getUserStake(effectiveMintAddress, poolId);
      if (userStake) {
        setUserStakedAmount(userStake.amount.toNumber() / DECIMALS_MULTIPLIER);
        setUserStakeTimestamp(userStake.lastStakeTimestamp?.toNumber() || 0);
        setStakeData(userStake);
      }
      
      // Reload project data
      const project = await getProjectInfo(effectiveMintAddress, poolId);
      setProjectData(project);
      
      showSuccess("✅ Reflections refreshed!");
      
    } catch (error: any) {
      console.error("Refresh reflections error:", error);
      showError(`❌ Error: ${error.message || "Failed to refresh"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return "Unlocked";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const rate = dynamicRate ?? (type === "locked" ? apy : apr) ?? 0;
  
  const rewardsDisplay = realtimeRewards > 0 
    ? `${formatRewards(realtimeRewards)} ${symbol}` 
    : rewards || "0 " + symbol;

  // ✅ FIX: Add display for reflections with correct token symbol
  const reflectionsDisplay = reflectionBalance > 0
    ? `${reflectionBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${reflectionTokenSymbol || 'REFLECT'}`
    : `0 ${reflectionTokenSymbol || 'REFLECT'}`;

  const isStakeDisabled = !connected || !effectiveMintAddress || !isInitialized || isPaused || poolEndInfo.hasEnded;
  const isUnstakeDisabled = !connected || !effectiveMintAddress || !isInitialized || isPaused || userStakedAmount <= 0 || lockupInfo.isLocked;
  // ✅ FIXED: Removed !lockupInfo.canClaim - claims always available
  const isClaimDisabled = !connected || !effectiveMintAddress || !isInitialized || isPaused || realtimeRewards <= 0;
  // ✅ FIX: Separate check for reflection claims
  const isClaimReflectionsDisabled = !connected || !effectiveMintAddress || !isInitialized || isPaused || reflectionBalance <= 0;

  return (
    <>
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 rounded-xl p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 relative overflow-hidden group">
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-col gap-1 items-end">
          {/* ✅ NEW: Pool ID Badge - Only show when there are multiple pools for this token */}
          {showPoolNumber && (
            <div className="bg-purple-500/20 border border-purple-500/50 text-purple-300 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold">
              Pool #{poolId}
            </div>
          )}
          {featured && (
            <div className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1">
              ⭐ <span className="hidden sm:inline">Featured</span>
            </div>
          )}
          {!isInitialized && (
            <div className="bg-orange-500/20 border border-orange-500/30 text-orange-300 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold">
              ⏳ Initializing
            </div>
          )}
          {isPaused && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold">
              ⏸ Paused
            </div>
          )}
          {poolEndInfo.hasEnded && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold">
              🔴 Ended
            </div>
          )}
        </div>

        {!effectiveMintAddress && (
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-red-500/20 border border-red-500/30 text-red-300 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold">
            ⚠️ Not Configured
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

        <div className="flex items-center gap-2 sm:gap-3 relative z-10">
          <div className="relative flex-shrink-0">
            {logo ? (
              <img src={logo} alt={name} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full border-2 border-gray-700" />
            ) : (
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm sm:text-base md:text-lg">
                {symbol.slice(0, 2)}
              </div>
            )}
            {type === "locked" ? (
              <Lock className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 bg-red-500 text-white rounded-full p-0.5" />
            ) : (
              <Unlock className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 bg-green-500 text-white rounded-full p-0.5" />
            )}
          </div>
          
          <div className="flex-1 min-w-0 overflow-hidden">
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-white truncate leading-tight">{name}</h2>
            <p className="text-gray-400 text-[10px] sm:text-xs leading-tight">{symbol}</p>
            
            {priceLoading ? (
              <div className="flex items-center gap-1 mt-0.5 sm:mt-1">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[9px] sm:text-[10px] text-gray-500">Loading...</span>
              </div>
            ) : price !== null ? (
              <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1">
                <p className="text-[10px] sm:text-xs font-semibold text-green-400 truncate">
                  ${price.toFixed(price < 0.01 ? 6 : price < 1 ? 4 : 2)}
                </p>
                {priceChange24h !== null && (
                  <span className={`text-[9px] sm:text-[10px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0 ${
                    priceChange24h >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}>
                    {priceChange24h >= 0 ? "↑" : "↓"}
                    {Math.abs(priceChange24h).toFixed(1)}%
                  </span>
                )}
              </div>
            ) : (
              <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">Price unavailable</p>
            )}
          </div>
        </div>

        <div className="relative z-10">
          <div className={`p-2.5 sm:p-3 md:p-4 rounded-lg text-center ${
            rate > 100
              ? "bg-gradient-to-r from-green-600/30 to-emerald-600/30 border border-green-500/50"
              : rate > 50
              ? "bg-gradient-to-r from-yellow-600/30 to-orange-600/30 border border-yellow-500/50"
              : "bg-gradient-to-r from-gray-700/30 to-gray-600/30 border border-gray-600/50"
          }`}>
            <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 uppercase tracking-wide mb-0.5">
              {type === "locked" ? "APY" : "APR"}
            </p>
            <p className={`text-xl sm:text-2xl md:text-3xl font-bold leading-none ${
              rate > 100 ? "text-green-400" : rate > 50 ? "text-yellow-400" : "text-gray-300"
            }`}>
              {typeof rate === 'number' ? rate.toFixed(2) : rate ?? "-"}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm relative z-10">
          <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
            <p className="text-gray-400 text-[9px] sm:text-[10px] md:text-xs mb-0.5 leading-tight">Your Stake</p>
            <p className="text-white font-semibold text-[11px] sm:text-xs md:text-sm leading-tight truncate">
              {connected ? `${userStakedAmount.toFixed(2)} ${symbol}` : "-"}
            </p>
          </div>
          
          <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
            <p className="text-gray-400 text-[9px] sm:text-[10px] md:text-xs mb-0.5 leading-tight">
              {type === "locked" && lockupInfo.isLocked ? "Unlocks In" : "Lock Period"}
            </p>
            <p className="text-white font-semibold text-[11px] sm:text-xs md:text-sm leading-tight truncate">
              {type === "locked" ? (
                lockupInfo.isLocked ? (
                  <span className="text-yellow-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeRemaining(lockupInfo.remainingSeconds)}
                  </span>
                ) : userStakedAmount > 0 ? (
                  <span className="text-green-400">✓ Unlocked</span>
                ) : (
                  `${lockPeriod}d`
                )
              ) : "Flex"}
            </p>
          </div>
        </div>

        {poolEndTime && !poolEndInfo.hasEnded && (
          <div className="bg-orange-500/10 border border-orange-500/30 p-2 rounded-lg relative z-10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400 flex-shrink-0" />
                <span className="text-[9px] sm:text-[10px] md:text-xs text-orange-400">Pool Ends In</span>
              </div>
              <span className="text-orange-400 font-bold text-[11px] sm:text-xs md:text-sm">
                {formatTimeRemaining(poolEndInfo.remainingSeconds)}
              </span>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-green-600/10 to-emerald-600/10 border border-green-500/30 p-2 rounded-lg relative z-10">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-green-400 flex-shrink-0" />
              <span className="text-[9px] sm:text-[10px] md:text-xs text-gray-400">
                Accumulating Rewards
              </span>
              {realtimeRewards > 0 && (
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-auto" />
              )}
            </div>
            <div className="text-green-400 font-bold text-xs sm:text-sm md:text-base break-all">
              {rewardsDisplay}
            </div>
          </div>
        </div>

        {reflectionTokenAccount && (
          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 p-2 rounded-lg relative z-10">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-purple-400 flex-shrink-0" />
                <span className="text-[9px] sm:text-[10px] md:text-xs text-purple-300">
                  Reflection Balance
                </span>
                {reflectionLoading && <LoadingSpinner size="sm" />}
                {/* ✅ NEW: Subtle Refresh Button */}
                <button
                  onClick={handleRefreshReflections}
                  disabled={!connected || !effectiveMintAddress || !isInitialized || isProcessing}
                  className="ml-auto p-1 hover:bg-purple-500/20 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Refresh reflection calculations"
                >
                  <Repeat className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-400 hover:text-purple-300" />
                </button>
              </div>
              <div className="text-purple-400 font-bold text-xs sm:text-sm md:text-base break-all">
                {reflectionBalance > 0 
                  ? `${reflectionBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${reflectionTokenSymbol || symbol}`
                  : `0.0000 ${reflectionTokenSymbol || symbol}`
                }
              </div>
              {price && reflectionBalance > 0 && (
                <div className="text-gray-400 text-[8px] sm:text-[9px]">
                  ≈ ${(reflectionBalance * price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              )}
              <div className="flex items-center gap-1 text-[8px] sm:text-[9px] text-purple-300 mt-0.5">
                <Sparkles className="w-2 h-2" />
                <span>Auto-compounds from pool activity</span>
              </div>
            </div>
          </div>
        )}

        {connected && (
          <div className="bg-blue-500/10 border border-blue-500/30 p-2 rounded-lg relative z-10">
            <div className="flex items-center justify-between gap-2 text-[9px] sm:text-[10px]">
              <span className="text-blue-300">Platform Fees</span>
              <span className="text-blue-400 font-semibold">
                {platformFeePercent}% + {flatSolFee} SOL
              </span>
            </div>
            <div className="text-[8px] sm:text-[9px] text-gray-500 mt-0.5">
              SOL Balance: {solBalance.toFixed(4)} SOL
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 relative z-10">
          <button
            onClick={() => setOpenModal("stake")}
            disabled={isStakeDisabled}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-2 sm:py-2.5 md:py-3 px-2 rounded-lg text-[11px] sm:text-xs md:text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 min-h-[40px] sm:min-h-[44px] leading-tight"
            title={isStakeDisabled ? (
              !isInitialized ? "Pool not initialized" :
              isPaused ? "Pool paused" :
              poolEndInfo.hasEnded ? "Pool ended" :
              "Connect wallet"
            ) : ""}
          >
            Stake
          </button>

          <button
            onClick={() => setOpenModal("unstake")}
            disabled={isUnstakeDisabled}
            className="bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white py-2 sm:py-2.5 md:py-3 px-2 rounded-lg text-[11px] sm:text-xs md:text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 min-h-[40px] sm:min-h-[44px] leading-tight"
            title={isUnstakeDisabled ? (
              lockupInfo.isLocked ? `Locked for ${formatTimeRemaining(lockupInfo.remainingSeconds)}` :
              userStakedAmount <= 0 ? "No stake" :
              "Connect wallet"
            ) : ""}
          >
            Unstake
          </button>

          {!hasSelfReflections && !hasExternalReflections ? (
            <button
              onClick={() => setOpenModal("claimRewards")}
              disabled={isClaimDisabled}
              className="col-span-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white py-2 sm:py-2.5 md:py-3 px-2 rounded-lg text-[11px] sm:text-xs md:text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 min-h-[40px] sm:min-h-[44px] leading-tight"
              title={isClaimDisabled ? (
                realtimeRewards <= 0 ? "No rewards yet" :
                isPaused ? "Pool paused" :
                "Connect wallet"
              ) : "Claim your rewards anytime"}
            >
              Claim Rewards
            </button>
          ) : (
            <>
              <button
                onClick={() => setOpenModal("claimRewards")}
                disabled={isClaimDisabled}
                className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white py-2 sm:py-2.5 md:py-3 px-2 rounded-lg text-[11px] sm:text-xs md:text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 min-h-[40px] sm:min-h-[44px] leading-tight"
                title={isClaimDisabled ? (
                  realtimeRewards <= 0 ? "No rewards yet" :
                  isPaused ? "Pool paused" :
                  "Connect wallet"
                ) : "Claim rewards anytime"}
              >
                Rewards
              </button>

              <button
                onClick={() => setOpenModal(hasSelfReflections ? "claimSelf" : "claimExternal")}
                disabled={isClaimReflectionsDisabled}
                className="bg-yellow-600 hover:bg-yellow-700 active:bg-yellow-800 text-white py-2 sm:py-2.5 md:py-3 px-2 rounded-lg text-[11px] sm:text-xs md:text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 min-h-[40px] sm:min-h-[44px] leading-tight"
                title={isClaimReflectionsDisabled ? (
                  reflectionBalance <= 0 ? "No reflections yet" :
                  "Connect wallet"
                ) : "Claim reflections anytime"}
              >
                Reflect
              </button>

            </>
          )}
        </div>

        {!connected && (
          <div className="relative z-10 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-yellow-400 bg-yellow-600/10 border border-yellow-500/30 p-1.5 sm:p-2 rounded leading-tight">
            <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span>Connect wallet to interact</span>
          </div>
        )}
        
        {connected && !isInitialized && (
          <div className="relative z-10 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-orange-400 bg-orange-600/10 border border-orange-500/30 p-1.5 sm:p-2 rounded leading-tight">
            <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span>Pool initializing - check back soon</span>
          </div>
        )}
        
        {connected && isPaused && (
          <div className="relative z-10 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-red-400 bg-red-600/10 border border-red-500/30 p-1.5 sm:p-2 rounded leading-tight">
            <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span>Pool paused by admin</span>
          </div>
        )}

        {/* ✅ UPDATED: Shows rewards are claimable anytime */}
        {connected && realtimeRewards > 0 && (
          <div className="relative z-10 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-green-400 bg-green-600/10 border border-green-500/30 p-1.5 sm:p-2 rounded leading-tight">
            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span>💰 {formatRewards(realtimeRewards)} {symbol} ready to claim!</span>
          </div>
        )}
      </div>

      {/* MODAL */}
      {openModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-gray-700 p-4 sm:p-6 rounded-2xl shadow-2xl w-full max-w-[calc(100vw-24px)] sm:max-w-md max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                {openModal === "stake" && "💰"}
                {openModal === "unstake" && "📤"}
                {(openModal === "claimRewards" || openModal === "claimSelf" || openModal === "claimExternal") && "🎁"}
                <span className="truncate">{getModalTitle()}</span>
              </h2>
              <button
                onClick={closeModal}
                disabled={isProcessing}
                className="text-gray-400 hover:text-white transition-colors text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
              >
                ✕
              </button>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 p-2.5 sm:p-3 rounded-lg mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
              {logo && <img src={logo} alt={name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold text-sm sm:text-base truncate">{name}</p>
                <p className="text-gray-400 text-xs sm:text-sm">{symbol}</p>
              </div>
            </div>

            {(openModal === "stake" || openModal === "unstake") && (
              <>
                <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <p className="text-purple-300 text-xs sm:text-sm font-semibold">
                      {openModal === "stake" ? "Available Balance" : "Staked Amount"}
                    </p>
                    {balanceLoading && <LoadingSpinner size="sm" />}
                  </div>
                  <p className="text-white font-bold text-xl sm:text-2xl break-all">
                    {openModal === "stake" 
                      ? `${tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`
                      : `${userStakedAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`
                    }
                  </p>
                  {price && (
                    <p className="text-gray-400 text-xs sm:text-sm mt-1">
                      ≈ ${((openModal === "stake" ? tokenBalance : userStakedAmount) * price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  )}
                </div>

                <div className="mb-3 sm:mb-4">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                    Amount to {openModal}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full p-2.5 sm:p-3 pr-12 sm:pr-16 rounded-lg bg-slate-900 text-white border border-gray-700 focus:border-purple-500 focus:outline-none text-base sm:text-lg font-semibold"
                      placeholder="0.00"
                      disabled={isProcessing}
                      max={openModal === "stake" ? tokenBalance : userStakedAmount}
                    />
                    <span className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-xs sm:text-sm">
                      {symbol}
                    </span>
                  </div>
                </div>

                {openModal === "stake" && amount > 0 && (
                  <div className="mb-3 sm:mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Stake Amount:</span>
                      <span className="text-white font-semibold">{amount.toFixed(4)} {symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Token Fee ({platformFeePercent}%):</span>
                      <span className="text-yellow-400">-{feeCalculation.tokenFee.toFixed(4)} {symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">SOL Fee:</span>
                      <span className="text-yellow-400">-{flatSolFee} SOL</span>
                    </div>
                    <div className="border-t border-gray-700 pt-2 flex justify-between">
                      <span className="text-blue-300 font-semibold">You'll Stake:</span>
                      <span className="text-blue-400 font-bold">{feeCalculation.amountAfterFee.toFixed(4)} {symbol}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mb-3 sm:mb-4">
                  {[25, 50, 100].map((percent) => (
                    <button
                      key={percent}
                      onClick={() => handleQuickSelect(percent)}
                      disabled={isProcessing}
                      className="px-2 py-2.5 sm:py-2 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 rounded-lg text-xs sm:text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
                    >
                      {percent}%
                    </button>
                  ))}
                </div>

                <div className="mb-4 sm:mb-6">
                  <input
                    type="range"
                    min="0"
                    max={openModal === "stake" ? tokenBalance : userStakedAmount}
                    step={(openModal === "stake" ? tokenBalance : userStakedAmount) / 100}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    disabled={isProcessing}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[10px] sm:text-xs text-gray-400 mt-1">
                    <span>0</span>
                    <span>{(openModal === "stake" ? tokenBalance : userStakedAmount).toFixed(2)}</span>
                  </div>
                </div>

                {openModal === "stake" && amount > 0 && solBalance < (flatSolFee + 0.00089088) && (
                  <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs sm:text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Need {(flatSolFee + 0.00089088).toFixed(5)} SOL for fees (you have {solBalance.toFixed(5)})</span>
                  </div>
                )}

                {openModal === "stake" && amount > tokenBalance && (
                  <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs sm:text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Insufficient balance</span>
                  </div>
                )}

                {openModal === "unstake" && lockupInfo.isLocked && (
                  <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg flex items-center gap-2 text-yellow-400 text-xs sm:text-sm">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span>Unlocks in {formatTimeRemaining(lockupInfo.remainingSeconds)}</span>
                  </div>
                )}

                {openModal === "unstake" && amount > userStakedAmount && (
                  <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs sm:text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Cannot unstake more than staked amount</span>
                  </div>
                )}

                {amount > 0 && validateTransaction().valid && (
                  <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-green-900/20 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400 text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Ready to {openModal}</span>
                  </div>
                )}
              </>
            )}

            {(openModal === "claimRewards" || openModal === "claimSelf" || openModal === "claimExternal") && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                <p className="text-green-300 text-xs sm:text-sm mb-1.5 sm:mb-2">
                  {openModal === "claimRewards" ? "Available to claim:" : "Available reflections to claim:"}
                </p>
                <p className="text-white font-bold text-lg sm:text-xl break-all">
                  {/* ✅ FIX: Show correct data based on modal type */}
                  {openModal === "claimRewards" ? rewardsDisplay : reflectionsDisplay}
                </p>
                {openModal === "claimRewards" && price && realtimeRewards > 0 && (
                  <p className="text-gray-400 text-xs sm:text-sm mt-1">
                    ≈ ${(realtimeRewards * price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                )}
                {(openModal === "claimSelf" || openModal === "claimExternal") && stakeData?.withdrawalWallet && openModal === "claimExternal" && (
                  <div className="mt-3 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-300 text-xs mb-1">⚠️ Withdrawal Wallet:</p>
                    <p className="text-white text-xs font-mono break-all">
                      {stakeData.withdrawalWallet.toString()}
                    </p>
                  </div>
                )}
                
                {/* ✅ NEW: Refresh Reflections Button */}
                {(openModal === "claimSelf" || openModal === "claimExternal") && (
                  <div className="mt-3">
                    <button
                      onClick={handleRefreshReflections}
                      disabled={isProcessing || !effectiveMintAddress}
                      className="w-full px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 rounded-lg text-blue-300 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isProcessing ? "Refreshing..." : "🔄 Refresh Reflections"}
                    </button>
                    <p className="text-gray-400 text-xs mt-1 text-center">
                      Click to update reflection calculations
                    </p>
                  </div>
                )}

              </div>
            )}

            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={closeModal}
                disabled={isProcessing}
                className="flex-1 px-3 sm:px-4 py-3 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 rounded-lg text-sm sm:text-base font-semibold transition-all disabled:opacity-50 min-h-[48px]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={isProcessing || !validateTransaction().valid}
                className={`flex-1 px-3 sm:px-4 py-3 rounded-lg text-sm sm:text-base font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px] ${getModalColor()}`}
              >
                {isProcessing ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="hidden sm:inline">Processing...</span>
                    <span className="sm:hidden">Wait...</span>
                  </>
                ) : (
                  <>
                    Confirm
                    {(openModal === "stake" || openModal === "unstake") && amount > 0 && (
                      <span className="hidden sm:inline"> {amount.toFixed(4)} {symbol}</span>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}