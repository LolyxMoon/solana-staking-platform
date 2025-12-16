"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { ArrowDownUp, Settings, Info, TrendingUp, Zap, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ToastContainer";
import TokenSelectModal from "./TokenSelectModal";
import { useSearchParams } from "next/navigation";
import { useSound } from '@/hooks/useSound';
import { executeJupiterSwap, getJupiterQuote } from "@/lib/jupiter-swap";
import { Suspense } from "react";

interface SwapSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromToken: string;
  toToken: string;
  txSignature: string;
}

function SwapSuccessModal({ isOpen, onClose, fromToken, toToken, txSignature }: SwapSuccessModalProps) {
  if (!isOpen) return null;

  const getExplorerLink = (signature: string) => {
    return `https://solscan.io/tx/${signature}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white/[0.02] backdrop-blur border border-white/[0.05] rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-300">
        {/* Success Icon */}
        <div className="flex justify-center mb-4">
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
          >
            <svg 
              className="w-8 h-8 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center mb-2 text-white">
          Swap Successful!
        </h2>

        {/* Swap Details */}
        <div className="text-center mb-4">
          <p className="text-gray-400 text-sm">
            {fromToken} → {toToken}
          </p>
        </div>

        {/* Message */}
        <div 
          className="border rounded-lg p-4 mb-6"
          style={{ background: 'rgba(251, 87, 255, 0.1)', borderColor: 'rgba(251, 87, 255, 0.3)' }}
        >
          <p className="text-center font-semibold mb-1" style={{ color: '#fb57ff' }}>
            🏆 Compete for Rewards!
          </p>
          <p className="text-center text-sm text-gray-300">
            Swap your way to the top of the weekly swap leaderboard and earn exclusive rewards!
          </p>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <a
            href={getExplorerLink(txSignature)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold transition-all hover:opacity-90 text-white"
            style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
          >
            <span>View on Solscan</span>
            <ExternalLink className="w-4 h-4" />
          </a>
          
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-semibold bg-white/[0.05] hover:bg-white/[0.08] transition-all text-white border border-white/[0.05]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface SwapConfig {
  swapEnabled: boolean;
  platformFeePercentage: number;
  platformFeeBps: number;
  maxSlippage: number;
  priorityFee: number;
  treasuryWallet: string;
}

// Get Jupiter referral config
const JUPITER_REFERRAL_ACCOUNT = process.env.NEXT_PUBLIC_JUPITER_REFERRAL_ACCOUNT || "";
const JUPITER_REFERRAL_FEE_BPS = parseInt(process.env.NEXT_PUBLIC_JUPITER_REFERRAL_FEE || "50");

function SwapPageContent() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { showSuccess, showError, showInfo } = useToast();

  const { playSound } = useSound();
  const searchParams = useSearchParams();

  // State
  const [tokens, setTokens] = useState<Token[]>([]);
  const [featuredTokens, setFeaturedTokens] = useState<Token[]>([]);
  const [config, setConfig] = useState<SwapConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [swapping, setSwapping] = useState(false);

  // Form state
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  
  // ✅ NEW: Auto Slippage & Priority Fee State
  const [slippageMode, setSlippageMode] = useState<"auto" | "custom">("auto");
  const [customSlippage, setCustomSlippage] = useState(1.0);
  const [autoSlippage, setAutoSlippage] = useState(0.5);
  const [priorityFee, setPriorityFee] = useState(0.0001);
  
  // Computed slippage value based on mode
  const slippage = slippageMode === "auto" ? autoSlippage : customSlippage;
  
  // UI state
  const [showTokenSelect, setShowTokenSelect] = useState<"from" | "to" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [lastTxSignature, setLastTxSignature] = useState<string | null>(null);
  const [currentQuote, setCurrentQuote] = useState<any>(null);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    fromToken: string;
    toToken: string;
    txSignature: string;
  } | null>(null);

  // ✅ Calculate Auto Slippage Based on Quote
  useEffect(() => {
    if (slippageMode === "auto" && currentQuote) {
      const calculatedSlippage = calculateAutoSlippage(currentQuote);
      setAutoSlippage(calculatedSlippage);
    }
  }, [currentQuote, slippageMode]);

  // ✅ Smart Auto Slippage Calculator
  const calculateAutoSlippage = (quote: any) => {
    let calculatedSlippage = 0.5; // 0.5% default
    
    // Check if quote has slippage recommendation
    if (quote.slippageBps) {
      calculatedSlippage = quote.slippageBps / 100;
    } else {
      // Fallback: estimate based on price impact
      const priceImpact = quote.priceImpactPct || 0;
      
      if (priceImpact > 2) {
        calculatedSlippage = 2.0; // 2%
      } else if (priceImpact > 1) {
        calculatedSlippage = 1.0; // 1%
      } else if (priceImpact > 0.5) {
        calculatedSlippage = 0.5; // 0.5%
      } else {
        calculatedSlippage = 0.3; // 0.3%
      }
    }
    
    // Ensure it's within limits
    const maxAllowed = config?.maxSlippage || 10;
    return Math.min(calculatedSlippage, maxAllowed);
  };

  // Load config from API
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch("/api/swap/config");
        
        if (res.ok) {
          const data = await res.json();
          
          console.log('📋 Loaded swap config from API:', data);
          
          const platformFeePercentage = (data.platformFeeBps || 100) / 100;
          const maxSlippage = (data.maxSlippageBps || 5000) / 100;
          
          setConfig({
            swapEnabled: data.swapEnabled ?? true,
            platformFeePercentage,
            platformFeeBps: data.platformFeeBps || 100,
            maxSlippage,
            priorityFee: 0.0001,
            treasuryWallet: data.treasuryWallet || "",
          });
          
          console.log('✅ Config loaded successfully');
          
          if (customSlippage > maxSlippage) {
            setCustomSlippage(maxSlippage);
          }
        } else {
          setConfig({
            swapEnabled: true,
            platformFeePercentage: 1.0,
            platformFeeBps: 100,
            maxSlippage: 50.0,
            priorityFee: 0.0001,
            treasuryWallet: "",
          });
        }
      } catch (error) {
        console.error("❌ Failed to load config:", error);
        setConfig({
          swapEnabled: true,
          platformFeePercentage: 1.0,
          platformFeeBps: 100,
          maxSlippage: 50.0,
          priorityFee: 0.0001,
          treasuryWallet: "",
        });
      }
    };

    loadConfig();
  }, []);

  // Load tokens and featured tokens
  useEffect(() => {
    loadTokens();
  }, []);

  // Load token from URL param (for /swap?outputMint=xxx)
    useEffect(() => {
      const outputMint = searchParams.get('outputMint');
      if (outputMint && !loading) {
        // Check featured tokens first
        const featured = featuredTokens.find(t => t.address === outputMint);
        if (featured) {
          setToToken(featured);
          return;
        }
        
        // Otherwise fetch token metadata from DexScreener
        const fetchTokenInfo = async () => {
          try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${outputMint}`);
            const data = await res.json();
            const pair = data.pairs?.[0];
            if (pair) {
              setToToken({
                address: outputMint,
                symbol: pair.baseToken.symbol,
                name: pair.baseToken.name,
                decimals: pair.baseToken.decimals || 9,
                logoURI: pair.info?.imageUrl || undefined,
              });
            }
          } catch (e) {
            console.error("Failed to fetch token info:", e);
          }
        };
        fetchTokenInfo();
      }
    }, [searchParams, featuredTokens, loading]);

  const loadTokens = async () => {
    setLoading(true);
    try {
      // Load featured tokens
      try {
        const featuredRes = await fetch("/api/admin/featured-tokens");
        if (featuredRes.ok) {
          const featuredData = await featuredRes.json();
          const enabledFeaturedTokens = (featuredData.featuredTokens || [])
            .filter((ft: any) => ft.enabled)
            .sort((a: any, b: any) => a.order - b.order);
          
          setFeaturedTokens(enabledFeaturedTokens);
          console.log('✅ Loaded featured tokens:', enabledFeaturedTokens.length);
        }
      } catch (featuredError) {
        console.error("Failed to load featured tokens:", featuredError);
      }

      // Default tokens for mainnet
      const sol = {
        address: "So11111111111111111111111111111111111111112",
        symbol: "SOL",
        name: "Wrapped SOL",
        decimals: 9,
        logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
      };
      const usdc = {
        address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png"
      };
      
      setFromToken(sol);
      setToToken(usdc);
    } catch (error) {
      console.error("Failed to load tokens:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get quote when amount changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fromToken && toToken && fromAmount && parseFloat(fromAmount) > 0) {
        getQuote();
      } else {
        setToAmount("");
        setCurrentQuote(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [fromToken, toToken, fromAmount, slippage]);

  // Fetch token balance
  useEffect(() => {
    if (publicKey && fromToken) {
      fetchTokenBalance();
    } else {
      setTokenBalance(null);
    }
  }, [publicKey, fromToken]);

  const fetchTokenBalance = async () => {
    if (!publicKey || !fromToken) return;

    try {
      // For SOL (native token)
      if (fromToken.address === "So11111111111111111111111111111111111111112") {
        const balance = await connection.getBalance(publicKey);
        setTokenBalance(balance / Math.pow(10, 9));
      } else {
        // For SPL tokens
        const tokenMint = new PublicKey(fromToken.address);
        const tokenAccount = await getAssociatedTokenAddress(tokenMint, publicKey);
        
        try {
          const accountInfo = await getAccount(connection, tokenAccount);
          const balance = Number(accountInfo.amount) / Math.pow(10, fromToken.decimals);
          setTokenBalance(balance);
        } catch (splError: any) {
          // Try Token-2022
          try {
            const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
            const token2022Account = await getAssociatedTokenAddress(
              tokenMint,
              publicKey,
              false,
              TOKEN_2022_PROGRAM_ID
            );
            
            const accountInfo = await getAccount(connection, token2022Account, undefined, TOKEN_2022_PROGRAM_ID);
            const balance = Number(accountInfo.amount) / Math.pow(10, fromToken.decimals);
            setTokenBalance(balance);
          } catch (token2022Error: any) {
            setTokenBalance(0);
          }
        }
      }
    } catch (error) {
      console.error("❌ Failed to fetch balance:", error);
      setTokenBalance(null);
    }
  };

  const handleHalfAmount = () => {
    if (tokenBalance === null) return;
    
    // For SOL, leave 0.015 SOL buffer (suggestion only - not enforced)
    if (fromToken?.address === "So11111111111111111111111111111111111111112") {
      const buffer = 0.015;
      const maxUsable = Math.max(0, tokenBalance - buffer);
      const halfAmount = maxUsable * 0.5;
      setFromAmount(halfAmount.toFixed(6));
    } else {
      const halfAmount = tokenBalance * 0.5;
      setFromAmount(halfAmount.toFixed(6));
    }
  };

  const handleMaxAmount = () => {
    if (tokenBalance === null) return;
    
    // For SOL, leave 0.015 SOL buffer (helpful suggestion - user can override)
    if (fromToken?.address === "So11111111111111111111111111111111111111112") {
      const buffer = 0.015; // Accounts for swap fees + round-trip capability
      const maxAmount = Math.max(0, tokenBalance - buffer);
      setFromAmount(maxAmount.toFixed(6));
      
      console.log('💰 MAX calculation:', {
        balance: tokenBalance.toFixed(6) + ' SOL',
        buffer: buffer + ' SOL (suggestion - not enforced)',
        maxAmount: maxAmount.toFixed(6) + ' SOL',
      });
    } else {
      setFromAmount(tokenBalance.toFixed(6));
    }
  };

  const getQuote = async () => {
    if (!fromToken || !toToken || !fromAmount) return;

    setQuoteLoading(true);
    try {
      const amount = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals));
      
      console.log('🔍 Fetching quote:', {
        from: fromToken.symbol,
        to: toToken.symbol,
        amount: fromAmount,
      });
      
      const quote = await getJupiterQuote(
        fromToken.address,
        toToken.address,
        amount,
        Math.floor(slippage * 100),
        config?.platformFeeBps,
        config?.treasuryWallet
      );
      
      if (!quote) {
        console.error('❌ Failed to get quote');
        setToAmount("");
        setCurrentQuote(null);
        return;
      }
      
      console.log('📊 Quote received from Jupiter');
      setCurrentQuote({ ...quote, source: 'Jupiter' });
      
      if (quote.outAmount) {
        const outAmountDecimal = parseFloat(quote.outAmount) / Math.pow(10, toToken.decimals);
        const displayDecimals = outAmountDecimal < 0.01 ? 8 : outAmountDecimal < 1 ? 6 : 2;
        setToAmount(outAmountDecimal.toFixed(displayDecimals));
      } else {
        setToAmount("");
      }
    } catch (error) {
      console.error("❌ Failed to get quote:", error);
      setToAmount("");
      setCurrentQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!publicKey || !sendTransaction || !fromToken || !toToken || !fromAmount) {
      playSound('error'); // ✅ ADD THIS LINE
      showError("Please connect wallet");
      return;
    }

    if (!config?.swapEnabled) {
      playSound('error'); // ✅ ADD THIS LINE
      showError("Swap disabled");
      return;
    }

    // NO FRONTEND VALIDATION BLOCKS!
    // Let Jupiter handle all validation and show real errors

    setSwapping(true);
    setLastTxSignature(null);
    
    try {
      const amount = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals));

      console.log('🔄 Executing swap via Jupiter...', {
        from: fromToken.symbol,
        to: toToken.symbol,
        amount: fromAmount,
      });

      const txid = await executeJupiterSwap(
        connection,
        publicKey,
        fromToken.address,
        toToken.address,
        amount,
        Math.floor(slippage * 100),
        sendTransaction,
        config?.platformFeeBps,
        config?.treasuryWallet
      );

      console.log('✅ Swap transaction sent:', txid);
      setLastTxSignature(txid);

      showInfo('📤 Swap sent...');

      // Wait for confirmation using polling (no WebSocket needed)
      try {
        let confirmed = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max
        
        while (!confirmed && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          attempts++;
          
          const status = await connection.getSignatureStatus(txid);
          
          if (status.value?.confirmationStatus === 'confirmed' || 
              status.value?.confirmationStatus === 'finalized') {
            confirmed = true;
            console.log('✅ Transaction confirmed!');
            
            playSound('swap');
            
            setSuccessModalData({
              fromToken: fromToken.symbol,
              toToken: toToken.symbol,
              txSignature: txid,
            });
            setShowSuccessModal(true);
            
            setFromAmount("");
            setToAmount("");
            setCurrentQuote(null);
            fetchTokenBalance();
          } else if (status.value?.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
          }
        }
        
        if (!confirmed) {
          // Transaction still pending after 30 seconds
          showInfo('⏳ Swap sent - check wallet for confirmation');
          setFromAmount("");
          setToAmount("");
          fetchTokenBalance();
        }
        
      } catch (confirmError: any) {
        console.warn('⚠️ Confirmation check failed:', confirmError.message);
        showInfo('⏳ Swap sent - check wallet for confirmation');
        setFromAmount("");
        setToAmount("");
        fetchTokenBalance();
      }
    
      // Record stats
      try {
        const { calculateSwapVolumeUSD } = await import('@/lib/token-prices');
        
        const fromAmountDecimal = parseFloat(fromAmount);
        const toAmountDecimal = parseFloat(toAmount);
        
        const { volumeUsd, priceUsd } = await calculateSwapVolumeUSD(
          fromToken.address,
          fromAmountDecimal,
          toToken.address,
          toAmountDecimal
        );

        await fetch("/api/swap/stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromToken: fromToken.symbol,
            toToken: toToken.symbol,
            fromAmount: fromAmountDecimal,
            toAmount: toAmountDecimal,
            userAddress: publicKey.toString(),
            txid: txid,
            source: 'Jupiter',
            referralFeeCollected: !!JUPITER_REFERRAL_ACCOUNT,
            volumeUsd: volumeUsd,
            priceUsd: priceUsd,
          }),
        });
      } catch (statsError) {
        console.error('Stats recording failed:', statsError);
      }

    } catch (error: any) {
      playSound('error');
      console.error("❌ Swap error:", error);
      
      playSound('error'); // ✅ ADD THIS LINE (IMPORTANT - at start of catch block)
      
      // Show Jupiter's actual error message
      if (error.message?.includes('User rejected')) {
        showError("Transaction cancelled");
      } else if (error.message?.includes('Insufficient SOL')) {
        // Jupiter's actual error about needing more SOL
        showError(error.message);
      } else if (error.message?.includes('insufficient') || error.message?.includes('Insufficient')) {
        showError(error.message.substring(0, 60));
      } else if (error.message?.includes('Slippage')) {
        showError("Slippage exceeded - try higher %");
      } else if (error.message?.includes('Blockhash not found')) {
        showError("Transaction expired - try again");
      } else if (error.message) {
        // Show first 60 chars of actual error
        showError(error.message.substring(0, 60));
      } else {
        showError("Swap failed");
      }
    } finally {
      setSwapping(false);
    }
  };

  const switchTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount(toAmount);
    setToAmount("");
    setCurrentQuote(null);
  };

  const getExplorerLink = (signature: string) => {
    return `https://solscan.io/tx/${signature}`;
  };

  const jupiterFeePercentage = JUPITER_REFERRAL_FEE_BPS / 100;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 
            className="text-4xl font-bold"
            style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
          >
            Token Swap
          </h1>
          <p className="text-gray-400">
            Powered by StakePoint
          </p>
          
          {!JUPITER_REFERRAL_ACCOUNT && (
            <div className="mt-2 border rounded-lg p-2" style={{ background: 'rgba(251, 191, 0, 0.2)', borderColor: 'rgba(251, 191, 0, 0.5)' }}>
              <p className="text-sm text-yellow-200">
                ⚠️ Jupiter referral not configured
              </p>
            </div>
          )}
          
          {config && !config.swapEnabled && (
            <div className="mt-4 bg-red-500/20 border border-red-500 rounded-lg p-3">
              <p className="text-red-200 font-semibold">⚠️ Swap Disabled</p>
            </div>
          )}
        </div>

        {/* Swap Card */}
        <div className="bg-white/[0.02] backdrop-blur border border-white/[0.05] rounded-2xl p-6 space-y-4">
          {/* Settings Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg hover:bg-white/[0.05] transition-all"
            >
              <Settings className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* ✅ UPDATED Settings Panel with Auto Slippage & Priority Fee */}
          {showSettings && (
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 space-y-4">
              
              {/* Slippage Mode Toggle */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm text-gray-400">Slippage Tolerance</label>
                  <div className="flex gap-1 bg-white/[0.05] rounded-lg p-1">
                    <button
                      onClick={() => setSlippageMode("auto")}
                      className={`px-3 py-1 text-xs rounded transition-all ${
                        slippageMode === "auto"
                          ? "text-white"
                          : "text-gray-400 hover:text-gray-300"
                      }`}
                      style={slippageMode === "auto" ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}
                    >
                      Auto
                    </button>
                    <button
                      onClick={() => setSlippageMode("custom")}
                      className={`px-3 py-1 text-xs rounded transition-all ${
                        slippageMode === "custom"
                          ? "text-white"
                          : "text-gray-400 hover:text-gray-300"
                      }`}
                      style={slippageMode === "custom" ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                {/* Auto Mode - Show calculated value */}
                {slippageMode === "auto" && (
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Auto Slippage:</span>
                      <span className="font-semibold" style={{ color: '#fb57ff' }}>
                        {autoSlippage.toFixed(2)}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      ✨ Automatically adjusted based on market conditions
                    </p>
                  </div>
                )}

                {/* Custom Mode - Show preset buttons and input */}
                {slippageMode === "custom" && (
                  <>
                    <div className="flex gap-2">
                      {[0.1, 0.5, 1.0, 2.0].map((value) => (
                        <button
                          key={value}
                          onClick={() => setCustomSlippage(value)}
                          disabled={config && value > config.maxSlippage}
                          className={`flex-1 px-3 py-2 rounded-lg transition-all disabled:opacity-50 ${
                            customSlippage === value
                              ? "text-white"
                              : "bg-white/[0.05] text-gray-300 hover:bg-white/[0.08]"
                          }`}
                          style={customSlippage === value ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}
                        >
                          {value}%
                        </button>
                      ))}
                      <input
                        type="number"
                        value={customSlippage}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 1.0;
                          if (!config || value <= config.maxSlippage) {
                            setCustomSlippage(value);
                          }
                        }}
                        max={config?.maxSlippage}
                        className="w-20 px-3 py-2 bg-white/[0.05] border border-white/[0.05] rounded-lg text-white text-center focus:outline-none"
                        style={{ borderColor: 'rgba(251, 87, 255, 0.3)' }}
                        step="0.1"
                        min="0.1"
                      />
                    </div>
                    {config && customSlippage > config.maxSlippage && (
                      <p className="text-xs text-yellow-400 mt-1">
                        ⚠️ Maximum slippage is {config.maxSlippage}%
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* ✅ Priority Fee Control */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Priority Fee (SOL)
                </label>
                <div className="flex gap-2">
                  {[
                    { label: "Low", value: 0.00001 },
                    { label: "Med", value: 0.0001 },
                    { label: "High", value: 0.001 },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setPriorityFee(option.value)}
                      className={`flex-1 px-3 py-2 rounded-lg transition-all text-xs ${
                        priorityFee === option.value
                          ? "text-white"
                          : "bg-white/[0.05] text-gray-300 hover:bg-white/[0.08]"
                      }`}
                      style={priorityFee === option.value ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}
                    >
                      <div>{option.label}</div>
                      <div className="text-[10px] text-gray-400">{option.value}</div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Higher priority = faster confirmation
                </p>
              </div>
            </div>
          )}

          {/* From Token */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-400">You Pay</label>
              {publicKey && fromToken && (
                <div className="flex gap-1">
                  <button
                    onClick={handleHalfAmount}
                    className="text-xs px-2 py-1 rounded-lg hover:bg-white/[0.08] transition-all"
                    style={{ color: '#fb57ff' }}
                  >
                    50%
                  </button>
                  <button
                    onClick={handleMaxAmount}
                    className="text-xs px-2 py-1 rounded-lg hover:bg-white/[0.08] transition-all"
                    style={{ color: '#fb57ff' }}
                  >
                    MAX
                  </button>
                </div>
              )}
            </div>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <button
                  onClick={() => setShowTokenSelect("from")}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-white/[0.05] rounded-lg hover:bg-white/[0.08] transition-all flex-shrink-0"
                >
                  {fromToken?.logoURI && (
                    <img src={fromToken.logoURI} alt={fromToken.symbol} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" />
                  )}
                  <span className="font-semibold text-sm sm:text-base">{fromToken?.symbol || "Select"}</span>
                  <span className="text-gray-400 text-xs sm:text-sm">▼</span>
                </button>
                <input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={config && !config.swapEnabled}
                  className="flex-1 min-w-0 bg-transparent text-right text-lg sm:text-2xl font-bold focus:outline-none disabled:opacity-50"
                />
              </div>
              {publicKey && fromToken && tokenBalance !== null && (
                <div className="text-right text-xs text-gray-400">
                  Balance: {tokenBalance.toFixed(6)} {fromToken.symbol}
                </div>
              )}
            </div>
          </div>

          {/* Switch Button */}
          <div className="flex justify-center -my-2">
            <button
              onClick={switchTokens}
              disabled={config && !config.swapEnabled}
              className="p-2 bg-white/[0.05] border-4 border-[#060609] rounded-xl hover:bg-white/[0.08] transition-all disabled:opacity-50"
            >
              <ArrowDownUp className="w-5 h-5" style={{ color: '#fb57ff' }} />
            </button>
          </div>

          {/* To Token */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">You Receive</label>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <button
                  onClick={() => setShowTokenSelect("to")}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-white/[0.05] rounded-lg hover:bg-white/[0.08] transition-all flex-shrink-0"
                >
                  {toToken?.logoURI && (
                    <img src={toToken.logoURI} alt={toToken.symbol} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" />
                  )}
                  <span className="font-semibold text-sm sm:text-base">{toToken?.symbol || "Select"}</span>
                  <span className="text-gray-400 text-xs sm:text-sm">▼</span>
                </button>
                <div className="flex-1 min-w-0 text-right text-lg sm:text-2xl font-bold overflow-hidden">
                  {quoteLoading ? (
                    <span className="text-gray-400">Loading...</span>
                  ) : (
                    <span className="block truncate">{toAmount || "0.00"}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Info */}
          {fromAmount && toAmount && (
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Route</span>
                <span className="text-white">Jupiter</span>
              </div>
              {fromToken && toToken && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Rate</span>
                  <span className="text-white">
                    1 {fromToken.symbol} ≈ {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken.symbol}
                  </span>
                </div>
              )}
              {JUPITER_REFERRAL_ACCOUNT && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Fee ({jupiterFeePercentage}%)</span>
                  <span className="text-white">
                    {((parseFloat(fromAmount) * jupiterFeePercentage) / 100).toFixed(6)} {fromToken?.symbol}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Slippage</span>
                <span className="text-white">{slippage.toFixed(2)}% {slippageMode === "auto" && "✨"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Priority Fee</span>
                <span className="text-white">{priorityFee} SOL</span>
              </div>
            </div>
          )}

          {/* Last Transaction */}
          {lastTxSignature && (
            <a
              href={getExplorerLink(lastTxSignature)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 p-3 bg-green-500/20 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-all"
            >
              <span className="text-sm text-green-200 truncate">View on Solscan</span>
              <ExternalLink className="w-4 h-4 text-green-400 flex-shrink-0" />
            </a>
          )}

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={
              swapping ||
              !publicKey ||
              !fromToken ||
              !toToken ||
              !fromAmount ||
              parseFloat(fromAmount) <= 0 ||
              (config && !config.swapEnabled)
            }
            className="w-full py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
          >
            {swapping ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                Swapping...
              </>
            ) : !publicKey ? (
              "Connect Wallet"
            ) : config && !config.swapEnabled ? (
              "Swap Disabled"
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Swap
              </>
            )}
          </button>

          {!publicKey && (
            <div className="border rounded-lg p-3 flex items-start gap-2" style={{ background: 'rgba(251, 87, 255, 0.2)', borderColor: 'rgba(251, 87, 255, 0.5)' }}>
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#fb57ff' }} />
              <p className="text-sm" style={{ color: '#fb57ff' }}>
                Connect wallet to start swapping
              </p>
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5" style={{ color: '#fb57ff' }} />
              <span className="font-semibold text-white">Jupiter Routing</span>
            </div>
            <p className="text-sm text-gray-400">
              Premium routing with the very best prices available!
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5" style={{ color: '#fb57ff' }} />
              <span className="font-semibold text-white">Best Execution</span>
            </div>
            <p className="text-sm text-gray-400">
              Fast and reliable swaps to ensure super speed swap execution!
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-5 h-5" style={{ color: '#fb57ff' }} />
              <span className="font-semibold text-white">Swap Rewards</span>
            </div>
            <p className="text-sm text-gray-400">
              {JUPITER_REFERRAL_ACCOUNT 
                ? "Swap your way to the top of the weekly leaderboard to earn swap rewards!"
                : "Coming soon"}
            </p>
          </div>
        </div>
      </div>

      {/* Token Select Modal */}
      <TokenSelectModal
        isOpen={showTokenSelect !== null}
        featuredTokens={featuredTokens}
        onSelectToken={(token) => {
          if (showTokenSelect === "from") {
            setFromToken(token);
          } else {
            setToToken(token);
          }
          setShowTokenSelect(null);
        }}
        onClose={() => setShowTokenSelect(null)}
        title={showTokenSelect === "from" ? "Select token to pay" : "Select token to receive"}
      />

      {/* Success Modal */}
      {successModalData && (
        <SwapSuccessModal
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false);
            setSuccessModalData(null);
          }}
          fromToken={successModalData.fromToken}
          toToken={successModalData.toToken}
          txSignature={successModalData.txSignature}
        />
      )}
    </div>
  );
}

export default function SwapPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#fb57ff', borderTopColor: 'transparent' }} /></div>}>
      <SwapPageContent />
    </Suspense>
  );
}