"use client";
import { useState, useEffect, useMemo } from "react";
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { 
  Lock, 
  Coins, 
  Clock, 
  TrendingUp, 
  ExternalLink,
  Sparkles,
  Loader2,
  X
} from "lucide-react";
import { useStakingProgram } from "@/hooks/useStakingProgram";
import { useSolanaBalance } from "@/hooks/useSolanaBalance";
import { useToast } from "@/components/ToastContainer";
import { useRealtimeRewards } from "@/utils/calculatePendingRewards";


// Import WalletConnect dynamically to avoid hydration issues
const WalletConnect = dynamic(() => import("@/components/WalletConnect"), { ssr: false });

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

interface EmbedPoolClientProps {
  pool: Pool;
  buttonColor: string;
  theme: "dark" | "light";
}

export default function EmbedPoolClient({ pool, buttonColor, theme }: EmbedPoolClientProps) {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { showToast } = useToast();


  // Force body background and text color based on theme
  useEffect(() => {
    const bgColor = theme === "dark" ? "#060609" : "#ffffff";
    const txtColor = theme === "dark" ? "#f3f4f6" : "#1a1a1a";
    
    // Set with !important priority
    document.body.style.setProperty("background-color", bgColor, "important");
    document.body.style.setProperty("color", txtColor, "important");
    document.documentElement.style.setProperty("background-color", bgColor, "important");
    
    // Remove any conflicting classes
    document.body.classList.remove("bg-[#060609]", "text-gray-100", "dark");
    document.documentElement.classList.remove("dark");
    
    // Add light class if light theme
    if (theme === "light") {
      document.body.classList.add("light-theme");
      document.documentElement.classList.add("light-theme");
    }
    
    return () => {
      // Cleanup on unmount
      document.body.style.removeProperty("background-color");
      document.body.style.removeProperty("color");
      document.documentElement.style.removeProperty("background-color");
      document.body.classList.remove("light-theme");
      document.documentElement.classList.remove("light-theme");
    };
  }, [theme]);

  // Style wallet button with custom colors
  useEffect(() => {
    // Create or update style element
    let styleEl = document.getElementById("embed-wallet-styles");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "embed-wallet-styles";
      document.head.appendChild(styleEl);
    }

    const isDark = theme === "dark";
    const buttonBg = isDark ? `linear-gradient(45deg, black, ${buttonColor})` : buttonColor;
    const buttonHoverBg = isDark ? `linear-gradient(45deg, #1a1a1a, ${buttonColor})` : buttonColor;
    const buttonBgImage = isDark ? `linear-gradient(45deg, black, ${buttonColor})` : "none";
    const buttonHoverBgImage = isDark ? `linear-gradient(45deg, #1a1a1a, ${buttonColor})` : "none";

    styleEl.textContent = `
      #embed-wallet-container button,
      #embed-wallet-container button *,
      body > div.min-h-screen.p-6 > div > div.mb-8.text-center > div.flex.justify-center.mb-6 > div > button,
      .wallet-adapter-button,
      .wallet-adapter-button-trigger,
      button[class*="wallet"],
      div[class*="justify-center"] button {
        background: ${buttonBg} !important;
        background-image: ${buttonBgImage} !important;
        background-color: ${buttonColor} !important;
        border-color: ${buttonColor} !important;
        color: white !important;
      }
      #embed-wallet-container button:hover,
      body > div.min-h-screen.p-6 > div > div.mb-8.text-center > div.flex.justify-center.mb-6 > div > button:hover,
      .wallet-adapter-button:hover,
      .wallet-adapter-button-trigger:hover,
      button[class*="wallet"]:hover,
      div[class*="justify-center"] button:hover {
        background: ${buttonHoverBg} !important;
        background-image: ${buttonHoverBgImage} !important;
        opacity: 0.9 !important;
      }
    `;

    return () => {
      // Cleanup on unmount
      const el = document.getElementById("embed-wallet-styles");
      if (el) el.remove();
    };
  }, [buttonColor, theme]);


  const { 
    stake: blockchainStake, 
    unstake: blockchainUnstake, 
    claimRewards: blockchainClaimRewards,
    getUserStake,
    getPoolRate,
    getProjectInfo,
  } = useStakingProgram();

  const effectiveMintAddress = pool.tokenAddress;
  const { balance: tokenBalance, loading: balanceLoading } = useSolanaBalance(effectiveMintAddress);
  
  const [openModal, setOpenModal] = useState<"stake" | "unstake" | "claimRewards" | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [userStakedAmount, setUserStakedAmount] = useState<number>(0);
  const [userStakeTimestamp, setUserStakeTimestamp] = useState<number>(0);
  const [tokenDecimals, setTokenDecimals] = useState<number>(9);
  const decimalsMultiplier = useMemo(() => Math.pow(10, tokenDecimals), [tokenDecimals]);
  const [dynamicRate, setDynamicRate] = useState<number | null>(null);
  const [projectData, setProjectData] = useState<any>(null);
  const [stakeData, setStakeData] = useState<any>(null);
  const [onChainTotalStaked, setOnChainTotalStaked] = useState<number>(0);
  const [isLoadingAPY, setIsLoadingAPY] = useState(true);

  const poolId = pool.poolId ?? 0;
  const isInitialized = pool.isInitialized;
  const isPaused = pool.isPaused;

  // Fetch token decimals
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

  // Fetch user stake data
  useEffect(() => {
    if (!publicKey || !connected || !effectiveMintAddress || !isInitialized) return;

    const fetchUserStake = async () => {
      try {
        const stake = await getUserStake(effectiveMintAddress, poolId);
        if (stake) {
          setUserStakedAmount(stake.amount / decimalsMultiplier);
          setUserStakeTimestamp(stake.stakedAt);
          setStakeData(stake);
        }
      } catch (error) {
        console.error("Error fetching user stake:", error);
      }
    };

    fetchUserStake();
    const interval = setInterval(fetchUserStake, 10000);
    return () => clearInterval(interval);
  }, [publicKey, connected, effectiveMintAddress, poolId, isInitialized]);

  // Fetch project data
  useEffect(() => {
    if (!effectiveMintAddress || !isInitialized) return;

    const fetchProjectData = async () => {
      try {
        const project = await getProjectInfo(effectiveMintAddress, poolId);
        if (project) {
          setProjectData(project);
          setOnChainTotalStaked(project.totalStaked || 0);
        }
      } catch (error) {
        console.error("Error fetching project data:", error);
      }
    };

    fetchProjectData();
    const interval = setInterval(fetchProjectData, 15000);
    return () => clearInterval(interval);
  }, [effectiveMintAddress, poolId, isInitialized]);

  // Fetch pool rate for dynamic APY
  useEffect(() => {
    if (!effectiveMintAddress || !isInitialized) {
      setIsLoadingAPY(false);
      return;
    }

    const fetchRate = async () => {
      setIsLoadingAPY(true);
      try {
        const rateData = await getPoolRate(effectiveMintAddress, poolId);
        if (rateData) {
          const percentageRate = (rateData.rate / 100);
          setDynamicRate(percentageRate);
        }
      } catch (error) {
        console.error("Error fetching pool rate:", error);
      } finally {
        setIsLoadingAPY(false);
      }
    };

    fetchRate();
    const interval = setInterval(fetchRate, 30000);
    return () => clearInterval(interval);
  }, [effectiveMintAddress, poolId, isInitialized]);

  const realtimeRewards = useRealtimeRewards(projectData, stakeData);

  const handleModalSubmit = async () => {
    if (!effectiveMintAddress || !openModal) return;

    setIsProcessing(true);
    try {
      let txSignature: string | null = null;

      switch (openModal) {
        case "stake":
          const stakeAmount = Math.floor(amount * decimalsMultiplier);
          txSignature = await blockchainStake(effectiveMintAddress, stakeAmount, poolId);
          showToast("✅ Successfully staked!", "success");
          setUserStakedAmount(prev => prev + amount);
          break;

        case "unstake":
          const unstakeAmount = Math.floor(amount * decimalsMultiplier);
          txSignature = await blockchainUnstake(effectiveMintAddress, poolId, unstakeAmount);
          showToast("✅ Successfully unstaked!", "success");
          setUserStakedAmount(prev => prev - amount);
          break;

        case "claimRewards":
          txSignature = await blockchainClaimRewards(effectiveMintAddress, poolId);
          showToast("✅ Successfully claimed rewards!", "success");
          break;
      }

      setOpenModal(null);
      setAmount(0);
    } catch (error: any) {
      console.error(`${openModal} error:`, error);
      showToast(`❌ ${openModal} failed: ${error.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const displayAPY = dynamicRate ?? pool.apy ?? 0;

  const lockPeriodMs = (pool.lockPeriodDays || 0) * 24 * 60 * 60 * 1000;
  const lockupInfo = (() => {
    if (userStakeTimestamp === 0 || !pool.lockPeriodDays) return { isLocked: false, remainingTime: 0, lockEndDate: null };

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

  // Theme-based styling
  const isDark = theme === "dark";
  
  const gradientButtonStyle = {
    background: isDark ? `linear-gradient(45deg, black, ${buttonColor})` : buttonColor,
    color: "#ffffff"
  };

  const gradientTextStyle = {
    background: isDark ? `linear-gradient(45deg, white, ${buttonColor})` : `linear-gradient(45deg, #1a1a1a, ${buttonColor})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  };

  const borderGradientStyle = {
    borderColor: isDark ? `${buttonColor}40` : `${buttonColor}60`
  };

  const backgroundColor = isDark ? "#060609" : "#ffffff";
  const textColor = isDark ? "#ffffff" : "#1a1a1a";
  const secondaryTextColor = isDark ? "#9ca3af" : "#6b7280";
  const cardBg = isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.03)";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.1)";

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex flex-col items-center gap-4 mb-6">
            {pool.logo && (
              <img 
                src={pool.logo} 
                alt={pool.symbol} 
                className="w-20 h-20 rounded-full border-2"
                style={borderGradientStyle}
              />
            )}
            <div>
              <h1 className="text-4xl font-bold mb-2" style={gradientTextStyle}>
                {pool.name}
              </h1>
              <p style={{ color: secondaryTextColor }}>{pool.symbol} Staking Pool</p>
            </div>
          </div>

          {/* Wallet Connect */}
          <div className="flex justify-center mb-6" id="embed-wallet-container">
            <WalletConnect />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <TrendingUp className="w-5 h-5 mx-auto mb-2" style={{ color: buttonColor }} />
              <p className="text-sm" style={{ color: secondaryTextColor }}>APY</p>
              {isLoadingAPY ? (
                <p className="text-2xl font-bold" style={{ color: secondaryTextColor }}>Loading...</p>
              ) : (
                <p className="text-2xl font-bold" style={{ color: textColor }}>{displayAPY.toFixed(2)}%</p>
              )}
            </div>

            <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <Lock className="w-5 h-5 mx-auto mb-2" style={{ color: buttonColor }} />
              <p className="text-sm" style={{ color: secondaryTextColor }}>Lock Period</p>
              <p className="text-2xl font-bold" style={{ color: textColor }}>{pool.lockPeriodDays ? `${Math.floor(pool.lockPeriodDays / 30)}mo` : 'Flex'}</p>
            </div>

            <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <Coins className="w-5 h-5 mx-auto mb-2" style={{ color: buttonColor }} />
              <p className="text-sm" style={{ color: secondaryTextColor }}>Your Stake</p>
              <p className="text-2xl font-bold" style={{ color: textColor }}>{userStakedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>

            <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
              <Sparkles className="w-5 h-5 mx-auto mb-2" style={{ color: buttonColor }} />
              <p className="text-sm" style={{ color: secondaryTextColor }}>Pending Rewards</p>
              <p className="text-2xl font-bold" style={{ color: textColor }}>{realtimeRewards.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setOpenModal("stake")}
            disabled={isStakeDisabled}
            className="py-4 rounded-xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={gradientButtonStyle}
          >
            Stake Tokens
          </button>

          <button
            onClick={() => setOpenModal("unstake")}
            disabled={isUnstakeDisabled}
            className="py-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
              border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
              color: textColor
            }}
          >
            Unstake Tokens
          </button>

          <button
            onClick={() => setOpenModal("claimRewards")}
            disabled={isClaimDisabled}
            className="py-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
              border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
              color: textColor
            }}
          >
            Claim Rewards
          </button>
        </div>

        {/* Powered by StakePoint */}
        <div className="mt-8 text-center">
          <a
            href={`https://stakepoint.app/pool/${pool.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm transition-colors group"
            style={{ color: secondaryTextColor }}
          >
            <span className="group-hover:opacity-80">
              Powered by <span className="font-bold" style={gradientTextStyle}>StakePoint</span>
            </span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Modal */}
      {openModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: "rgba(0, 0, 0, 0.8)" }}>
          <div className="rounded-2xl w-full max-w-md" style={{ 
            background: isDark ? "#0a0b0f" : "#ffffff",
            border: `1px solid ${cardBorder}`
          }}>
            <div className="flex items-center justify-between p-6" style={{ borderBottom: `1px solid ${cardBorder}` }}>
              <h3 className="text-xl font-bold" style={{ color: textColor }}>
                {openModal === "stake" && "Stake Tokens"}
                {openModal === "unstake" && "Unstake Tokens"}
                {openModal === "claimRewards" && "Claim Rewards"}
              </h3>
              <button 
                onClick={() => setOpenModal(null)} 
                className="p-2 rounded-lg"
                style={{ 
                  background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"
                }}
              >
                <X className="w-5 h-5" style={{ color: textColor }} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {openModal !== "claimRewards" && (
                <>
                  <div>
                    <label className="text-sm mb-2 block" style={{ color: secondaryTextColor }}>Amount</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 rounded-lg focus:outline-none transition-colors"
                      style={{ 
                        background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
                        border: `1px solid ${cardBorder}`,
                        color: textColor
                      }}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: secondaryTextColor }}>
                      {openModal === "stake" ? "Available" : "Staked"}: {openModal === "stake" ? tokenBalance.toLocaleString() : userStakedAmount.toLocaleString()} {pool.symbol}
                    </span>
                    <button
                      onClick={() => setAmount(openModal === "stake" ? tokenBalance : userStakedAmount)}
                      className="font-semibold"
                      style={{ color: buttonColor }}
                    >
                      Max
                    </button>
                  </div>
                </>
              )}

              {openModal === "claimRewards" && (
                <div className="rounded-lg p-4 text-center" style={{ 
                  background: cardBg,
                  border: `1px solid ${cardBorder}`
                }}>
                  <p className="text-sm mb-2" style={{ color: secondaryTextColor }}>Claimable Rewards</p>
                  <p className="text-3xl font-bold" style={gradientTextStyle}>{realtimeRewards.toFixed(4)} {pool.symbol}</p>
                </div>
              )}

              <button
                onClick={handleModalSubmit}
                disabled={isProcessing || (openModal !== "claimRewards" && amount <= 0)}
                className="w-full py-3 rounded-lg font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={gradientButtonStyle}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                    Processing...
                  </>
                ) : (
                  `Confirm ${openModal === "stake" ? "Stake" : openModal === "unstake" ? "Unstake" : "Claim"}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

