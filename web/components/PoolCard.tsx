"use client";
import { useEffect, useState, useMemo } from "react";
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { useSolanaBalance } from '@/hooks/useSolanaBalance';
import { useStakingProgram } from '@/hooks/useStakingProgram';
import { useToast } from "@/components/ToastContainer";
import { LoadingSpinner } from "@/components/SkeletonLoaders";
import { useRealtimeRewards, formatRewards } from "@/utils/calculatePendingRewards";
import { useSound } from '@/hooks/useSound';
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

// Helper function to safely convert decimal amounts to token units
function toTokenAmount(amount: number, decimals: number): string {
  const amountStr = amount.toString();
  const [whole, fraction = ''] = amountStr.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const combined = whole + paddedFraction;
  return combined.replace(/^0+/, '') || '0';
}

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
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRpcCall = Date.now();
}

const CACHE_DURATION = 120000; // 2 minutes
const TOKEN_DECIMALS = 9;
const decimalsMultiplier = Math.pow(10, TOKEN_DECIMALS);

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
  transferTaxBps?: number; // ✅ ADD THIS LINE - Transfer tax in basis points (0-10000)
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
    showPoolNumber = false,
    totalPoolsForToken = 1,
    transferTaxBps = 0,
  } = props;

  const { playSound } = useSound();

  const effectiveMintAddress = tokenMint || mintAddress;
  
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
  const [openModal, setOpenModal] = useState<"stake" | "unstake" | "claimRewards" | "claimSelf" | "claimExternal" | "viewBalances" | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [userStakedAmount, setUserStakedAmount] = useState<number>(0);
  const [userStakeTimestamp, setUserStakeTimestamp] = useState<number>(0);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [dynamicRate, setDynamicRate] = useState<number | null>(null);

  const taxMultiplier = 1 - (transferTaxBps / 10000);
  const displayStakedAmount = userStakedAmount * taxMultiplier;

  const [projectData, setProjectData] = useState<any>(null);
  const [stakeData, setStakeData] = useState<any>(null);

  // Derive pool end time from blockchain data
  const blockchainPoolEndTime = projectData?.poolEndTime?.toNumber?.() || projectData?.poolEndTime || null;

  const [reflectionBalance, setReflectionBalance] = useState<number>(0);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [tokenDecimals, setTokenDecimals] = useState<number>(9);
  const decimalsMultiplier = useMemo(() => Math.pow(10, tokenDecimals), [tokenDecimals]);
  const [copied, setCopied] = useState(false);

  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const REFRESH_COOLDOWN = 3000; // 3 seconds between refreshes
  
  const realtimeRewards = useRealtimeRewards(projectData, stakeData, tokenDecimals);

  const [currentTime, setCurrentTime] = useState<number>(Math.floor(Date.now() / 1000));

  // Update current time every 10 seconds for realtime rewards
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Fetch token decimals
  useEffect(() => {
    if (!effectiveMintAddress || !connection) return;
    
    const fetchDecimals = async () => {
      try {
        const mintInfo = await connection.getParsedAccountInfo(new PublicKey(effectiveMintAddress));
        const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;
        setTokenDecimals(decimals);
        console.log(`✅ Token decimals for ${symbol}:`, decimals);
      } catch (error) {
        console.error("Error fetching decimals:", error);
        setTokenDecimals(9); // fallback
      }
    };
    
    fetchDecimals();  // ✅ ADD THIS LINE
  }, [effectiveMintAddress, connection, symbol]);  // ✅ ADD THIS LINE

  // Fetch reflection balance - USER'S PENDING REFLECTIONS
  useEffect(() => {
    if (!connected || !publicKey || !effectiveMintAddress) {
      setReflectionBalance(0);
      return;
    }

    const fetchReflectionBalance = async () => {
      setReflectionLoading(true);
      try {
        // Get fresh project and stake data
        const project = await getProjectInfo(effectiveMintAddress, poolId);
        const userStake = await getUserStake(effectiveMintAddress, poolId);
        
        if (!project || !userStake) {
          console.log(`⚠️ [${name}] No project or stake data`);
          setReflectionBalance(0);
          setReflectionLoading(false);
          return;
        }

        // Only check reflectionVault if reflections are enabled in database
        if ((hasSelfReflections || hasExternalReflections) && !project.reflectionVault) {
          console.log(`⚠️ [${name}] Reflections enabled in DB but not on-chain`);
          setReflectionBalance(0);
          setReflectionLoading(false);
          return;
        }

        // Get user's staked amount (in lamports)
        const userStakedLamports = userStake.amount ? parseFloat(userStake.amount.toString()) : 0;

        
        if (userStakedLamports === 0) {
          console.log(`⚠️ [${name}] User has no stake`);
          setReflectionBalance(0);
          setReflectionLoading(false);
          return;
        }

        // Get reflection rates
        const userReflectionPerTokenPaid = userStake.reflectionPerTokenPaid 
          ? userStake.reflectionPerTokenPaid.toNumber() 
          : 0;
        
        const currentReflectionPerToken = project.reflectionPerTokenStored 
          ? project.reflectionPerTokenStored.toNumber() 
          : 0;

        // ✅ FIX: Read reflections_pending directly from blockchain
        const pendingReflectionsLamports = userStake.reflectionsPending 
          ? userStake.reflectionsPending.toNumber() 
          : 0;

        const isNativeSOL = project.reflectionToken?.toString() === 'So11111111111111111111111111111111111111112';

        const pendingReflections = pendingReflectionsLamports / LAMPORTS_PER_SOL;

        // ✅ NEW: Account for 0.003 SOL fixed buffer for Native SOL reflections
        const isNativeSOLReflections = project.reflectionToken?.toString() === 'So11111111111111111111111111111111111111112';

        let displayReflections = pendingReflections;

        if (isNativeSOLReflections) {
          // For Native SOL, check actual vault balance and subtract 0.003 SOL buffer
          try {
            const vaultBalance = await connection.getBalance(new PublicKey(project.reflectionVault || project.key()));
            const FIXED_BUFFER = 0.003; // SOL (rent-exempt ~0.002 + safety 0.001)
            const availableInVault = Math.max(0, (vaultBalance / LAMPORTS_PER_SOL) - FIXED_BUFFER);
            
            // Show the MINIMUM of what user is owed vs what's actually available
            displayReflections = Math.min(pendingReflections, availableInVault);
          } catch (error) {
            console.error('Error fetching vault balance:', error);
          }
        }
                                  
        console.log(`🔍 [${name}] Reflection Calculation:`, {
          userStakedLamports: userStakedLamports,
          userStakedTokens: userStakedLamports / decimalsMultiplier,
          currentRate: currentReflectionPerToken,
          pendingLamports: pendingReflectionsLamports,
          pendingTokens: pendingReflections,
          displayReflections: displayReflections,
          isNativeSOL: isNativeSOLReflections,
          reflectionToken: project.reflectionToken?.toString(),
        });

        setReflectionBalance(Math.max(0, displayReflections));
                
      } catch (error: any) {

        playSound('error'); 
        console.error(`❌ [${name}] Error fetching reflection balance:`, error);
        setReflectionBalance(0);
      } finally {
        setReflectionLoading(false);
      }
    };

    fetchReflectionBalance();
    
    const interval = setInterval(fetchReflectionBalance, 10000);
    return () => clearInterval(interval);
  }, [connected, publicKey, name, stakeData, effectiveMintAddress, poolId]);

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
      canClaim: true,
    };
  }, [lockPeriod, type, userStakeTimestamp, currentTime]);

  const poolEndInfo = useMemo(() => {
    const endTime = blockchainPoolEndTime || poolEndTime;
    
    if (!endTime) return { hasEnded: false, endsAt: null, remainingSeconds: 0, status: 'none' as const };
    
    const remainingSeconds = Math.max(0, endTime - currentTime);
    const daysRemaining = remainingSeconds / 86400;
    
    let status: 'ended' | 'critical' | 'warning' | 'active' | 'none' = 'active';
    if (remainingSeconds === 0) status = 'ended';
    else if (daysRemaining < 1) status = 'critical';
    else if (daysRemaining < 7) status = 'warning';
    
    return {
      hasEnded: remainingSeconds === 0,
      endsAt: new Date(endTime * 1000),
      remainingSeconds,
      status,
      daysRemaining,
    };
  }, [blockchainPoolEndTime, poolEndTime, currentTime]);

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

  // ✅ PUBLIC DATA: Fetch pool info WITHOUT wallet (anyone can see APY, TVL, etc.)
  useEffect(() => {
    if (!effectiveMintAddress) return;

    const fetchPublicData = async () => {
      await waitForRpcSlot();
      
      try {
        // 1. Fetch dynamic rate (public read - no wallet needed)
        if (dynamicRate === null) {
          try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const result = await getPoolRate(effectiveMintAddress, poolId);
            if (result?.rate !== undefined) {
              setDynamicRate(result.rate);
            }
          } catch (error) {
            // Silent fail - will use database APY/APR value
          }
        }

        // 2. Fetch project info for TVL display (public read - no wallet needed)
        await waitForRpcSlot();
        try {
          const project = await getProjectInfo(effectiveMintAddress, poolId);
          if (project) {
            setProjectData(project);
          }
        } catch (error) {
          // Silent fail
        }
      } catch (error) {
        // Silent fail
      }
    };

    fetchPublicData();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchPublicData, 120000);
    return () => clearInterval(interval);
  }, [effectiveMintAddress, poolId]); // ✅ NO connected/publicKey dependency

  // ✅ USER DATA: Fetch user-specific data (requires wallet connection)
  useEffect(() => {
    if (!connected || !publicKey || !effectiveMintAddress) {
      // Reset user data when wallet disconnected
      setUserStakedAmount(0);
      setUserStakeTimestamp(0);
      setStakeData(null);
      setSolBalance(0);
      return;
    }

    const fetchUserData = async () => {
      await waitForRpcSlot();
      
      try {
        // 1. Fetch SOL balance
        try {
          const balance = await connection.getBalance(publicKey);
          setSolBalance(balance / LAMPORTS_PER_SOL);
        } catch (error) {
          // Silent fail
        }

        // 2. Fetch user stake
        await waitForRpcSlot();
        try {
          const userStake = await getUserStake(effectiveMintAddress, poolId);
          
          if (userStake) {
            // Fetch decimals directly to ensure accuracy
            let actualDecimals = tokenDecimals;
            try {
              const mintInfo = await connection.getParsedAccountInfo(new PublicKey(effectiveMintAddress));
              actualDecimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;
            } catch (e) {
              console.error("Error fetching decimals:", e);
            }
            const amountStr = userStake.amount.toString();
            setUserStakedAmount(parseFloat(amountStr) / Math.pow(10, actualDecimals));
            setUserStakeTimestamp(userStake.lastStakeTimestamp?.toNumber() || 0);
            setStakeData(userStake);
          } else {
            setStakeData(null);
            setUserStakedAmount(0);
            setUserStakeTimestamp(0);
          }
        } catch (error) {
          // Silent fail
        }
      } catch (error) {
        // Silent fail
      }
    };

    fetchUserData();
    
    // Refresh every 2 minutes with jitter
    const randomInterval = 120000 + Math.random() * 30000;
    const interval = setInterval(fetchUserData, randomInterval);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey, effectiveMintAddress, poolId, tokenDecimals]);

  // Price fetching - uses mint address instead of pair address
  useEffect(() => {
    if (!effectiveMintAddress) {
      setPriceLoading(false);
      return;
    }

    // Known stablecoins - hardcode to $1
    const STABLECOINS: Record<string, number> = {
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1.00, // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.00, // USDT
      'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX': 1.00,  // USDH
    };

    if (STABLECOINS[effectiveMintAddress]) {
      setPrice(STABLECOINS[effectiveMintAddress]);
      setPriceChange24h(0);
      setPriceLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchPrice() {
      const cached = priceCache.get(effectiveMintAddress!);
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
          `https://api.dexscreener.com/latest/dex/tokens/${effectiveMintAddress}`,
          { signal: controller.signal, cache: 'no-store' }
        );

        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();
        const pairs = data?.pairs || [];
        const bestPair = pairs.sort(
          (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];
        
        if (isMounted && bestPair) {
          const priceValue = parseFloat(bestPair.priceUsd) || null;
          const priceChangeValue = parseFloat(bestPair.priceChange?.h24 || 0);
          
          setPrice(priceValue);
          setPriceChange24h(priceChangeValue);
          setPriceLoading(false);
          
          priceCache.set(effectiveMintAddress!, {
            price: priceValue,
            priceChange24h: priceChangeValue,
            timestamp: Date.now()
          });
        } else if (isMounted) {
          setPrice(null);
          setPriceChange24h(null);
          setPriceLoading(false);
        }
      } catch (err) {
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
  }, [effectiveMintAddress, symbol]);

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
      playSound('error'); // ✅ ADD THIS LINE
      showError(`❌ ${validation.error}`);
      return;
    }

    setIsProcessing(true);

    try {
      let txSignature: string;

      switch (openModal) {
        case "stake":
          const stakeAmount = toTokenAmount(amount, tokenDecimals);
          txSignature = await blockchainStake(effectiveMintAddress!, stakeAmount, poolId);
          
          playSound('success');
          showSuccess(`✅ Staked ${amount.toFixed(4)} ${symbol}! TX: ${txSignature.slice(0, 8)}...`);
          break;

        case "unstake":
          const unstakeAmount = toTokenAmount(amount, tokenDecimals);
          txSignature = await blockchainUnstake(effectiveMintAddress!, poolId, unstakeAmount);
          
          playSound('success'); // ✅ ADD THIS LINE
          showSuccess(`✅ Unstaked ${amount.toFixed(4)} ${symbol}! TX: ${txSignature.slice(0, 8)}...`);
          break;

        case "claimRewards":
          txSignature = await blockchainClaimRewards(effectiveMintAddress!, poolId);
          
          playSound('success'); // ✅ ADD THIS LINE
          showSuccess(`✅ Claimed rewards! TX: ${txSignature.slice(0, 8)}...`);
          break;

        case "claimSelf":
          if (!hasSelfReflections && !hasExternalReflections) {
            playSound('error'); // ✅ ADD THIS LINE
            showError("❌ Reflections not enabled for this pool");
            return;
          }
          txSignature = await blockchainClaimReflections(effectiveMintAddress!, poolId);
          
          playSound('success'); // ✅ ADD THIS LINE
          showSuccess(`✅ Claimed reflections! TX: ${txSignature.slice(0, 8)}...`);
          break;

        case "claimExternal":
          if (!hasSelfReflections && !hasExternalReflections) {
            playSound('error'); // ✅ ADD THIS LINE
            showError("❌ Reflections not enabled for this pool");
            return;
          }
          if (!externalReflectionMint) {
            playSound('error'); // ✅ ADD THIS LINE
            showError("❌ External reflection mint not configured");
            return;
          }
          txSignature = await blockchainClaimReflections(effectiveMintAddress!, poolId);

          playSound('success'); // ✅ ADD THIS LINE
          showSuccess(`✅ Claimed external reflections! TX: ${txSignature.slice(0, 8)}...`);
          break;

        default:
          throw new Error("Unknown action");
      }

      // ✅ ADD THIS: After the switch statement, refetch data and recalculate reflections
      setTimeout(async () => {
        try {
          const userStake = await getUserStake(effectiveMintAddress!, poolId);
          const project = await getProjectInfo(effectiveMintAddress!, poolId);
          
          if (userStake) {
            setUserStakedAmount(parseFloat(userStake.amount.toString()) / decimalsMultiplier);
            setUserStakeTimestamp(userStake.lastStakeTimestamp?.toNumber() || 0);
            setStakeData(userStake);
          }
          
          setProjectData(project);
          
          // ✅ Recalculate reflection balance with fresh data
          if (userStake && project && project.reflectionVault) {
            const userStakedLamports = userStake.amount ? parseFloat(userStake.amount.toString()) : 0;
            
            if (userStakedLamports > 0) {
              const userReflectionPerTokenPaid = userStake.reflectionPerTokenPaid 
                ? userStake.reflectionPerTokenPaid.toNumber() 
                : 0;
              
              const currentReflectionPerToken = project.reflectionPerTokenStored 
                ? project.reflectionPerTokenStored.toNumber() 
                : 0;

              // ✅ FIX: Read reflections_pending directly from blockchain
              const pendingReflectionsLamports = userStake.reflectionsPending 
                ? userStake.reflectionsPending.toNumber() 
                : 0;

              const isNativeSOL = project.reflectionToken?.toString() === 'So11111111111111111111111111111111111111112';

              const pendingReflections = pendingReflectionsLamports / LAMPORTS_PER_SOL;

              // ✅ NEW: Account for 0.003 SOL fixed buffer for Native SOL reflections
              const isNativeSOLReflections = project.reflectionToken?.toString() === 'So11111111111111111111111111111111111111112';

              let displayReflections = pendingReflections;

              if (isNativeSOLReflections) {
                try {
                  const vaultBalance = await connection.getBalance(new PublicKey(project.reflectionVault || project.key()));
                  const FIXED_BUFFER = 0.003;
                  const availableInVault = Math.max(0, (vaultBalance / LAMPORTS_PER_SOL) - FIXED_BUFFER);
                  displayReflections = Math.min(pendingReflections, availableInVault);
                } catch (error) {
                  console.error('Error fetching vault balance:', error);
                }
              }
                                                        
              setReflectionBalance(Math.max(0, displayReflections));

              console.log(`🔍 [POST-ACTION] Reflection balance updated:`, {
                action: openModal,
                pendingReflections,
                displayReflections,
              });
            }
          }
        } catch (error) {
          console.error("Error updating balances after action:", error);
        }
      }, 2000);

      closeModal();

    } catch (error: any) {
      // Handle "already processed" as success
      if (error.message?.includes("may have succeeded") || 
          error.message?.includes("already been processed") ||
          error.message?.includes("already processed")) {
        
        showSuccess(`✅ Transaction succeeded! Refreshing...`);
        
        setTimeout(async () => {
          try {
            const userStake = await getUserStake(effectiveMintAddress!, poolId);
            if (userStake) {
              setUserStakedAmount(parseFloat(userStake.amount.toString()) / decimalsMultiplier);
              setUserStakeTimestamp(userStake.lastStakeTimestamp?.toNumber() || 0);
              setStakeData(userStake);
            }
            const project = await getProjectInfo(effectiveMintAddress!, poolId);
            setProjectData(project);
            
            closeModal();
            window.location.reload();
          } catch (refreshError) {
            window.location.reload();
          }
        }, 1500);
        
        return;
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
      case "viewBalances": return "Your Balances";
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
      playSound('error'); // ✅ ADD THIS LINE
      showError("❌ Token mint missing");
      return;
    }

    if (isProcessing) {
      return;
    }

    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime;
    if (timeSinceLastRefresh < REFRESH_COOLDOWN) {
      const remainingCooldown = Math.ceil((REFRESH_COOLDOWN - timeSinceLastRefresh) / 1000);
      showWarning(`⏳ Please wait ${remainingCooldown}s before refreshing again`);
      return;
    }

    if (!hasSelfReflections && !hasExternalReflections) {
      playSound('error'); // ✅ ADD THIS LINE
      showError("❌ Reflections not enabled for this pool");
      return;
    }

    setIsProcessing(true);
    setLastRefreshTime(now);
    
    try {
      showWarning("🔄 Refreshing reflections...");
      
      await refreshReflections(effectiveMintAddress, poolId);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const userStake = await getUserStake(effectiveMintAddress, poolId);
      const project = await getProjectInfo(effectiveMintAddress, poolId);
      
      if (userStake) {
        setUserStakedAmount(parseFloat(userStake.amount.toString()) / decimalsMultiplier);
        setUserStakeTimestamp(userStake.lastStakeTimestamp?.toNumber() || 0);
        setStakeData(userStake);
      }
      
      setProjectData(project);
      
      // ✅ Manually recalculate reflection balance with fresh data
      if (userStake && project && project.reflectionVault) {
        const userStakedLamports = userStake.amount ? parseFloat(userStake.amount.toString()) : 0;
        
        if (userStakedLamports > 0) {
          const userReflectionPerTokenPaid = userStake.reflectionPerTokenPaid 
            ? userStake.reflectionPerTokenPaid.toNumber() 
            : 0;
          
          const currentReflectionPerToken = project.reflectionPerTokenStored 
            ? project.reflectionPerTokenStored.toNumber() 
            : 0;

          // ✅ FIX: Read reflections_pending directly from blockchain
          const pendingReflectionsLamports = userStake.reflectionsPending 
            ? userStake.reflectionsPending.toNumber() 
            : 0;

          const isNativeSOL = project.reflectionToken?.toString() === 'So11111111111111111111111111111111111111112';

          const pendingReflections = pendingReflectionsLamports / LAMPORTS_PER_SOL;

          // ✅ NEW: Account for 0.003 SOL fixed buffer for Native SOL reflections
          const isNativeSOLReflections = project.reflectionToken?.toString() === 'So11111111111111111111111111111111111111112';

          let displayReflections = pendingReflections;

          if (isNativeSOLReflections) {
            try {
              const vaultBalance = await connection.getBalance(new PublicKey(project.reflectionVault || project.key()));
              const FIXED_BUFFER = 0.003;
              const availableInVault = Math.max(0, (vaultBalance / LAMPORTS_PER_SOL) - FIXED_BUFFER);
              displayReflections = Math.min(pendingReflections, availableInVault);
            } catch (error) {
              console.error('Error fetching vault balance:', error);
            }
          }
                                          
          console.log(`🔍 [REVSHARE] Reflection Calculation After Refresh:`, {
            userStakedLamports,
            userStakedTokens: userStakedLamports / decimalsMultiplier,
            currentRate: currentReflectionPerToken,
            pendingLamports: pendingReflectionsLamports,
            pendingTokens: pendingReflections,
            displayReflections: displayReflections,
            isNativeSOL: isNativeSOLReflections,
            reflectionToken: project.reflectionToken?.toString(),
          });

          setReflectionBalance(Math.max(0, displayReflections));
        }
      }
      
      playSound('success'); // ✅ ADD THIS LINE
      showSuccess("✅ Reflections refreshed!");
      
    } catch (error: any) {
      playSound('error'); // ✅ ADD THIS LINE
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rate = dynamicRate || apy || apr || 0;
  
  // Store data in localStorage so Dashboard can read it
  useEffect(() => {
    if (poolId !== undefined && typeof window !== 'undefined') {
      const data = {
        userStakedAmount,
        realtimeRewards,
        userStakeTimestamp,
        poolId,
        name,
        lastUpdated: Date.now()
      };
      
      localStorage.setItem(`pool_${poolId}`, JSON.stringify(data));
    }
  }, [userStakedAmount, realtimeRewards, poolId, name, userStakeTimestamp]);
  
  const rewardsDisplay = realtimeRewards > 0 
    ? `${formatRewards(realtimeRewards)} ${symbol}` 
    : rewards || "0 " + symbol;

  const reflectionsDisplay = reflectionBalance > 0
    ? `${reflectionBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${reflectionTokenSymbol || 'REFLECT'}`
    : `0 ${reflectionTokenSymbol || 'REFLECT'}`;

  const isStakeDisabled = !connected || !effectiveMintAddress || !isInitialized || isPaused || poolEndInfo.hasEnded;
  const isUnstakeDisabled = !connected || !effectiveMintAddress || !isInitialized || isPaused || userStakedAmount <= 0 || lockupInfo.isLocked;
  const isClaimDisabled = !connected || !effectiveMintAddress || !isInitialized || isPaused || realtimeRewards <= 0;
  const isClaimReflectionsDisabled = !connected || !effectiveMintAddress || !isInitialized || isPaused || reflectionBalance <= 0;

  return (
    <>
      <div 
        className="bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all duration-200 rounded-lg p-3 sm:p-5 flex flex-col gap-3 sm:gap-4 relative group"
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
      >
        {/* Left side badges - positioned above the card */}
        {(showPoolNumber || featured) && (
          <div className="absolute -top-2 left-2 sm:-top-2 sm:left-3 flex flex-wrap gap-1 items-start z-20">
            {showPoolNumber && (
              <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs font-semibold border backdrop-blur-sm" style={{ background: 'rgba(251, 87, 255, 0.2)', borderColor: 'rgba(251, 87, 255, 0.5)', color: '#fb57ff' }}>
                Pool #{poolId}
              </div>
            )}
            {featured && (
              <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs font-semibold border backdrop-blur-sm flex items-center gap-1" style={{ background: 'rgba(251, 87, 255, 0.2)', borderColor: 'rgba(251, 87, 255, 0.5)', color: '#fb57ff' }}>
                ⭐ <span className="hidden sm:inline">Featured</span>
              </div>
            )}
          </div>
        )}

        {/* Right side status badges - inside the card */}
        {(!effectiveMintAddress || !isInitialized || isPaused || poolEndInfo.hasEnded) && (
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-wrap gap-1 items-start justify-end z-20">
            {!effectiveMintAddress && (
              <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs font-semibold border backdrop-blur-sm bg-red-500/20 border-red-500/50 text-red-400">
                ⚠️ Error
              </div>
            )}
            {!isInitialized && effectiveMintAddress && (
              <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs font-semibold border backdrop-blur-sm bg-white/[0.05] border-white/[0.1] text-gray-400">
                ⏳ Initializing
              </div>
            )}
            {isPaused && (
              <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs font-semibold border backdrop-blur-sm bg-white/[0.05] border-white/[0.1] text-gray-400">
                ⏸ Paused
              </div>
            )}
            {poolEndInfo.hasEnded && (
              <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs font-semibold border backdrop-blur-sm bg-white/[0.05] border-white/[0.1] text-gray-400">
                🔴 Ended
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-3 relative z-10">
          <div className="relative flex-shrink-0">
            {logo ? (
              <img src={logo} alt={name} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full border-2 border-white/[0.1]" />
            ) : (
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base md:text-lg" style={{ background: 'rgba(251, 87, 255, 0.2)' }}>
                {symbol.slice(0, 2)}
              </div>
            )}
            {type === "locked" ? (
              <Lock className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white rounded-full p-0.5" style={{ background: '#fb57ff' }} />
            ) : (
              <Unlock className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white rounded-full p-0.5" style={{ background: '#fb57ff' }} />
            )}
          </div>
          
          <div className="flex-1 min-w-0 overflow-hidden">
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-white truncate leading-tight">{name}</h2>
            <p className="text-gray-400 text-[10px] sm:text-xs leading-tight">{symbol}</p>
            
            {priceLoading ? (
              <div className="flex items-center gap-1 mt-0.5 sm:mt-1">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#fb57ff', borderTopColor: 'transparent' }}></div>
                <span className="text-[9px] sm:text-[10px] text-gray-500">Loading...</span>
              </div>
            ) : price !== null ? (
              <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1">
                <p className="text-[10px] sm:text-xs font-semibold text-gray-400 truncate">
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
          <div className="p-2.5 sm:p-3 md:p-4 rounded-lg text-center bg-white/[0.02] border border-white/[0.05]">
            <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 uppercase tracking-wide mb-0.5">
              {type === "locked" ? "APY" : "APR"}
            </p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold leading-none truncate" style={{ color: '#fb57ff' }} title={`${typeof rate === 'number' ? rate.toFixed(2) : rate ?? "-"}%`}>
              {typeof rate === 'number' ? rate.toFixed(2) : rate ?? "-"}%
            </p>
          </div>
        </div>

        {/* Total Staked & Contract Address */}
        <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm relative z-10">
          <div className="bg-white/[0.02] p-2 rounded-lg border border-white/[0.05]">
            <p className="text-gray-500 text-[9px] sm:text-[10px] md:text-xs mb-0.5 leading-tight">Total Staked</p>
            <p className="font-semibold text-[11px] sm:text-xs md:text-sm leading-tight truncate" style={{ color: '#fb57ff' }}>
              {projectData?.totalStaked 
                ? `${(Number(projectData.totalStaked.toString()) / Math.pow(10, tokenDecimals)).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${symbol}` 
                : "0 " + symbol}
            </p>
          </div>
          
          <div 
            className="bg-white/[0.02] p-2 rounded-lg border border-white/[0.05] cursor-pointer hover:bg-white/[0.04] transition-colors"
            onClick={() => effectiveMintAddress && copyToClipboard(effectiveMintAddress)}
            title={effectiveMintAddress || "No address"}
          >
            <p className="text-gray-500 text-[9px] sm:text-[10px] md:text-xs mb-0.5 leading-tight">Contract</p>
            <p className="text-white font-semibold text-[11px] sm:text-xs md:text-sm leading-tight flex items-center gap-1">
              <span className="font-mono truncate">
                {effectiveMintAddress ? `${effectiveMintAddress.slice(0, 4)}...${effectiveMintAddress.slice(-4)}` : "-"}
              </span>
              {copied ? (
                <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
              ) : (
                <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </p>
          </div>
        </div>

        {/* Your Stake & Lock Period - EXISTING */}
        <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm relative z-10">
          <div className="bg-white/[0.02] p-2 rounded-lg border border-white/[0.05]">
            <p className="text-gray-500 text-[9px] sm:text-[10px] md:text-xs mb-0.5 leading-tight">Your Stake</p>
            <p className="text-white font-semibold text-[11px] sm:text-xs md:text-sm leading-tight truncate">
              {connected ? `${displayStakedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}` : "-"}
            </p>
          </div>
          
          <div className="bg-white/[0.02] p-2 rounded-lg border border-white/[0.05]">
            <p className="text-gray-500 text-[9px] sm:text-[10px] md:text-xs mb-0.5 leading-tight">
              {type === "locked" && lockupInfo.isLocked ? "Unlocks In" : "Lock Period"}
            </p>
            <p className="text-white font-semibold text-[11px] sm:text-xs md:text-sm leading-tight truncate">
              {type === "locked" ? (
                lockupInfo.isLocked ? (
                  <span className="flex items-center gap-1" style={{ color: '#fb57ff' }}>
                    <Clock className="w-3 h-3" />
                    {formatTimeRemaining(lockupInfo.remainingSeconds)}
                  </span>
                ) : userStakedAmount > 0 ? (
                  <span style={{ color: '#fb57ff' }}>✓ Unlocked</span>
                ) : (
                  lockPeriod && lockPeriod !== '0' ? `${lockPeriod}d` : "Unlocked"
                )
              ) : "Flex"}
            </p>
          </div>
        </div>

        {(blockchainPoolEndTime || poolEndTime) && !poolEndInfo.hasEnded && (
          <div className={`p-2 rounded-lg relative z-10 border ${
            poolEndInfo.status === 'critical' 
              ? 'bg-red-500/10 border-red-500/30' 
              : poolEndInfo.status === 'warning'
              ? 'bg-yellow-500/10 border-yellow-500/30'
              : 'bg-white/[0.02] border-white/[0.05]'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Clock className={`w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0 ${
                  poolEndInfo.status === 'critical' 
                    ? 'text-red-400' 
                    : poolEndInfo.status === 'warning'
                    ? 'text-yellow-400'
                    : 'text-gray-400'
                }`} />
                <span className={`text-[9px] sm:text-[10px] md:text-xs ${
                  poolEndInfo.status === 'critical' 
                    ? 'text-red-400' 
                    : poolEndInfo.status === 'warning'
                    ? 'text-yellow-400'
                    : 'text-gray-400'
                }`}>
                  {poolEndInfo.status === 'critical' ? 'Ending Soon!' : 'Pool Ends In'}
                </span>
              </div>
              <span className={`font-bold text-[11px] sm:text-xs md:text-sm ${
                poolEndInfo.status === 'critical' 
                  ? 'text-red-400' 
                  : poolEndInfo.status === 'warning'
                  ? 'text-yellow-400'
                  : 'text-white'
              }`}>
                {formatTimeRemaining(poolEndInfo.remainingSeconds)}
              </span>
            </div>
            {poolEndInfo.endsAt && (
              <p className="text-[8px] sm:text-[9px] text-gray-500 mt-1">
                {poolEndInfo.endsAt.toLocaleDateString()} at {poolEndInfo.endsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}
        <button
          onClick={() => setOpenModal("viewBalances")}
          disabled={!connected}
          className="w-full bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] p-2 rounded-lg relative z-10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-white">View Balances</span>
          </div>
          <div className="flex items-center gap-2">
            {realtimeRewards > 0 && (
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#fb57ff' }}></span>
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#fb57ff' }}></span>
              </div>
            )}
            {reflectionBalance > 0 && (
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#fb57ff' }}></span>
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#fb57ff' }}></span>
              </div>
            )}
          </div>
        </button>

        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 relative z-10">
          <button
            onClick={() => setOpenModal("stake")}
            disabled={isStakeDisabled}
            className="text-white py-2 px-2 rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[36px] leading-tight"
            style={{ background: isStakeDisabled ? 'rgba(255,255,255,0.05)' : 'linear-gradient(45deg, black, #fb57ff)' }}
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
            className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] text-white py-2 px-2 rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[36px] leading-tight"
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
              className="col-span-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] text-white py-2 px-2 rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[36px] leading-tight"
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
                className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] text-white py-2 px-2 rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[36px] leading-tight"
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
                className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] text-white py-2 px-2 rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[36px] leading-tight"
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
          <div className="relative z-10 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-gray-400 bg-white/[0.02] border border-white/[0.05] p-1.5 sm:p-2 rounded leading-tight">
            <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span>Connect wallet to interact</span>
          </div>
        )}
      </div>

      {/* MODAL */}
      {openModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white/[0.02] border border-white/[0.05] p-4 sm:p-6 rounded-2xl shadow-2xl w-full max-w-[calc(100vw-24px)] sm:max-w-md max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                {openModal === "stake" && "💰"}
                {openModal === "unstake" && "📤"}
                {(openModal === "claimRewards" || openModal === "claimSelf" || openModal === "claimExternal") && "🎁"}
                {openModal === "viewBalances" && "📊"}
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

            <div className="bg-white/[0.02] border border-white/[0.05] p-2.5 sm:p-3 rounded-lg mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
              {logo && <img src={logo} alt={name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold text-sm sm:text-base truncate">{name}</p>
                <p className="text-gray-400 text-xs sm:text-sm">{symbol}</p>
              </div>
            </div>

            {(openModal === "stake" || openModal === "unstake") && (
              <>
                <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <p className="text-gray-400 text-xs sm:text-sm font-semibold">
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
                      className="w-full p-2.5 sm:p-3 pr-12 sm:pr-16 rounded-lg bg-white/[0.02] text-white border border-white/[0.05] focus:border-[#fb57ff] focus:outline-none text-base sm:text-lg font-semibold"
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
                  <div className="mb-3 sm:mb-4 p-3 bg-white/[0.02] border border-white/[0.05] rounded-lg space-y-2 text-xs sm:text-sm">
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
                    <div className="border-t border-white/[0.05] pt-2 flex justify-between">
                      <span className="font-semibold" style={{ color: '#fb57ff' }}>You'll Stake:</span>
                      <span className="font-bold" style={{ color: '#fb57ff' }}>{feeCalculation.amountAfterFee.toFixed(4)} {symbol}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mb-3 sm:mb-4">
                  {[25, 50, 100].map((percent) => (
                    <button
                      key={percent}
                      onClick={() => handleQuickSelect(percent)}
                      disabled={isProcessing}
                      className="px-2 py-2.5 sm:py-2 bg-white/[0.05] hover:bg-white/[0.08] active:bg-white/[0.1] border border-white/[0.05] rounded-lg text-xs sm:text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
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
                    className="w-full h-2 bg-white/[0.05] rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor: '#fb57ff' }}
                  />
                  <div className="flex justify-between text-[10px] sm:text-xs text-gray-400 mt-1">
                    <span>0</span>
                    <span>{(openModal === "stake" ? tokenBalance : userStakedAmount).toFixed(2)}</span>
                  </div>
                </div>

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
                    <span>Unlocks in {formatTimeRemaining(lockupInfo.remainingSeconds)}</span>
                  </div>
                )}

                {openModal === "unstake" && amount > userStakedAmount && (
                  <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs sm:text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Cannot unstake more than staked amount</span>
                  </div>
                )}
              </>
            )}

            {(openModal === "claimRewards" || openModal === "claimSelf" || openModal === "claimExternal") && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-400 text-xs sm:text-sm mb-1.5 sm:mb-2">
                  {openModal === "claimRewards" ? "Available to claim:" : "Available reflections to claim:"}
                </p>
                <p className="text-white font-bold text-lg sm:text-xl break-all">
                  {openModal === "claimRewards" ? rewardsDisplay : reflectionsDisplay}
                </p>
                {openModal === "claimRewards" && price && realtimeRewards > 0 && (
                  <p className="text-gray-400 text-xs sm:text-sm mt-1">
                    ≈ ${(realtimeRewards * price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                )}
                {(openModal === "claimSelf" || openModal === "claimExternal") && stakeData?.withdrawalWallet && openModal === "claimExternal" && (
                  <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-400 text-xs mb-1">⚠️ Withdrawal Wallet:</p>
                    <p className="text-white text-xs font-mono break-all">
                      {stakeData.withdrawalWallet.toString()}
                    </p>
                  </div>
                )}
                
                {(openModal === "claimSelf" || openModal === "claimExternal") && (
                  <div className="mt-3">
                    <button
                      onClick={handleRefreshReflections}
                      disabled={isProcessing || !effectiveMintAddress}
                      className="w-full px-3 py-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                    >
                      <Sparkles className="w-4 h-4" style={{ color: '#fb57ff' }} />
                      {isProcessing ? "Refreshing..." : "🔄 Refresh Reflections"}
                    </button>
                    <p className="text-gray-400 text-xs mt-1 text-center">
                      Click to update reflection calculations
                    </p>
                  </div>
                )}

              </div>
            )}

            {openModal === "viewBalances" && (
              <div className="space-y-4">
                {/* Accumulating Rewards */}
                <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Coins className="w-5 h-5 text-green-400" />
                    <span className="text-sm font-semibold text-gray-300">Accumulating Rewards</span>
                    {realtimeRewards > 0 && (
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-auto" />
                    )}
                  </div>
                  <div className="text-green-400 font-bold text-2xl break-all mb-2">
                    {rewardsDisplay}
                  </div>
                  {price && realtimeRewards > 0 && (
                    <div className="text-gray-400 text-sm">
                      ≈ ${(realtimeRewards * price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>

                {/* Reflection Balance */}
                {(hasSelfReflections || hasExternalReflections) && (
                  <div className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5" style={{ color: '#fb57ff' }} />
                        <span className="text-sm font-semibold text-gray-300">Reflection Balance</span>
                        {reflectionLoading && <LoadingSpinner size="sm" />}
                      </div>
                      <button
                        onClick={handleRefreshReflections}
                        disabled={!connected || !effectiveMintAddress || !isInitialized || isProcessing || !(hasSelfReflections || hasExternalReflections)}
                        className="p-2 hover:bg-white/[0.05] rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        title={(hasSelfReflections || hasExternalReflections) ? "Refresh reflection calculations" : "Reflections not enabled for this pool"}
                        type="button"
                      >
                        <Repeat className="w-4 h-4 text-gray-400 hover:text-white" />
                      </button>
                    </div>
                    <div className="font-bold text-2xl break-all" style={{ color: '#fb57ff' }}>
                      {reflectionBalance > 0 
                        ? `${reflectionBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${reflectionTokenSymbol || 'REFLECT'}`
                        : `0.0000 ${reflectionTokenSymbol || 'REFLECT'}`
                      }
                    </div>
                  </div>
                )}

                {/* No Reflections Message */}
                {!hasSelfReflections && !hasExternalReflections && (
                  <div className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-lg text-center">
                    <p className="text-gray-400 text-sm">No reflections available for this pool</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 sm:gap-3">
              {openModal === "viewBalances" ? (
                <button
                  onClick={closeModal}
                  className="w-full px-3 sm:px-4 py-3 bg-white/[0.05] hover:bg-white/[0.08] active:bg-white/[0.1] border border-white/[0.05] rounded-lg text-sm sm:text-base font-semibold transition-all min-h-[48px]"
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    onClick={closeModal}
                    disabled={isProcessing}
                    className="flex-1 px-3 sm:px-4 py-3 bg-white/[0.05] hover:bg-white/[0.08] active:bg-white/[0.1] border border-white/[0.05] rounded-lg text-sm sm:text-base font-semibold transition-all disabled:opacity-50 min-h-[48px]"
                    onMouseEnter={(e) => !isProcessing && (e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)')}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmAction}
                    disabled={isProcessing || !validateTransaction().valid}
                    className="flex-1 px-3 sm:px-4 py-3 rounded-lg text-sm sm:text-base font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px] text-white"
                    style={{ background: (isProcessing || !validateTransaction().valid) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(45deg, black, #fb57ff)' }}
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
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

