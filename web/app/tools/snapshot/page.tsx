"use client";

import { useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
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
}

type SortField = "rank" | "balance" | "percentage";
type SortOrder = "asc" | "desc";

export default function SnapshotPage() {
  const { connection } = useConnection();

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
      // Get mint info
      const mintPubkey = new PublicKey(mint);
      const mintInfo = await connection.getParsedAccountInfo(mintPubkey);

      if (!mintInfo.value?.data || typeof mintInfo.value.data !== "object") {
        return null;
      }

      const parsedData = (mintInfo.value.data as any).parsed?.info;
      if (!parsedData) return null;

      const decimals = parsedData.decimals;
      const totalSupply = parsedData.supply / Math.pow(10, decimals);

      // Try to get token metadata from DexScreener
      let symbol = mint.slice(0, 4) + "..." + mint.slice(-4);
      let name = "Unknown Token";
      let logoURI: string | null = null;

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

      return { mint, symbol, name, decimals, totalSupply, logoURI };
    } catch {
      return null;
    }
  };

  const fetchHolders = async () => {
    if (!tokenMint.trim()) {
      setError("Please enter a token mint address");
      return;
    }

    setLoading(true);
    setError("");
    setHolders([]);
    setFilteredHolders([]);
    setTokenInfo(null);

    try {
      // Validate mint address
      let mintPubkey: PublicKey;
      try {
        mintPubkey = new PublicKey(tokenMint.trim());
      } catch {
        setError("Invalid token mint address");
        setLoading(false);
        return;
      }

      setStatusMessage("Fetching token info...");
      const info = await fetchTokenInfo(tokenMint.trim());
      if (!info) {
        setError("Could not fetch token info. Make sure this is a valid SPL token.");
        setLoading(false);
        return;
      }
      setTokenInfo(info);

      setStatusMessage("Scanning token accounts (this may take a moment)...");

      // Try TOKEN_PROGRAM_ID first
      let accounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
        filters: [
          { dataSize: 165 },
          { memcmp: { offset: 0, bytes: mintPubkey.toBase58() } },
        ],
      });

      // If no accounts found, try TOKEN_2022_PROGRAM_ID
      if (accounts.length === 0) {
        setStatusMessage("Checking Token-2022 program...");
        accounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
          filters: [
            { dataSize: 165 },
            { memcmp: { offset: 0, bytes: mintPubkey.toBase58() } },
          ],
        });
      }

      setStatusMessage(`Found ${accounts.length} token accounts. Processing...`);

      // Parse accounts
      const holderMap = new Map<string, number>();

      for (const account of accounts) {
        const data = account.account.data;

        // Parse token account data manually
        // Mint: bytes 0-32
        // Owner: bytes 32-64
        // Amount: bytes 64-72 (u64 little endian)
        const owner = new PublicKey(data.slice(32, 64)).toBase58();
        const amountBuffer = data.slice(64, 72);
        const amount = Number(amountBuffer.readBigUInt64LE()) / Math.pow(10, info.decimals);

        if (amount > 0) {
          const existing = holderMap.get(owner) || 0;
          holderMap.set(owner, existing + amount);
        }
      }

      // Convert to array and sort by balance
      const holdersArray: Holder[] = Array.from(holderMap.entries())
        .map(([wallet, balance]) => ({
          wallet,
          balance,
          percentage: info.totalSupply > 0 ? (balance / info.totalSupply) * 100 : 0,
          rank: 0,
        }))
        .sort((a, b) => b.balance - a.balance)
        .map((holder, index) => ({ ...holder, rank: index + 1 }));

      setHolders(holdersArray);
      setFilteredHolders(holdersArray);
      setStatusMessage("");
    } catch (err: any) {
      console.error("Error fetching holders:", err);
      setError(err.message || "Failed to fetch holders");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...holders];

    // Min balance filter
    if (minBalance) {
      const min = parseFloat(minBalance);
      if (!isNaN(min)) {
        filtered = filtered.filter((h) => h.balance >= min);
      }
    }

    // Max balance filter
    if (maxBalance) {
      const max = parseFloat(maxBalance);
      if (!isNaN(max)) {
        filtered = filtered.filter((h) => h.balance <= max);
      }
    }

    // Exclude addresses filter
    if (excludeAddresses.trim()) {
      const excludeList = excludeAddresses
        .split(/[\n,]/)
        .map((a) => a.trim().toLowerCase())
        .filter((a) => a.length > 0);
      filtered = filtered.filter(
        (h) => !excludeList.includes(h.wallet.toLowerCase())
      );
    }

    // Top holders limit
    if (topHolders) {
      const top = parseInt(topHolders);
      if (!isNaN(top) && top > 0) {
        filtered = filtered.slice(0, top);
      }
    }

    // Re-rank after filtering
    filtered = filtered.map((h, i) => ({ ...h, rank: i + 1 }));

    setFilteredHolders(filtered);
  };

  const handleSort = (field: SortField) => {
    const newOrder = sortField === field && sortOrder === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortOrder(newOrder);

    const sorted = [...filteredHolders].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      return newOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

    setFilteredHolders(sorted);
  };

  const exportCSV = () => {
    if (filteredHolders.length === 0) return;

    const headers = "wallet,balance,percentage,rank";
    const rows = filteredHolders
      .map((h) => `${h.wallet},${h.balance},${h.percentage.toFixed(4)},${h.rank}`)
      .join("\n");

    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${tokenInfo?.symbol || "token"}_holders_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportForAirdrop = () => {
    if (filteredHolders.length === 0) return;

    // Just wallet addresses, one per line (for fixed amount airdrop)
    const wallets = filteredHolders.map((h) => h.wallet).join("\n");

    const blob = new Blob([wallets], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${tokenInfo?.symbol || "token"}_airdrop_list_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAllAddresses = () => {
    const addresses = filteredHolders.map((h) => h.wallet).join("\n");
    navigator.clipboard.writeText(addresses);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  return (
    <div className="max-w-6xl mx-auto pt-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#fb57ff] to-purple-600 flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Holder Snapshot</h1>
            <p className="text-gray-400 text-sm">
              Get a list of all token holders with balances
            </p>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Token Mint Address
        </label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={tokenMint}
              onChange={(e) => setTokenMint(e.target.value)}
              placeholder="Enter token mint address..."
              className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/[0.02] border border-white/[0.05] focus:border-[#fb57ff]/50 outline-none text-white placeholder-gray-500"
              onKeyDown={(e) => e.key === "Enter" && fetchHolders()}
            />
          </div>
          <button
            onClick={fetchHolders}
            disabled={loading}
            className="px-6 py-4 rounded-xl font-semibold text-white transition-all disabled:opacity-50 flex items-center gap-2"
            style={{ background: "linear-gradient(45deg, #fb57ff, #9333ea)" }}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
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
            <Loader2 className="w-4 h-4 animate-spin" />
            {statusMessage}
          </div>
        </div>
      )}

      {/* Token Info Card */}
      {tokenInfo && (
        <div className="mb-6 p-6 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center gap-4">
            {tokenInfo.logoURI ? (
              <img
                src={tokenInfo.logoURI}
                alt={tokenInfo.symbol}
                className="w-12 h-12 rounded-full"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-400">
                  {tokenInfo.symbol.slice(0, 2)}
                </span>
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{tokenInfo.symbol}</h2>
              <p className="text-gray-400 text-sm">{tokenInfo.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Total Supply</p>
              <p className="text-xl font-bold text-white">
                {formatNumber(tokenInfo.totalSupply)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats & Actions */}
      {holders.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-sm">Total Holders</span>
              </div>
              <p className="text-2xl font-bold text-white">{holders.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Filter className="w-4 h-4" />
                <span className="text-sm">Filtered</span>
              </div>
              <p className="text-2xl font-bold text-white">{filteredHolders.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Coins className="w-4 h-4" />
                <span className="text-sm">Top Holder</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: "#fb57ff" }}>
                {holders[0]?.percentage.toFixed(2)}%
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Coins className="w-4 h-4" />
                <span className="text-sm">Top 10 Hold</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {holders
                  .slice(0, 10)
                  .reduce((sum, h) => sum + h.percentage, 0)
                  .toFixed(2)}
                %
              </p>
            </div>
          </div>

          {/* Filters Toggle */}
          <div className="mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] text-gray-400 hover:text-white transition-all"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mb-6 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Min Balance
                  </label>
                  <input
                    type="number"
                    value={minBalance}
                    onChange={(e) => setMinBalance(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] focus:border-[#fb57ff]/50 outline-none text-white placeholder-gray-600 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Max Balance
                  </label>
                  <input
                    type="number"
                    value={maxBalance}
                    onChange={(e) => setMaxBalance(e.target.value)}
                    placeholder="No limit"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] focus:border-[#fb57ff]/50 outline-none text-white placeholder-gray-600 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Top N Holders
                  </label>
                  <input
                    type="number"
                    value={topHolders}
                    onChange={(e) => setTopHolders(e.target.value)}
                    placeholder="All"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] focus:border-[#fb57ff]/50 outline-none text-white placeholder-gray-600 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Exclude Addresses
                  </label>
                  <input
                    type="text"
                    value={excludeAddresses}
                    onChange={(e) => setExcludeAddresses(e.target.value)}
                    placeholder="Comma separated"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] focus:border-[#fb57ff]/50 outline-none text-white placeholder-gray-600 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={applyFilters}
                className="px-4 py-2 rounded-lg bg-[#fb57ff]/10 border border-[#fb57ff] text-[#fb57ff] text-sm font-medium hover:bg-[#fb57ff]/20 transition-all"
              >
                Apply Filters
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 text-gray-300 hover:text-white transition-all"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={exportForAirdrop}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 text-gray-300 hover:text-white transition-all"
            >
              <Download className="w-4 h-4" />
              Export for Airdrop
            </button>
            <button
              onClick={copyAllAddresses}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 text-gray-300 hover:text-white transition-all"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy All Addresses
                </>
              )}
            </button>
          </div>

          {/* Holders Table */}
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    <th
                      onClick={() => handleSort("rank")}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center gap-1">
                        Rank
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                      Wallet
                    </th>
                    <th
                      onClick={() => handleSort("balance")}
                      className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Balance
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("percentage")}
                      className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center justify-end gap-1">
                        % Supply
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHolders.slice(0, 100).map((holder) => (
                    <tr
                      key={holder.wallet}
                      className="border-b border-white/[0.02] hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-medium ${
                            holder.rank <= 3 ? "text-[#fb57ff]" : "text-gray-400"
                          }`}
                        >
                          #{holder.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`https://solscan.io/account/${holder.wallet}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-sm text-gray-300 hover:text-[#fb57ff] transition-colors"
                        >
                          {holder.wallet.slice(0, 8)}...{holder.wallet.slice(-8)}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-white">
                          {formatNumber(holder.balance)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-gray-400">
                          {holder.percentage.toFixed(4)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredHolders.length > 100 && (
              <div className="px-4 py-3 text-center text-sm text-gray-500 border-t border-white/[0.05]">
                Showing top 100 of {filteredHolders.length} holders. Export CSV for full list.
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty State */}
      {!loading && holders.length === 0 && !error && (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-white/[0.02] flex items-center justify-center mx-auto mb-4">
            <Camera className="w-10 h-10 text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Take a Holder Snapshot
          </h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Enter a token mint address to get a list of all holders with their
            balances. Perfect for airdrops, analytics, and community insights.
          </p>
        </div>
      )}
    </div>
  );
}