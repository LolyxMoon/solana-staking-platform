"use client";

import { useState, useEffect, useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { 
  RefreshCw, 
  Loader2,
  Wallet,
  TrendingUp,
  TrendingDown,
  Coins,
  Clock,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  BarChart3,
  DollarSign,
  Activity
} from "lucide-react";

interface TokenHolding {
  mint: string;
  symbol: string;
  name: string;
  logoURI: string | null;
  balance: number;
  decimals: number;
  priceUsd: number | null;
  valueUsd: number;
  change24h: number | null;
  costBasis: number;
  realizedPnl: number;
  unrealizedPnl: number;
  avgBuyPrice: number | null;
  programId: PublicKey;
}

interface WalletStats {
  solBalance: number;
  solValueUsd: number;
  totalTokenValue: number;
  totalValue: number;
  tokenCount: number;
  nonZeroTokens: number;
  walletAge: string | null;
  firstTxDate: Date | null;
  totalRealizedPnl: number;
  totalUnrealizedPnl: number;
  totalPnl: number;
  totalTransactions: number;
}

interface TokenTrade {
  mint: string;
  type: "buy" | "sell";
  amount: number;
  priceUsd: number;
  timestamp: number;
}

const HELIUS_API_KEY = "2bd046b7-358b-43fe-afe9-1dd227347aee";

export default function WalletAnalyzerPage() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [solPrice, setSolPrice] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [showAllTokens, setShowAllTokens] = useState(false);
  const [sortBy, setSortBy] = useState<"value" | "pnl" | "change">("value");

  const fetchSolPrice = async () => {
    try {
      const res = await fetch("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112");
      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data.pairs?.[0]?.priceUsd || "0");
        setSolPrice(price);
        return price;
      }
    } catch (err) {
      console.error("Failed to fetch SOL price:", err);
    }
    return 0;
  };

  const fetchTransactionHistory = async (wallet: string): Promise<TokenTrade[]> => {
    const trades: TokenTrade[] = [];
    let beforeSignature: string | undefined;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 10; // Limit to avoid rate limits
    
    try {
      while (hasMore && pageCount < maxPages) {
        const url = new URL(`https://api.helius.xyz/v0/addresses/${wallet}/transactions`);
        url.searchParams.set("api-key", HELIUS_API_KEY);
        url.searchParams.set("limit", "100");
        if (beforeSignature) {
          url.searchParams.set("before", beforeSignature);
        }
        
        const res = await fetch(url.toString());
        if (!res.ok) break;
        
        const txs = await res.json();
        if (!txs || txs.length === 0) {
          hasMore = false;
          break;
        }
        
        for (const tx of txs) {
          // Look for swap transactions
          if (tx.type === "SWAP" && tx.events?.swap) {
            const swap = tx.events.swap;
            const timestamp = tx.timestamp * 1000;
            
            // Token bought (received)
            if (swap.tokenOutputs?.[0]) {
              const output = swap.tokenOutputs[0];
              if (output.mint !== "So11111111111111111111111111111111111111112") {
                const solInput = swap.nativeInput?.amount || swap.tokenInputs?.[0]?.tokenAmount || 0;
                const solValue = solInput / LAMPORTS_PER_SOL;
                
                trades.push({
                  mint: output.mint,
                  type: "buy",
                  amount: output.tokenAmount / Math.pow(10, output.tokenStandard === "Fungible" ? 9 : 6),
                  priceUsd: 0, // Will calculate from SOL value
                  timestamp,
                });
              }
            }
            
            // Token sold (sent)
            if (swap.tokenInputs?.[0]) {
              const input = swap.tokenInputs[0];
              if (input.mint !== "So11111111111111111111111111111111111111112") {
                trades.push({
                  mint: input.mint,
                  type: "sell",
                  amount: input.tokenAmount / Math.pow(10, input.tokenStandard === "Fungible" ? 9 : 6),
                  priceUsd: 0,
                  timestamp,
                });
              }
            }
          }
          
          // Also check for token transfers that might be buys/sells
          if (tx.tokenTransfers) {
            for (const transfer of tx.tokenTransfers) {
              if (transfer.toUserAccount === wallet && transfer.tokenAmount > 0) {
                // Received tokens - might be a buy
                if (transfer.mint !== "So11111111111111111111111111111111111111112") {
                  // Check if this came with SOL outflow (indicating a buy)
                  const nativeChange = tx.nativeBalanceChange || 0;
                  if (nativeChange < -1000000) { // Lost more than 0.001 SOL
                    trades.push({
                      mint: transfer.mint,
                      type: "buy",
                      amount: transfer.tokenAmount,
                      priceUsd: Math.abs(nativeChange / LAMPORTS_PER_SOL), // SOL spent as proxy
                      timestamp: tx.timestamp * 1000,
                    });
                  }
                }
              }
            }
          }
        }
        
        beforeSignature = txs[txs.length - 1]?.signature;
        pageCount++;
        
        if (txs.length < 100) {
          hasMore = false;
        }
      }
    } catch (err) {
      console.error("Failed to fetch transaction history:", err);
    }
    
    return trades;
  };

  const calculatePnL = (
    trades: TokenTrade[], 
    currentBalance: number, 
    currentPrice: number | null,
    solPriceUsd: number
  ): { costBasis: number; realizedPnl: number; unrealizedPnl: number; avgBuyPrice: number | null } => {
    let totalBought = 0;
    let totalSold = 0;
    let totalCostBasis = 0;
    let realizedPnl = 0;
    
    // Sort trades by timestamp
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    
    // Simple FIFO calculation
    const buyQueue: { amount: number; pricePerToken: number }[] = [];
    
    for (const trade of sortedTrades) {
      if (trade.type === "buy") {
        const pricePerToken = trade.priceUsd > 0 ? trade.priceUsd / trade.amount : 0;
        buyQueue.push({ amount: trade.amount, pricePerToken });
        totalBought += trade.amount;
        totalCostBasis += trade.priceUsd;
      } else if (trade.type === "sell") {
        let remainingToSell = trade.amount;
        totalSold += trade.amount;
        
        while (remainingToSell > 0 && buyQueue.length > 0) {
          const buy = buyQueue[0];
          const sellAmount = Math.min(remainingToSell, buy.amount);
          const costOfSold = sellAmount * buy.pricePerToken;
          const saleValue = sellAmount * (trade.priceUsd / trade.amount || 0);
          
          realizedPnl += saleValue - costOfSold;
          
          buy.amount -= sellAmount;
          remainingToSell -= sellAmount;
          
          if (buy.amount <= 0) {
            buyQueue.shift();
          }
        }
      }
    }
    
    // Calculate remaining cost basis
    const remainingCostBasis = buyQueue.reduce((sum, b) => sum + (b.amount * b.pricePerToken), 0);
    const remainingAmount = buyQueue.reduce((sum, b) => sum + b.amount, 0);
    const avgBuyPrice = remainingAmount > 0 ? remainingCostBasis / remainingAmount : null;
    
    // Unrealized PnL
    const currentValue = currentBalance * (currentPrice || 0);
    const unrealizedPnl = currentValue - remainingCostBasis;
    
    return {
      costBasis: remainingCostBasis,
      realizedPnl,
      unrealizedPnl,
      avgBuyPrice,
    };
  };

  const fetchWalletData = async () => {
    if (!publicKey) return;
    
    setLoading(true);
    setStatusMessage("Fetching SOL balance...");
    
    try {
      const walletAddress = publicKey.toString();
      
      // Fetch SOL balance
      const solBalance = await connection.getBalance(publicKey);
      const solBalanceNum = solBalance / LAMPORTS_PER_SOL;
      
      // Fetch SOL price
      setStatusMessage("Fetching SOL price...");
      const currentSolPrice = await fetchSolPrice();
      const solValueUsd = solBalanceNum * currentSolPrice;
      
      // Fetch transaction history for PnL
      setStatusMessage("Analyzing transaction history...");
      const trades = await fetchTransactionHistory(walletAddress);
      
      // Group trades by mint
      const tradesByMint: Record<string, TokenTrade[]> = {};
      for (const trade of trades) {
        if (!tradesByMint[trade.mint]) {
          tradesByMint[trade.mint] = [];
        }
        tradesByMint[trade.mint].push(trade);
      }
      
      // Fetch SPL tokens
      setStatusMessage("Scanning token accounts...");
      const splAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );
      
      const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_2022_PROGRAM_ID }
      );
      
      const allAccounts = [
        ...splAccounts.value.map(acc => ({ ...acc, programId: TOKEN_PROGRAM_ID })),
        ...token2022Accounts.value.map(acc => ({ ...acc, programId: TOKEN_2022_PROGRAM_ID })),
      ];
      
      setStatusMessage(`Found ${allAccounts.length} tokens. Fetching prices...`);
      
      const tokenHoldings: TokenHolding[] = [];
      let totalRealizedPnl = 0;
      let totalUnrealizedPnl = 0;
      
      for (let i = 0; i < allAccounts.length; i++) {
        const account = allAccounts[i];
        const parsed = account.account.data.parsed.info;
        const mint = parsed.mint;
        const balance = parsed.tokenAmount.uiAmount || 0;
        const decimals = parsed.tokenAmount.decimals;
        
        let symbol = mint.slice(0, 4) + "..." + mint.slice(-4);
        let name = "Unknown Token";
        let logoURI: string | null = null;
        let priceUsd: number | null = null;
        let change24h: number | null = null;
        
        try {
          const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
          if (res.ok) {
            const data = await res.json();
            const bestPair = data.pairs?.sort((a: any, b: any) => 
              (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
            )[0];
            
            if (bestPair?.baseToken) {
              symbol = bestPair.baseToken.symbol || symbol;
              name = bestPair.baseToken.name || name;
              logoURI = bestPair.info?.imageUrl || null;
              priceUsd = parseFloat(bestPair.priceUsd) || null;
              change24h = bestPair.priceChange?.h24 ? parseFloat(bestPair.priceChange.h24) : null;
            }
          }
        } catch (err) {
          // Silent fail
        }
        
        // Calculate PnL for this token
        const tokenTrades = tradesByMint[mint] || [];
        const pnlData = calculatePnL(tokenTrades, balance, priceUsd, currentSolPrice);
        
        totalRealizedPnl += pnlData.realizedPnl;
        totalUnrealizedPnl += pnlData.unrealizedPnl;
        
        tokenHoldings.push({
          mint,
          symbol,
          name,
          logoURI,
          balance,
          decimals,
          priceUsd,
          valueUsd: priceUsd ? balance * priceUsd : 0,
          change24h,
          costBasis: pnlData.costBasis,
          realizedPnl: pnlData.realizedPnl,
          unrealizedPnl: pnlData.unrealizedPnl,
          avgBuyPrice: pnlData.avgBuyPrice,
          programId: account.programId,
        });
        
        if (i % 10 === 0) {
          setStatusMessage(`Fetching prices... (${i + 1}/${allAccounts.length})`);
        }
      }
      
      // Sort by value
      tokenHoldings.sort((a, b) => b.valueUsd - a.valueUsd);
      
      // Calculate totals
      const totalTokenValue = tokenHoldings.reduce((sum, t) => sum + t.valueUsd, 0);
      const nonZeroTokens = tokenHoldings.filter(t => t.balance > 0).length;
      
      // Get wallet age
      setStatusMessage("Fetching wallet history...");
      let walletAge: string | null = null;
      let firstTxDate: Date | null = null;
      let totalTransactions = 0;
      
      try {
        const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 1000 });
        totalTransactions = signatures.length;
        
        if (signatures.length > 0) {
          const oldestSig = signatures[signatures.length - 1];
          if (oldestSig.blockTime) {
            firstTxDate = new Date(oldestSig.blockTime * 1000);
            const now = new Date();
            const diffMs = now.getTime() - firstTxDate.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffDays < 30) {
              walletAge = `${diffDays} days`;
            } else if (diffDays < 365) {
              walletAge = `${Math.floor(diffDays / 30)} months`;
            } else {
              const years = Math.floor(diffDays / 365);
              const months = Math.floor((diffDays % 365) / 30);
              walletAge = months > 0 ? `${years}y ${months}m` : `${years} years`;
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch wallet history:", err);
      }
      
      setHoldings(tokenHoldings);
      setStats({
        solBalance: solBalanceNum,
        solValueUsd,
        totalTokenValue,
        totalValue: solValueUsd + totalTokenValue,
        tokenCount: allAccounts.length,
        nonZeroTokens,
        walletAge,
        firstTxDate,
        totalRealizedPnl,
        totalUnrealizedPnl,
        totalPnl: totalRealizedPnl + totalUnrealizedPnl,
        totalTransactions,
      });
      setStatusMessage("");
      
    } catch (error) {
      console.error("Error analyzing wallet:", error);
      setStatusMessage("Error analyzing wallet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (publicKey) {
      fetchWalletData();
    }
  }, [publicKey]);

  const sortedHoldings = useMemo(() => {
    const sorted = [...holdings];
    switch (sortBy) {
      case "value":
        sorted.sort((a, b) => b.valueUsd - a.valueUsd);
        break;
      case "pnl":
        sorted.sort((a, b) => (b.unrealizedPnl + b.realizedPnl) - (a.unrealizedPnl + a.realizedPnl));
        break;
      case "change":
        sorted.sort((a, b) => (b.change24h || -999) - (a.change24h || -999));
        break;
    }
    return sorted;
  }, [holdings, sortBy]);

  const displayedHoldings = showAllTokens 
    ? sortedHoldings 
    : sortedHoldings.filter(h => h.balance > 0);

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatValue = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatPnl = (value: number) => {
    const prefix = value >= 0 ? "+" : "";
    return `${prefix}${formatValue(value)}`;
  };

  if (!publicKey) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-white/[0.02] flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-10 h-10 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-gray-400">Connect your wallet to analyze your portfolio</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#fb57ff] to-purple-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Wallet Analyzer</h1>
              <p className="text-gray-400 text-sm">Portfolio breakdown & PnL tracking</p>
            </div>
          </div>
          <button
            onClick={fetchWalletData}
            disabled={loading}
            className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 text-gray-300 hover:text-white transition-all"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {/* Wallet Address */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-gray-500 text-sm">
            {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
          </span>
          <button onClick={copyAddress} className="text-gray-500 hover:text-white transition-colors">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <a 
            href={`https://solscan.io/account/${publicKey.toString()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className="mb-6 p-3 rounded-lg bg-white/[0.02] border border-[#fb57ff]/30">
          <div className="flex items-center gap-2 text-sm" style={{ color: '#fb57ff' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            {statusMessage}
          </div>
        </div>
      )}

      {stats && (
        <>
          {/* Main Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-400">Total Value</p>
              </div>
              <p className="text-2xl font-bold text-white">{formatValue(stats.totalValue)}</p>
            </div>
            
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-400">SOL Balance</p>
              </div>
              <p className="text-2xl font-bold text-white">{stats.solBalance.toFixed(4)}</p>
              <p className="text-xs text-gray-500">{formatValue(stats.solValueUsd)}</p>
            </div>
            
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-400">Tokens</p>
              </div>
              <p className="text-2xl font-bold text-white">{stats.nonZeroTokens}</p>
              <p className="text-xs text-gray-500">{stats.tokenCount} accounts</p>
            </div>
            
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-400">Wallet Age</p>
              </div>
              <p className="text-2xl font-bold text-white">{stats.walletAge || "Unknown"}</p>
              <p className="text-xs text-gray-500">{stats.totalTransactions}+ txs</p>
            </div>
          </div>

          {/* PnL Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-sm text-gray-400 mb-2">Total PnL</p>
              <p className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPnl(stats.totalPnl)}
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-sm text-gray-400 mb-2">Unrealized PnL</p>
              <div className="flex items-center gap-2">
                {stats.totalUnrealizedPnl >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
                <p className={`text-xl font-bold ${stats.totalUnrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPnl(stats.totalUnrealizedPnl)}
                </p>
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-sm text-gray-400 mb-2">Realized PnL</p>
              <div className="flex items-center gap-2">
                {stats.totalRealizedPnl >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
                <p className={`text-xl font-bold ${stats.totalRealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPnl(stats.totalRealizedPnl)}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Sort & Filter Options */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {[
            { key: "value", label: "Value" },
            { key: "pnl", label: "PnL" },
            { key: "change", label: "24h Change" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key as any)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                sortBy === key
                  ? "bg-[#fb57ff]/10 border border-[#fb57ff] text-[#fb57ff]"
                  : "bg-white/[0.02] border border-white/[0.05] text-gray-400 hover:border-white/[0.1]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => setShowAllTokens(!showAllTokens)}
          className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
        >
          {showAllTokens ? "Hide empty" : "Show all"}
          {showAllTokens ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Token Holdings */}
      {loading && holdings.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#fb57ff' }} />
        </div>
      ) : displayedHoldings.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400">No tokens found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayedHoldings.map((token) => (
            <div
              key={token.mint}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] transition-all"
            >
              {/* Token Info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {token.logoURI ? (
                  <img 
                    src={token.logoURI} 
                    alt={token.symbol}
                    className="w-10 h-10 rounded-full"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-400">{token.symbol.slice(0, 2)}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{token.symbol}</p>
                  <p className="text-xs text-gray-500 truncate">{token.name}</p>
                </div>
              </div>

              {/* Balance */}
              <div className="text-right">
                <p className="font-medium text-white">
                  {token.balance === 0 ? (
                    <span className="text-gray-500">0</span>
                  ) : (
                    token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })
                  )}
                </p>
                <p className={`text-xs ${token.valueUsd === 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                  {formatValue(token.valueUsd)}
                </p>
              </div>

              {/* 24h Change */}
              <div className="text-right w-20">
                {token.change24h !== null ? (
                  <p className={`text-sm font-medium ${token.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                  </p>
                ) : (
                  <p className="text-sm text-gray-600">-</p>
                )}
                <p className="text-xs text-gray-500">24h</p>
              </div>

              {/* PnL */}
              <div className="text-right w-24">
                {(token.unrealizedPnl !== 0 || token.realizedPnl !== 0) ? (
                  <>
                    <p className={`text-sm font-medium ${(token.unrealizedPnl + token.realizedPnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPnl(token.unrealizedPnl + token.realizedPnl)}
                    </p>
                    <p className="text-xs text-gray-500">PnL</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">-</p>
                    <p className="text-xs text-gray-500">PnL</p>
                  </>
                )}
              </div>

              {/* External Link */}
              <a
                href={`https://dexscreener.com/solana/${token.mint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-white transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-8 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
        <p className="text-xs text-gray-500">
          <strong>Note:</strong> PnL calculations are estimates based on transaction history (last 1000 txs). 
          Actual values may differ due to airdrops, transfers, and complex DeFi interactions.
        </p>
      </div>
    </div>
  );
}