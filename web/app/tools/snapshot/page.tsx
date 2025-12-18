"use client";

import { useState } from "react";
import { PublicKey, Connection } from "@solana/web3.js";
import {
  Camera,
  Download,
  Loader2,
  Search,
  Users,
  Coins,
  Filter,
  Copy,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  ExternalLink,
  ChevronDown,
  X,
} from "lucide-react";

interface Holder {
  wallet: string;
  balance: number;
  percentage: number;
  rank: number;
}

interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: number;
  logoURI: string | null;
  isToken2022: boolean;
}

type SortField = "rank" | "balance" | "percentage";
type SortOrder = "asc" | "desc";

// Helius RPC endpoint
const HELIUS_RPC = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || "https://mainnet.helius-rpc.com/?api-key=2bd046b7-358b-43fe-afe9-1dd227347aee";

// Token program IDs
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export default function SnapshotPage() {
  const [tokenMint, setTokenMint] = useState("");
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [filteredHolders, setFilteredHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  // Filters
  const [minBalance, setMinBalance] = useState("");
  const [maxBalance, setMaxBalance] = useState("");
  const [excludeAddresses, setExcludeAddresses] = useState("");
  const [topHolders, setTopHolders] = useState("");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // UI state
  const [copied, setCopied] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fetchTokenInfo = async (mint: string): Promise<TokenInfo | null> => {
    try {
      const connection = new Connection(HELIUS_RPC, "confirmed");
      const mintPubkey = new PublicKey(mint);
      const mintAccountInfo = await connection.getAccountInfo(mintPubkey);

      if (!mintAccountInfo) {
        return null;
      }

      // Check if Token-2022 or regular Token
      const programOwner = mintAccountInfo.owner.toBase58();
      const isToken2022 = programOwner === TOKEN_2022_PROGRAM_ID;

      // Get parsed mint info
      const mintInfo = await connection.getParsedAccountInfo(mintPubkey);

      if (!mintInfo.value?.data || typeof mintInfo.value.data !== "object") {
        return null;
      }

      const parsedData = (mintInfo.value.data as any).parsed?.info;
      if (!parsedData) return null;

      const decimals = parsedData.decimals;
      const totalSupply = Number(parsedData.supply) / Math.pow(10, decimals);

      let symbol = mint.slice(0, 4) + "..." + mint.slice(-4);
      let name = "Unknown Token";
      let logoURI: string | null = null;

      // Try DexScreener for metadata
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
        if (res.ok) {
          const data = await res.json();
          const bestPair = data.pairs?.sort(
            (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
          )[0];

          if (bestPair?.baseToken) {
            symbol = bestPair.baseToken.symbol || symbol;
            name = bestPair.baseToken.name || name;
            logoURI = bestPair.info?.imageUrl || null;
          }
        }
      } catch {
        // Silent fail
      }

      return { mint, symbol, name, decimals, totalSupply, logoURI, isToken2022 };
    } catch (err) {
      console.error("Error fetching token info:", err);
      return null;
    }
  };

  // Fetch holders for regular SPL tokens using Helius DAS API
  const fetchHoldersWithHelius = async (mint: string, decimals: number): Promise<Holder[]> => {
    const allHolders: Map<string, number> = new Map();
    let cursor: string | undefined = undefined;
    let page = 0;
    const maxPages = 100;

    setStatusMessage("Fetching holders from Helius...");

    while (page < maxPages) {
      page++;
      setStatusMessage(`Fetching page ${page}... (${allHolders.size} holders found)`);

      const body: any = {
        jsonrpc: "2.0",
        id: `holders-${page}`,
        method: "getTokenAccounts",
        params: {
          mint: mint,
          limit: 1000,
        },
      };

      if (cursor) {
        body.params.cursor = cursor;
      }

      try {
        const response = await fetch(HELIUS_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error.message || "RPC error");
        }

        const accounts = data.result?.token_accounts || [];

        if (accounts.length === 0) {
          break;
        }

        // Aggregate balances by owner
        for (const account of accounts) {
          const owner = account.owner;
          const amount = Number(account.amount) / Math.pow(10, decimals);

          if (amount > 0) {
            const existing = allHolders.get(owner) || 0;
            allHolders.set(owner, existing + amount);
          }
        }

        cursor = data.result?.cursor;
        if (!cursor) {
          break;
        }
      } catch (err) {
        console.error(`Error fetching page ${page}:`, err);
        break;
      }
    }

    return processHolders(allHolders);
  };

  // Fetch holders for Token-2022 using getProgramAccounts
  const fetchToken2022Holders = async (mint: string, decimals: number): Promise<Holder[]> => {
    const allHolders: Map<string, number> = new Map();
    
    setStatusMessage("Fetching Token-2022 holders...");

    try {
      const connection = new Connection(HELIUS_RPC, "confirmed");
      const mintPubkey = new PublicKey(mint);

      // Fetch all token accounts for this mint using getProgramAccounts
      setStatusMessage("Scanning Token-2022 accounts (this may take a moment)...");
      
      const accounts = await connection.getParsedProgramAccounts(
        new PublicKey(TOKEN_2022_PROGRAM_ID),
        {
          filters: [
            {
              dataSize: 182, // Token-2022 account size (can vary with extensions)
            },
            {
              memcmp: {
                offset: 0,
                bytes: mint,
              },
            },
          ],
        }
      );

      setStatusMessage(`Processing ${accounts.length} token accounts...`);

      for (const account of accounts) {
        const parsedData = (account.account.data as any).parsed?.info;
        if (parsedData && parsedData.mint === mint) {
          const owner = parsedData.owner;
          const amount = Number(parsedData.tokenAmount?.amount || 0) / Math.pow(10, decimals);

          if (amount > 0) {
            const existing = allHolders.get(owner) || 0;
            allHolders.set(owner, existing + amount);
          }
        }
      }

      // If no results with dataSize filter, try without it (for tokens with extensions)
      if (allHolders.size === 0) {
        setStatusMessage("Trying alternative scan for extended Token-2022...");
        
        const accountsAlt = await connection.getParsedProgramAccounts(
          new PublicKey(TOKEN_2022_PROGRAM_ID),
          {
            filters: [
              {
                memcmp: {
                  offset: 0,
                  bytes: mint,
                },
              },
            ],
          }
        );

        for (const account of accountsAlt) {
          const parsedData = (account.account.data as any).parsed?.info;
          if (parsedData && parsedData.mint === mint) {
            const owner = parsedData.owner;
            const amount = Number(parsedData.tokenAmount?.amount || 0) / Math.pow(10, decimals);

            if (amount > 0) {
              const existing = allHolders.get(owner) || 0;
              allHolders.set(owner, existing + amount);
            }
          }
        }
      }

    } catch (err) {
      console.error("Error fetching Token-2022 holders:", err);
      throw new Error("Failed to fetch Token-2022 holders. The token may have too many holders or use unsupported extensions.");
    }

    return processHolders(allHolders);
  };

  // Process holder map into sorted array with percentages
  const processHolders = (holdersMap: Map<string, number>): Holder[] => {
    const holdersArray = Array.from(holdersMap.entries())
      .map(([wallet, balance]) => ({ wallet, balance }))
      .sort((a, b) => b.balance - a.balance);

    const totalHeld = holdersArray.reduce((sum, h) => sum + h.balance, 0);

    return holdersArray.map((h, index) => ({
      wallet: h.wallet,
      balance: h.balance,
      percentage: totalHeld > 0 ? (h.balance / totalHeld) * 100 : 0,
      rank: index + 1,
    }));
  };

  const takeSnapshot = async () => {
    if (!tokenMint.trim()) {
      setError("Please enter a token mint address");
      return;
    }

    try {
      new PublicKey(tokenMint);
    } catch {
      setError("Invalid token mint address");
      return;
    }

    setLoading(true);
    setError("");
    setHolders([]);
    setFilteredHolders([]);
    setTokenInfo(null);
    setStatusMessage("Fetching token info...");

    try {
      // Fetch token info (includes Token-2022 detection)
      const info = await fetchTokenInfo(tokenMint);
      if (!info) {
        throw new Error("Failed to fetch token info. Make sure this is a valid SPL token.");
      }
      setTokenInfo(info);

      // Fetch holders using appropriate method
      let holderList: Holder[];
      
      if (info.isToken2022) {
        setStatusMessage("Detected Token-2022 token...");
        holderList = await fetchToken2022Holders(tokenMint, info.decimals);
      } else {
        holderList = await fetchHoldersWithHelius(tokenMint, info.decimals);
      }

      if (holderList.length === 0) {
        throw new Error("No holders found for this token");
      }

      setStatusMessage(`✅ Found ${holderList.length} holders!`);
      setHolders(holderList);
      applyFilters(holderList);
    } catch (err: any) {
      console.error("Snapshot error:", err);
      setError(err.message || "Failed to take snapshot");
      setStatusMessage("");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (holderList: Holder[] = holders) => {
    let result = [...holderList];

    // Exclude addresses
    if (excludeAddresses.trim()) {
      const excluded = excludeAddresses
        .split(/[\n,]/)
        .map((a) => a.trim().toLowerCase())
        .filter((a) => a.length > 0);
      result = result.filter((h) => !excluded.includes(h.wallet.toLowerCase()));
    }

    // Min balance
    if (minBalance.trim()) {
      const min = parseFloat(minBalance);
      if (!isNaN(min)) {
        result = result.filter((h) => h.balance >= min);
      }
    }

    // Max balance
    if (maxBalance.trim()) {
      const max = parseFloat(maxBalance);
      if (!isNaN(max)) {
        result = result.filter((h) => h.balance <= max);
      }
    }

    // Top N holders
    if (topHolders.trim()) {
      const n = parseInt(topHolders);
      if (!isNaN(n) && n > 0) {
        result = result.slice(0, n);
      }
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "rank") comparison = a.rank - b.rank;
      else if (sortField === "balance") comparison = b.balance - a.balance;
      else if (sortField === "percentage") comparison = b.percentage - a.percentage;

      return sortOrder === "asc" ? comparison : -comparison;
    });

    setFilteredHolders(result);
  };

  const handleSort = (field: SortField) => {
    const newOrder = sortField === field && sortOrder === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortOrder(field === "rank" ? (newOrder === "asc" ? "asc" : "desc") : newOrder);
    setTimeout(() => applyFilters(), 0);
  };

  const exportCSV = () => {
    if (filteredHolders.length === 0) return;

    const headers = ["Rank", "Wallet", "Balance", "Percentage"];
    const rows = filteredHolders.map((h) => [
      h.rank,
      h.wallet,
      h.balance.toFixed(tokenInfo?.decimals || 6),
      h.percentage.toFixed(4) + "%",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tokenInfo?.symbol || "token"}_holders_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportForAirdrop = () => {
    if (filteredHolders.length === 0) return;

    const addresses = filteredHolders.map((h) => h.wallet).join("\n");
    const blob = new Blob([addresses], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tokenInfo?.symbol || "token"}_airdrop_list.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAllAddresses = () => {
    if (filteredHolders.length === 0) return;

    const addresses = filteredHolders.map((h) => h.wallet).join("\n");
    navigator.clipboard.writeText(addresses);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBalance = (balance: number): string => {
    if (balance >= 1_000_000_000) return (balance / 1_000_000_000).toFixed(2) + "B";
    if (balance >= 1_000_000) return (balance / 1_000_000).toFixed(2) + "M";
    if (balance >= 1_000) return (balance / 1_000).toFixed(2) + "K";
    return balance.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  const getTopHolderStats = () => {
    if (holders.length === 0) return null;

    const top1 = holders[0]?.percentage || 0;
    const top10 = holders.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0);
    const top50 = holders.slice(0, 50).reduce((sum, h) => sum + h.percentage, 0);

    return { top1, top10, top50 };
  };

  const stats = getTopHolderStats();

  const clearAll = () => {
    setTokenMint("");
    setTokenInfo(null);
    setHolders([]);
    setFilteredHolders([]);
    setStatusMessage("");
    setError("");
    setMinBalance("");
    setMaxBalance("");
    setExcludeAddresses("");
    setTopHolders("");
  };

  return (
    <div className="max-w-4xl mx-auto pt-6 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#fb57ff] to-purple-600 flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Holder Snapshot</h1>
            <p className="text-gray-400 text-sm">
              Get a complete snapshot of all token holders. Supports SPL &amp; Token-2022.
            </p>
          </div>
        </div>
      </div>

      {/* Token Mint Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-400 mb-2">Token Mint Address</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={tokenMint}
            onChange={(e) => setTokenMint(e.target.value)}
            placeholder="Enter SPL or Token-2022 mint address..."
            className="flex-1 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] focus:border-[#fb57ff]/50 outline-none text-white placeholder-gray-500"
          />
          <button
            onClick={takeSnapshot}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(45deg, #fb57ff, #9333ea)" }}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Snapshot
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Status Message */}
      {statusMessage && (
        <div className="mb-6 p-4 rounded-xl bg-white/[0.02] border border-[#fb57ff]/30">
          <div className="flex items-center gap-2 text-sm" style={{ color: "#fb57ff" }}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {statusMessage}
          </div>
        </div>
      )}

      {/* Token Info Card */}
      {tokenInfo && (
        <div className="mb-6 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center gap-4">
            {tokenInfo.logoURI ? (
              <img
                src={tokenInfo.logoURI}
                alt={tokenInfo.symbol}
                className="w-12 h-12 rounded-full"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                <span className="text-sm font-bold text-gray-400">
                  {tokenInfo.symbol.slice(0, 2)}
                </span>
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-white text-lg">{tokenInfo.symbol}</p>
                {tokenInfo.isToken2022 && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
                    Token-2022
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">{tokenInfo.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Total Supply</p>
              <p className="font-semibold text-white">{formatBalance(tokenInfo.totalSupply)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {holders.length > 0 && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-sm">Total Holders</span>
            </div>
            <p className="text-2xl font-bold text-white">{holders.length.toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-sm">Top 1 Holder</span>
            </div>
            <p className="text-2xl font-bold text-yellow-400">{stats.top1.toFixed(2)}%</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-sm">Top 10</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{stats.top10.toFixed(2)}%</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-sm">Top 50</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">{stats.top50.toFixed(2)}%</p>
          </div>
        </div>
      )}

      {/* Filters Section */}
      {holders.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 transition-all"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-[#fb57ff]" />
              <span className="font-medium text-white">Filters & Export</span>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform ${
                showFilters ? "rotate-180" : ""
              }`}
            />
          </button>

          {showFilters && (
            <div className="mt-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Min Balance</label>
                  <input
                    type="number"
                    value={minBalance}
                    onChange={(e) => setMinBalance(e.target.value)}
                    placeholder="0"
                    className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] focus:border-[#fb57ff]/50 outline-none text-white placeholder-gray-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Max Balance</label>
                  <input
                    type="number"
                    value={maxBalance}
                    onChange={(e) => setMaxBalance(e.target.value)}
                    placeholder="∞"
                    className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] focus:border-[#fb57ff]/50 outline-none text-white placeholder-gray-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Top N Holders</label>
                  <input
                    type="number"
                    value={topHolders}
                    onChange={(e) => setTopHolders(e.target.value)}
                    placeholder="All"
                    className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] focus:border-[#fb57ff]/50 outline-none text-white placeholder-gray-500 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => applyFilters()}
                    className="w-full px-4 py-3 rounded-lg bg-[#fb57ff]/10 border border-[#fb57ff]/50 text-[#fb57ff] font-medium text-sm hover:bg-[#fb57ff]/20 transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Exclude Addresses (comma or newline separated)
                </label>
                <textarea
                  value={excludeAddresses}
                  onChange={(e) => setExcludeAddresses(e.target.value)}
                  placeholder="Paste addresses to exclude (LP pools, burn wallets, etc.)"
                  rows={2}
                  className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] focus:border-[#fb57ff]/50 outline-none text-white placeholder-gray-500 text-sm resize-none font-mono"
                />
              </div>

              {/* Export Buttons */}
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={exportCSV}
                  disabled={filteredHolders.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/50 text-green-400 font-medium text-sm hover:bg-green-500/20 transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  onClick={exportForAirdrop}
                  disabled={filteredHolders.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/50 text-blue-400 font-medium text-sm hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export for Airdrop
                </button>
                <button
                  onClick={copyAllAddresses}
                  disabled={filteredHolders.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#fb57ff]/10 border border-[#fb57ff]/50 text-[#fb57ff] font-medium text-sm hover:bg-[#fb57ff]/20 transition-colors disabled:opacity-50"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy All Addresses
                    </>
                  )}
                </button>
                <button
                  onClick={clearAll}
                  className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-gray-400 font-medium text-sm hover:border-red-500/30 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear All
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Holders Table */}
      {filteredHolders.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-400">Holders</h3>
            <span className="text-xs text-gray-500">
              Showing {Math.min(filteredHolders.length, 100)} of {filteredHolders.length.toLocaleString()}
            </span>
          </div>
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-white/[0.02] border-b border-white/[0.05] text-sm font-medium text-gray-400">
              <div
                className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort("rank")}
              >
                Rank <ArrowUpDown className="w-3 h-3" />
              </div>
              <div className="col-span-5">Wallet</div>
              <div
                className="col-span-3 text-right flex items-center justify-end gap-1 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort("balance")}
              >
                Balance <ArrowUpDown className="w-3 h-3" />
              </div>
              <div
                className="col-span-2 text-right flex items-center justify-end gap-1 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort("percentage")}
              >
                % <ArrowUpDown className="w-3 h-3" />
              </div>
            </div>

            {/* Table Body */}
            <div className="max-h-96 overflow-y-auto">
              {filteredHolders.slice(0, 100).map((holder) => (
                <div
                  key={holder.wallet}
                  className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                >
                  <div className="col-span-2">
                    <span
                      className={`font-mono text-sm ${
                        holder.rank <= 3
                          ? "text-yellow-400 font-bold"
                          : holder.rank <= 10
                          ? "text-blue-400"
                          : "text-gray-400"
                      }`}
                    >
                      #{holder.rank}
                    </span>
                  </div>
                  <div className="col-span-5 flex items-center gap-2">
                    <span className="font-mono text-sm text-gray-300">
                      {holder.wallet.slice(0, 4)}...{holder.wallet.slice(-4)}
                    </span>
                    <a
                      href={`https://solscan.io/account/${holder.wallet}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-[#fb57ff] transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="col-span-3 text-right">
                    <span className="font-mono text-sm text-white">
                      {formatBalance(holder.balance)}
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <span
                      className={`text-sm ${
                        holder.percentage >= 10
                          ? "text-red-400"
                          : holder.percentage >= 5
                          ? "text-yellow-400"
                          : "text-gray-300"
                      }`}
                    >
                      {holder.percentage.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {filteredHolders.length > 100 && (
              <div className="px-4 py-3 text-center text-sm text-gray-500 border-t border-white/[0.05]">
                +{(filteredHolders.length - 100).toLocaleString()} more holders (export CSV for full list)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && holders.length === 0 && !error && (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-white/[0.02] flex items-center justify-center mx-auto mb-4">
            <Camera className="w-10 h-10 text-gray-600" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Take a Holder Snapshot</h2>
          <p className="text-gray-400">Enter a token mint address to get a complete list of holders</p>
        </div>
      )}
    </div>
  );
}