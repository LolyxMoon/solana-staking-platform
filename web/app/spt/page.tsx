"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { 
  Copy, 
  Check, 
  ArrowDownUp, 
  ExternalLink, 
  TrendingUp,
  Coins,
  Calendar,
  Users,
  Zap,
  ChevronDown,
  Wallet
} from "lucide-react";
import { useToast } from "@/components/ToastContainer";
import { useSound } from "@/hooks/useSound";
import { executeJupiterSwap, getJupiterQuote } from "@/lib/jupiter-swap";
import type { Metadata } from "next";
import Link from "next/link";

// SPT Token Constants
const SPT_MINT = "6uUU2z5GBasaxnkcqiQVHa2SXL68mAXDsq1zYN5Qxrm7";
const SPT_DECIMALS = 9;
const SPT_SYMBOL = "SPT";
const SPT_NAME = "StakePoint";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_DECIMALS = 9;
const SOL_SYMBOL = "SOL";
const SOL_LOGO = "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";

// DexScreener pair for chart embed
const DEXSCREENER_PAIR = "A1d4sAmgi4Njnodmc289HP7TaPxw54n4Ey3LRDfrBvo5";

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
}

const SOL_TOKEN: TokenInfo = {
  address: SOL_MINT,
  symbol: SOL_SYMBOL,
  name: "Solana",
  decimals: SOL_DECIMALS,
  logoURI: SOL_LOGO,
};

