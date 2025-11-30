"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { ArrowDownUp, Settings, Info, TrendingUp, Zap } from "lucide-react";
import { useToast } from "@/components/ToastContainer";
import TokenSelectModal from "./TokenSelectModal";

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
  maxSlippage: number;
  priorityFee: number;
}

export default function SwapPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { showSuccess, showError } = useToast();

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
  const [slippage, setSlippage] = useState(0.5);
  
  // UI state
  const [showTokenSelect, setShowTokenSelect] = useState<"from" | "to" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Load config from API
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch("/api/admin/config");
        if (res.ok) {
          const data = await res.json();
          setConfig({
            swapEnabled: data.swapEnabled ?? true,
            platformFeePercentage: data.platformFeePercentage ?? 1.0,
            maxSlippage: data.maxSlippage ?? 50,
            priorityFee: data.priorityFee ?? 0.0001
          });
          
          if (data.maxSlippage && slippage > data.maxSlippage) {
            setSlippage(data.maxSlippage);
          }
        }
      } catch (error) {
        console.error("Failed to load config:", error);
      }
    };

    loadConfig();
  }, []);

  // Load tokens and featured tokens
  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    setLoading(true);
    try {
      setTokens([]);

      // Load featured tokens from admin panel
      try {
        const featuredRes = await fetch("/api/admin/featured-tokens");
        if (featuredRes.ok) {
          const featuredData = await featuredRes.json();
          const enabledFeaturedTokens = (featuredData.featuredTokens || [])
            .filter((ft: any) => ft.enabled)
            .sort((a: any, b: any) => a.order - b.order);
          
          setFeaturedTokens(enabledFeaturedTokens);
          console.log('✅ Loaded featured tokens:', enabledFeaturedTokens.length);
          console.log('Featured tokens:', enabledFeaturedTokens);
        }
      } catch (featuredError) {
        console.error("Failed to load featured tokens:", featuredError);
      }

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

  // Get quote when amount changes - with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fromToken && toToken && fromAmount && parseFloat(fromAmount) > 0) {
        getQuote();
      } else {
        setToAmount("");
        setQuoteError(null);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [fromToken, toToken, fromAmount, slippage]);

  const getQuote = async () => {
    if (!fromToken || !toToken || !fromAmount) return;

    setQuoteLoading(true);
    setQuoteError(null);
    
    try {
      const amount = parseFloat(fromAmount) * Math.pow(10, fromToken.decimals);
      
      console.log('🔍 Fetching quote:', {
        from: fromToken.symbol,
        to: toToken.symbol,
        amount: fromAmount,
        amountLamports: Math.floor(amount)
      });

      const quoteResponse = await fetch(
        `https://quote-api.jup.ag/v6/quote?` +
        `inputMint=${fromToken.address}&` +
        `outputMint=${toToken.address}&` +
        `amount=${Math.floor(amount)}&` +
        `slippageBps=${Math.floor(slippage * 100)}`
      );

      if (!quoteResponse.ok) {
        throw new Error(`Quote API error: ${quoteResponse.status}`);
      }

      const quote = await quoteResponse.json();
      
      console.log('📊 Quote response:', quote);
      
      if (quote.outAmount) {
        const outAmountDecimal = parseFloat(quote.outAmount) / Math.pow(10, toToken.decimals);
        
        console.log('💰 Output calculation:', {
          outAmountRaw: quote.outAmount,
          decimals: toToken.decimals,
          outAmountDecimal,
          formatted: outAmountDecimal.toFixed(toToken.decimals)
        });
        
        // Use more decimals for display to show small amounts
        const displayDecimals = outAmountDecimal < 0.01 ? 8 : 6;
        setToAmount(outAmountDecimal.toFixed(displayDecimals));
      } else if (quote.error) {
        setQuoteError(quote.error);
        setToAmount("");
      }
    } catch (error: any) {
      console.error("❌ Failed to get quote:", error);
      setQuoteError(error.message || "Failed to get quote");
      setToAmount("");
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!publicKey || !signTransaction || !fromToken || !toToken || !fromAmount) {
      showError("❌ Please connect wallet and fill in all fields");
      return;
    }

    if (!config?.swapEnabled) {
      showError("❌ Swap feature is currently disabled");
      return;
    }

    setSwapping(true);
    try {
      const amount = parseFloat(fromAmount) * Math.pow(10, fromToken.decimals);

      const response = await fetch("/api/swap/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPublicKey: publicKey.toString(),
          inputMint: fromToken.address,
          outputMint: toToken.address,
          amount: Math.floor(amount),
          slippageBps: Math.floor(slippage * 100),
        }),
      });

      const { swapTransaction } = await response.json();

      const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      
      const signedTransaction = await signTransaction(transaction);

      const rawTransaction = signedTransaction.serialize();
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2,
      });

      await connection.confirmTransaction(txid, "confirmed");

      showSuccess(`✅ Swap successful! TX: ${txid.slice(0, 8)}...`);
      
      setFromAmount("");
      setToAmount("");
      
      await fetch("/api/swap/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromToken: fromToken.symbol,
          toToken: toToken.symbol,
          fromAmount: parseFloat(fromAmount),
          toAmount: parseFloat(toAmount),
          userAddress: publicKey.toString(),
        }),
      });

    } catch (error: any) {
      console.error("Swap error:", error);
      showError(`❌ Swap failed: ${error.message}`);
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Token Swap
          </h1>
          <p className="text-gray-400">
            Powered by Jupiter • {config ? `${config.platformFeePercentage.toFixed(2)}% platform fee` : "Loading..."}
          </p>
          {config && !config.swapEnabled && (
            <div className="mt-4 bg-red-500/20 border border-red-500 rounded-lg p-3">
              <p className="text-red-200 font-semibold">⚠️ Swap Disabled</p>
              <p className="text-red-300 text-sm">
                Swapping is currently disabled by the administrator
              </p>
            </div>
          )}
        </div>

        {/* Swap Card */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700 rounded-2xl p-6 space-y-4">
          {/* Settings Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg hover:bg-slate-800 transition-all"
            >
              <Settings className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Slippage Tolerance</label>
                <div className="flex gap-2">
                  {[0.1, 0.5, 1.0].map((value) => (
                    <button
                      key={value}
                      onClick={() => setSlippage(value)}
                      disabled={config && value > config.maxSlippage}
                      className={`flex-1 px-3 py-2 rounded-lg transition-all ${
                        slippage === value
                          ? "bg-blue-600 text-white"
                          : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {value}%
                    </button>
                  ))}
                  <input
                    type="number"
                    value={slippage}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0.5;
                      if (!config || value <= config.maxSlippage) {
                        setSlippage(value);
                      }
                    }}
                    max={config?.maxSlippage}
                    className="w-20 px-3 py-2 bg-slate-700 rounded-lg text-white text-center focus:border-blue-500 focus:outline-none"
                    step="0.1"
                    min="0.1"
                  />
                </div>
                {config && (
                  <p className="text-xs text-gray-500 mt-2">
                    Max slippage: {config.maxSlippage}%
                  </p>
                )}
              </div>
            </div>
          )}

          {/* From Token */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">You Pay</label>
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => setShowTokenSelect("from")}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-all"
                >
                  {fromToken?.logoURI && (
                    <img src={fromToken.logoURI} alt={fromToken.symbol} className="w-6 h-6 rounded-full" />
                  )}
                  <span className="font-semibold">{fromToken?.symbol || "Select"}</span>
                  <span className="text-gray-400">▼</span>
                </button>
                <input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={config && !config.swapEnabled}
                  className="flex-1 bg-transparent text-right text-2xl font-bold focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Switch Button */}
          <div className="flex justify-center -my-2">
            <button
              onClick={switchTokens}
              disabled={config && !config.swapEnabled}
              className="p-2 bg-slate-800 border-4 border-slate-900 rounded-xl hover:bg-slate-700 transition-all disabled:opacity-50"
            >
              <ArrowDownUp className="w-5 h-5" />
            </button>
          </div>

          {/* To Token */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">You Receive</label>
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => setShowTokenSelect("to")}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-all"
                >
                  {toToken?.logoURI && (
                    <img src={toToken.logoURI} alt={toToken.symbol} className="w-6 h-6 rounded-full" />
                  )}
                  <span className="font-semibold">{toToken?.symbol || "Select"}</span>
                  <span className="text-gray-400">▼</span>
                </button>
                <div className="flex-1 text-right">
                  {quoteLoading ? (
                    <span className="text-2xl font-bold text-gray-500">Loading...</span>
                  ) : quoteError ? (
                    <span className="text-lg text-red-400">Error</span>
                  ) : (
                    <span className="text-2xl font-bold">{toAmount || "0.00"}</span>
                  )}
                </div>
              </div>
              {quoteError && (
                <p className="text-xs text-red-400 mt-2">⚠️ {quoteError}</p>
              )}
            </div>
          </div>

          {/* Info */}
          {fromAmount && toAmount && config && !quoteError && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Rate</span>
                <span>
                  1 {fromToken?.symbol} ≈ {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken?.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Platform Fee ({config.platformFeePercentage.toFixed(2)}%)</span>
                <span>
                  {((parseFloat(fromAmount) * config.platformFeePercentage) / 100).toFixed(6)} {fromToken?.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Slippage Tolerance</span>
                <span>{slippage}%</span>
              </div>
            </div>
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
              !toAmount ||
              !!quoteError ||
              (config && !config.swapEnabled)
            }
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-bold text-lg hover:from-blue-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            ) : quoteError ? (
              "Quote Error"
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Swap
              </>
            )}
          </button>

          {/* Warning */}
          {!publicKey && (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
              <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-200">
                Please connect your wallet to start swapping
              </p>
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-blue-400" />
              <span className="font-semibold">Fast Swaps</span>
            </div>
            <p className="text-sm text-gray-400">
              Powered by Jupiter aggregator for best rates
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="font-semibold">Best Prices</span>
            </div>
            <p className="text-sm text-gray-400">
              Aggregated from multiple DEXs on Solana
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-5 h-5 text-purple-400" />
              <span className="font-semibold">Low Fees</span>
            </div>
            <p className="text-sm text-gray-400">
              Only {config ? config.platformFeePercentage.toFixed(2) : "1.00"}% platform fee
            </p>
          </div>
        </div>
      </div>

      {/* Token Select Modal */}
      {showTokenSelect && (
        <TokenSelectModal
          featuredTokens={featuredTokens}
          onSelect={(token) => {
            if (showTokenSelect === "from") {
              setFromToken(token);
            } else {
              setToToken(token);
            }
            setShowTokenSelect(null);
          }}
          onClose={() => setShowTokenSelect(null)}
        />
      )}
    </div>
  );
}