export default function SPTTokenPage() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { showSuccess, showError, showInfo } = useToast();
  const { playSound } = useSound();

  // Copy state
  const [copied, setCopied] = useState(false);

  // SPT Token with dynamic logo from DexScreener
  const [sptToken, setSptToken] = useState<TokenInfo>({
    address: SPT_MINT,
    symbol: SPT_SYMBOL,
    name: SPT_NAME,
    decimals: SPT_DECIMALS,
    logoURI: "",
  });

  // Swap state
  const [fromToken, setFromToken] = useState<TokenInfo>(SOL_TOKEN);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [slippage] = useState(1.0);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [currentQuote, setCurrentQuote] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Live price data
  const [priceData, setPriceData] = useState<{
    priceUsd: string;
    priceChange24h: number;
    volume24h: string;
    liquidity: string;
    marketCap: string;
  } | null>(null);

  // Copy CA to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(SPT_MINT);
      setCopied(true);
      showSuccess("Contract address copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showError("Failed to copy");
    }
  };

  // Batch fetch all SPT data from DexScreener on mount
  useEffect(() => {
    const fetchSPTData = async () => {
      setDataLoading(true);
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SPT_MINT}`);
        const data = await res.json();
        const pair = data.pairs?.[0];
        
        if (pair) {
          // Get logo from DexScreener - check multiple possible paths
          const logoUrl = pair.info?.imageUrl 
            || pair.baseToken?.logoURI 
            || `https://dd.dexscreener.com/ds-data/tokens/solana/${SPT_MINT}.png`
            || "";
          
          console.log("SPT Logo URL:", logoUrl);
          
          // Update SPT token with logo
          const updatedSptToken: TokenInfo = {
            address: SPT_MINT,
            symbol: SPT_SYMBOL,
            name: SPT_NAME,
            decimals: SPT_DECIMALS,
            logoURI: logoUrl,
          };
          
          setSptToken(updatedSptToken);
          setToToken(updatedSptToken);
          
          // Set price data
          setPriceData({
            priceUsd: pair.priceUsd || "0",
            priceChange24h: pair.priceChange?.h24 || 0,
            volume24h: pair.volume?.h24?.toString() || "0",
            liquidity: pair.liquidity?.usd?.toString() || "0",
            marketCap: pair.marketCap?.toString() || "0",
          });
        }
      } catch (error) {
        console.error("Failed to fetch SPT data:", error);
        // Fallback - set toToken with direct DexScreener CDN URL
        const fallbackToken: TokenInfo = {
          address: SPT_MINT,
          symbol: SPT_SYMBOL,
          name: SPT_NAME,
          decimals: SPT_DECIMALS,
          logoURI: `https://dd.dexscreener.com/ds-data/tokens/solana/${SPT_MINT}.png`,
        };
        setSptToken(fallbackToken);
        setToToken(fallbackToken);
      } finally {
        setDataLoading(false);
      }
    };

    fetchSPTData();
    
    // Refresh price data every 30s
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SPT_MINT}`);
        const data = await res.json();
        const pair = data.pairs?.[0];
        
        if (pair) {
          setPriceData({
            priceUsd: pair.priceUsd || "0",
            priceChange24h: pair.priceChange?.h24 || 0,
            volume24h: pair.volume?.h24?.toString() || "0",
            liquidity: pair.liquidity?.usd?.toString() || "0",
            marketCap: pair.marketCap?.toString() || "0",
          });
        }
      } catch (error) {
        console.error("Failed to refresh price data:", error);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

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
      if (fromToken.address === SOL_MINT) {
        const balance = await connection.getBalance(publicKey);
        setTokenBalance(balance / Math.pow(10, 9));
      } else {
        const tokenMint = new PublicKey(fromToken.address);
        const tokenAccount = await getAssociatedTokenAddress(tokenMint, publicKey);
        
        try {
          const accountInfo = await getAccount(connection, tokenAccount);
          const balance = Number(accountInfo.amount) / Math.pow(10, fromToken.decimals);
          setTokenBalance(balance);
        } catch {
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
          } catch {
            setTokenBalance(0);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      setTokenBalance(null);
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
  }, [fromToken, toToken, fromAmount]);

  const getQuote = async () => {
    if (!fromToken || !toToken || !fromAmount) return;

    setQuoteLoading(true);
    try {
      const amount = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals));
      
      const quote = await getJupiterQuote(
        fromToken.address,
        toToken.address,
        amount,
        Math.floor(slippage * 100)
      );
      
      if (quote?.outAmount) {
        setCurrentQuote(quote);
        const outAmountDecimal = parseFloat(quote.outAmount) / Math.pow(10, toToken.decimals);
        const displayDecimals = outAmountDecimal < 0.01 ? 8 : outAmountDecimal < 1 ? 6 : 2;
        setToAmount(outAmountDecimal.toFixed(displayDecimals));
      } else {
        setToAmount("");
        setCurrentQuote(null);
      }
    } catch (error) {
      console.error("Failed to get quote:", error);
      setToAmount("");
      setCurrentQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  };

  // Switch tokens (buy/sell toggle)
  const switchTokens = () => {
    if (!toToken) return;
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount(toAmount);
    setToAmount("");
    setCurrentQuote(null);
  };

  // Handle max amount
  const handleMaxAmount = () => {
    if (tokenBalance === null) return;
    
    if (fromToken.address === SOL_MINT) {
      const buffer = 0.015;
      const maxAmount = Math.max(0, tokenBalance - buffer);
      setFromAmount(maxAmount.toFixed(6));
    } else {
      setFromAmount(tokenBalance.toFixed(6));
    }
  };

  // Execute swap
  const handleSwap = async () => {
    if (!publicKey || !sendTransaction || !fromToken || !toToken || !fromAmount) {
      playSound('error');
      showError("Please connect wallet");
      return;
    }

    setSwapping(true);
    
    try {
      const amount = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals));

      const txid = await executeJupiterSwap(
        connection,
        publicKey,
        fromToken.address,
        toToken.address,
        amount,
        Math.floor(slippage * 100),
        sendTransaction
      );

      showInfo('📤 Swap sent...');

      // Poll for confirmation
      let confirmed = false;
      let attempts = 0;
      
      while (!confirmed && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
        const status = await connection.getSignatureStatus(txid);
        
        if (status.value?.confirmationStatus === 'confirmed' || 
            status.value?.confirmationStatus === 'finalized') {
          confirmed = true;
          playSound('swap');
          showSuccess('✅ Swap successful!');
          setFromAmount("");
          setToAmount("");
          setCurrentQuote(null);
          fetchTokenBalance();
        } else if (status.value?.err) {
          throw new Error(`Transaction failed`);
        }
      }
      
      if (!confirmed) {
        showInfo('⏳ Swap sent - check wallet for confirmation');
        setFromAmount("");
        setToAmount("");
        fetchTokenBalance();
      }

    } catch (error: any) {
      playSound('error');
      console.error("Swap error:", error);
      
      if (error.message?.includes('User rejected')) {
        showError("Transaction cancelled");
      } else if (error.message?.includes('Slippage')) {
        showError("Slippage exceeded - try again");
      } else {
        showError(error.message?.substring(0, 60) || "Swap failed");
      }
    } finally {
      setSwapping(false);
    }
  };

  const formatNumber = (num: string | number, decimals = 2) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (n >= 1000000) return `$${(n / 1000000).toFixed(decimals)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(decimals)}K`;
    return `$${n.toFixed(decimals)}`;
  };

  const isBuying = toToken?.address === SPT_MINT;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-12 lg:py-20 overflow-hidden">
        {/* Background gradient */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at top, rgba(251, 87, 255, 0.15) 0%, transparent 60%)',
          }}
        />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
            {/* Left: Token Info */}
            <div className="flex-1 text-center lg:text-left space-y-6">
              {/* Token Header */}
              <div className="flex items-center justify-center lg:justify-start gap-4">
                <div className="relative">
                  <div 
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                  >
                    <Coins className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-[#060609] flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div>
                  <h1 
                    className="text-3xl sm:text-4xl lg:text-5xl font-bold"
                    style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                  >
                    {SPT_NAME}
                  </h1>
                  <p className="text-lg sm:text-xl text-gray-400">${SPT_SYMBOL}</p>
                </div>
              </div>

              {/* Price Display */}
              {priceData && (
                <div className="flex items-center justify-center lg:justify-start gap-3 sm:gap-4">
                  <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
                    ${parseFloat(priceData.priceUsd).toFixed(6)}
                  </span>
                  <span 
                    className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${
                      priceData.priceChange24h >= 0 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {priceData.priceChange24h >= 0 ? '+' : ''}{priceData.priceChange24h.toFixed(2)}%
                  </span>
                </div>
              )}

              {/* Description */}
              <p className="text-sm sm:text-base text-gray-400 max-w-xl mx-auto lg:mx-0">
                The native utility token of the StakePoint ecosystem. Stake SPT to earn rewards, 
                qualify for Whale Club membership, and participate in the most advanced staking 
                platform on Solana.
              </p>

              {/* Contract Address */}
              <div className="space-y-2">
                <p className="text-sm text-gray-500 uppercase tracking-wider">Contract Address</p>
                <button
                  onClick={copyToClipboard}
                  className="group flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:bg-white/[0.05] transition-all w-full lg:w-auto justify-center lg:justify-start"
                >
                  <code className="text-sm text-gray-300 font-mono truncate max-w-[280px] sm:max-w-none">
                    {SPT_MINT}
                  </code>
                  {copied ? (
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                  ) : (
                    <Copy className="w-5 h-5 text-gray-400 group-hover:text-white flex-shrink-0 transition-colors" />
                  )}
                </button>
              </div>

              {/* Stats Grid */}
              {priceData && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 sm:p-4">
                    <p className="text-xs text-gray-500 uppercase">Market Cap</p>
                    <p className="text-sm sm:text-lg font-semibold text-white">{formatNumber(priceData.marketCap)}</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 sm:p-4">
                    <p className="text-xs text-gray-500 uppercase">24h Volume</p>
                    <p className="text-sm sm:text-lg font-semibold text-white">{formatNumber(priceData.volume24h)}</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 sm:p-4">
                    <p className="text-xs text-gray-500 uppercase">Liquidity</p>
                    <p className="text-sm sm:text-lg font-semibold text-white">{formatNumber(priceData.liquidity)}</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 sm:p-4">
                    <p className="text-xs text-gray-500 uppercase">Max Supply</p>
                    <p className="text-sm sm:text-lg font-semibold text-white">1.33B</p>
                  </div>
                </div>
              )}

              {/* Quick Links */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-3">
                <a
                  href={`https://dexscreener.com/solana/${SPT_MINT}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/[0.05] rounded-lg hover:bg-white/[0.08] transition-all text-xs sm:text-sm"
                >
                  <TrendingUp className="w-4 h-4" style={{ color: '#fb57ff' }} />
                  DexScreener
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </a>
                <a
                  href={`https://solscan.io/token/${SPT_MINT}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/[0.05] rounded-lg hover:bg-white/[0.08] transition-all text-xs sm:text-sm"
                >
                  <ExternalLink className="w-4 h-4" style={{ color: '#fb57ff' }} />
                  Solscan
                </a>
                <a
                  href="https://app.meteora.ag/pools/A1d4sAmgi4Njnodmc289HP7TaPxw54n4Ey3LRDfrBvo5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/[0.05] rounded-lg hover:bg-white/[0.08] transition-all text-xs sm:text-sm"
                >
                  <Coins className="w-4 h-4" style={{ color: '#fb57ff' }} />
                  Meteora
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </a>
                <Link
                  href="/pools"
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/[0.05] rounded-lg hover:bg-white/[0.08] transition-all text-xs sm:text-sm"
                >
                  <Zap className="w-4 h-4" style={{ color: '#fb57ff' }} />
                  Stake SPT
                </Link>
              </div>
            </div>

            {/* Right: Swap Widget */}
            <div className="w-full lg:w-auto lg:min-w-[380px]">
              <div className="bg-white/[0.02] backdrop-blur border border-white/[0.05] rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
                {/* Swap Header */}
                <div className="flex items-center justify-between">
                  <h2 
                    className="text-lg sm:text-xl font-bold"
                    style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
                  >
                    {isBuying ? 'Buy' : 'Sell'} SPT
                  </h2>
                  <span className="text-xs text-gray-400 bg-white/[0.05] px-2 py-1 rounded">
                    via Jupiter
                  </span>
                </div>

                {/* From Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm text-gray-400">You Pay</label>
                    {publicKey && tokenBalance !== null && (
                      <button
                        onClick={handleMaxAmount}
                        className="text-xs px-2 py-1 rounded hover:bg-white/[0.08] transition-all"
                        style={{ color: '#fb57ff' }}
                      >
                        MAX
                      </button>
                    )}
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                      <div className="flex items-center gap-2 px-2 sm:px-3 py-2 bg-white/[0.05] rounded-lg">
                        {fromToken.logoURI ? (
                          <img 
                            src={fromToken.logoURI} 
                            alt={fromToken.symbol} 
                            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (fromToken.address === SPT_MINT && !target.src.includes('dd.dexscreener.com')) {
                                target.src = `https://dd.dexscreener.com/ds-data/tokens/solana/${SPT_MINT}.png`;
                              } else {
                                target.style.display = 'none';
                              }
                            }}
                          />
                        ) : (
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
                            <span className="text-[8px] font-bold text-white">{fromToken.symbol.slice(0,3)}</span>
                          </div>
                        )}
                        <span className="font-semibold text-sm sm:text-base">{fromToken.symbol}</span>
                      </div>
                      <input
                        type="number"
                        value={fromAmount}
                        onChange={(e) => setFromAmount(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 min-w-0 bg-transparent text-right text-xl sm:text-2xl font-bold focus:outline-none"
                      />
                    </div>
                    {publicKey && tokenBalance !== null && (
                      <div className="text-right text-xs text-gray-400">
                        Balance: {tokenBalance.toFixed(4)} {fromToken.symbol}
                      </div>
                    )}
                  </div>
                </div>

                {/* Switch Button */}
                <div className="flex justify-center -my-2">
                  <button
                    onClick={switchTokens}
                    className="p-2 bg-white/[0.05] border-4 border-[#060609] rounded-xl hover:bg-white/[0.08] transition-all hover:rotate-180 duration-300"
                  >
                    <ArrowDownUp className="w-5 h-5" style={{ color: '#fb57ff' }} />
                  </button>
                </div>

                {/* To Input */}
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm text-gray-400">You Receive</label>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-2 px-2 sm:px-3 py-2 bg-white/[0.05] rounded-lg">
                        {toToken?.logoURI ? (
                          <img 
                            src={toToken.logoURI} 
                            alt={toToken.symbol} 
                            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full"
                            onError={(e) => {
                              // Fallback to DexScreener CDN if image fails
                              const target = e.target as HTMLImageElement;
                              if (!target.src.includes('dd.dexscreener.com')) {
                                target.src = `https://dd.dexscreener.com/ds-data/tokens/solana/${SPT_MINT}.png`;
                              } else {
                                // Hide broken image
                                target.style.display = 'none';
                              }
                            }}
                          />
                        ) : (
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
                            <span className="text-[8px] font-bold text-white">SPT</span>
                          </div>
                        )}
                        <span className="font-semibold text-sm sm:text-base">{toToken?.symbol || "SPT"}</span>
                      </div>
                      <div className="flex-1 min-w-0 text-right text-xl sm:text-2xl font-bold">
                        {quoteLoading ? (
                          <span className="text-gray-400">...</span>
                        ) : (
                          <span className="truncate block">{toAmount || "0.00"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rate Info */}
                {fromAmount && toAmount && toToken && (
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Rate</span>
                      <span className="text-white">
                        1 {fromToken.symbol} ≈ {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(4)} {toToken.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Slippage</span>
                      <span className="text-white">{slippage}%</span>
                    </div>
                  </div>
                )}

                {/* Swap Button */}
                <button
                  onClick={handleSwap}
                  disabled={swapping || !publicKey || !toToken || !fromAmount || parseFloat(fromAmount) <= 0}
                  className="w-full py-3 sm:py-4 rounded-xl font-bold text-sm sm:text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white min-h-[48px]"
                  style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                >
                  {swapping ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      Swapping...
                    </>
                  ) : !publicKey ? (
                    <>
                      <Wallet className="w-5 h-5" />
                      Connect Wallet
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      {isBuying ? 'Buy' : 'Sell'} SPT
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Chart Section */}
      <section className="py-6 sm:py-8 lg:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 
            className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6"
            style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
          >
            Live Chart
          </h2>
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden">
            <iframe
              src={`https://dexscreener.com/solana/${DEXSCREENER_PAIR}?embed=1&theme=dark&trades=0&info=0`}
              className="w-full h-[400px] sm:h-[500px] lg:h-[600px]"
              title="SPT Chart"
            />
          </div>
        </div>
      </section>

      {/* Token Info Section */}
      <section className="py-6 sm:py-8 lg:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* About */}
            <div className="lg:col-span-2 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 sm:p-6">
              <h3 
                className="text-lg sm:text-xl font-bold mb-3 sm:mb-4"
                style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
              >
                About StakePoint (SPT)
              </h3>
              <div className="space-y-3 sm:space-y-4 text-sm sm:text-base text-gray-400">
                <p>
                  StakePoint (SPT) is the native utility token of the StakePoint platform, a decentralized 
                  staking infrastructure built on Solana using the Token-2022 standard.
                </p>
                <p>
                  Token holders can stake SPT in the platform's staking pools to earn additional SPT rewards 
                  over time. The staking mechanism operates through Solana smart contracts that calculate and 
                  distribute rewards based on stake duration and amount.
                </p>
                <p>
                  SPT launched via Meteora bonding curve as a 100% fair launch with no team allocation, 
                  no presale, and no private investors. All LP tokens were burned to ensure permanent liquidity.
                </p>
              </div>
            </div>

            {/* Token Details */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 sm:p-6">
              <h3 
                className="text-lg sm:text-xl font-bold mb-3 sm:mb-4"
                style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
              >
                Token Details
              </h3>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex justify-between py-2 border-b border-white/[0.05]">
                  <span className="text-sm text-gray-400">Symbol</span>
                  <span className="text-sm text-white font-semibold">SPT</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/[0.05]">
                  <span className="text-sm text-gray-400">Decimals</span>
                  <span className="text-sm text-white font-semibold">9</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/[0.05]">
                  <span className="text-sm text-gray-400">Standard</span>
                  <span className="text-sm text-white font-semibold">Token-2022</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/[0.05]">
                  <span className="text-sm text-gray-400">Launch Date</span>
                  <span className="text-sm text-white font-semibold">Nov 5, 2025</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/[0.05]">
                  <span className="text-sm text-gray-400">Max Supply</span>
                  <span className="text-sm text-white font-semibold">1.33B</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-sm text-gray-400">Team Tokens</span>
                  <span className="text-sm text-green-400 font-semibold">0%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-8 lg:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div 
            className="rounded-2xl p-6 sm:p-8 lg:p-12 text-center"
            style={{ background: 'rgba(251, 87, 255, 0.05)', border: '1px solid rgba(251, 87, 255, 0.2)' }}
          >
            <h2 
              className="text-xl sm:text-2xl lg:text-3xl font-bold mb-3 sm:mb-4"
              style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
            >
              Ready to Earn with SPT?
            </h2>
            <p className="text-sm sm:text-base text-gray-400 mb-4 sm:mb-6 max-w-2xl mx-auto">
              Stake your SPT tokens and start earning rewards today. Join thousands of users 
              earning passive income on the most advanced staking platform on Solana.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/pools"
                className="w-full sm:w-auto px-6 sm:px-8 py-3 rounded-xl font-bold text-white transition-all hover:scale-105 text-sm sm:text-base min-h-[48px] flex items-center justify-center"
                style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
              >
                Stake SPT Now
              </Link>
              <Link
                href="/whale-club"
                className="w-full sm:w-auto px-6 sm:px-8 py-3 rounded-xl font-bold text-white bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.08] transition-all text-sm sm:text-base min-h-[48px] flex items-center justify-center"
              >
                Join Whale Club
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}