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

// Helius RPC endpoint - uses env variable or fallback
const HELIUS_RPC = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || "https://mainnet.helius-rpc.com/?api-key=2bd046b7-358b-43fe-afe9-1dd227347aee";

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

      return { mint, symbol, name, decimals, totalSupply, logoURI };
    } catch (err) {
      console.error("Error fetching token info:", err);
      return null;
    }
  };

  const fetchHoldersWithHelius = async (mint: string, decimals: number): Promise<Holder[]> => {
    const allHolders: Map<string, number> = new Map();
    let cursor: string | undefined = undefined;
    let page = 0;
    const maxPages = 100; // Safety limit - allows up to 100k holders

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

    // Convert to array and sort by balance
    const holdersArray = Array.from(allHolders.entries())
      .map(([wallet, balance]) => ({ wallet, balance }))
      .sort((a, b) => b.balance - a.balance);

    // Calculate total for percentages
    const totalHeld = holdersArray.reduce((sum, h) => sum + h.balance, 0);

    // Add rank and percentage
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
      // Fetch token info
      const info = await fetchTokenInfo(tokenMint);
      if (!info) {
        throw new Error("Failed to fetch token info. Make sure this is a valid SPL token.");
      }
      setTokenInfo(info);

      // Fetch holders using Helius DAS API
      const holderList = await fetchHoldersWithHelius(tokenMint, info.decimals);

      if (holderList.length === 0) {
        throw new Error("No holders found for this token");
      }

      setStatusMessage(`Found ${holderList.length} holders!`);
      setHolders(holderList);
      applyFilters(holderList);
    } catch (err: any) {
      console.error("Snapshot error:", err);
      setError(err.message || "Failed to take snapshot");
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
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "rank" ? "asc" : "desc");
    }
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
    if (filteredHolders.length === 0) return null;

    const top1 = filteredHolders[0]?.percentage || 0;
    const top10 = filteredHolders.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0);
    const top50 = filteredHolders.slice(0, 50).reduce((sum, h) => sum + h.percentage, 0);

    return { top1, top10, top50 };
  };

  const stats = getTopHolderStats();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Camera className="w-10 h-10 text-purple-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              Holder Snapshot
            </h1>
          </div>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Get a complete snapshot of all token holders. Export for airdrops, analyze distribution,
            and track concentration. Powered by Helius for accurate data.
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-2">Token Mint Address</label>
              <input
                type="text"
                value={tokenMint}
                onChange={(e) => setTokenMint(e.target.value)}
                placeholder="Enter SPL token mint address..."
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={takeSnapshot}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Take Snapshot
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Status/Error */}
          {loading && statusMessage && (
            <div className="mt-4 flex items-center gap-2 text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              {statusMessage}
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        {/* Token Info & Stats */}
        {tokenInfo && holders.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Token Info */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                Token Info
              </h2>
              <div className="flex items-center gap-4">
                {tokenInfo.logoURI && (
                  <img
                    src={tokenInfo.logoURI}
                    alt={tokenInfo.symbol}
                    className="w-12 h-12 rounded-full"
                  />
                )}
                <div>
                  <div className="font-bold text-xl">{tokenInfo.symbol}</div>
                  <div className="text-gray-400 text-sm">{tokenInfo.name}</div>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Supply:</span>
                  <span>{formatBalance(tokenInfo.totalSupply)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Decimals:</span>
                  <span>{tokenInfo.decimals}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Holders:</span>
                  <span className="text-green-400 font-semibold">{holders.length.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Holder Stats */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Holder Distribution
              </h2>
              {stats && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Top 1 Holder</span>
                      <span className="text-yellow-400">{stats.top1.toFixed(2)}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full"
                        style={{ width: `${Math.min(stats.top1, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Top 10 Holders</span>
                      <span className="text-blue-400">{stats.top10.toFixed(2)}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                        style={{ width: `${Math.min(stats.top10, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Top 50 Holders</span>
                      <span className="text-purple-400">{stats.top50.toFixed(2)}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                        style={{ width: `${Math.min(stats.top50, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-700 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Filtered Holders:</span>
                      <span>{filteredHolders.length.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        {holders.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 overflow-hidden">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
            >
              <span className="flex items-center gap-2 font-semibold">
                <Filter className="w-5 h-5 text-purple-400" />
                Filters & Export
              </span>
              <span className="text-gray-400">{showFilters ? "▲" : "▼"}</span>
            </button>

            {showFilters && (
              <div className="p-6 border-t border-gray-700 space-y-6">
                <div className="grid md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Min Balance</label>
                    <input
                      type="number"
                      value={minBalance}
                      onChange={(e) => setMinBalance(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Max Balance</label>
                    <input
                      type="number"
                      value={maxBalance}
                      onChange={(e) => setMaxBalance(e.target.value)}
                      placeholder="∞"
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Top N Holders</label>
                    <input
                      type="number"
                      value={topHolders}
                      onChange={(e) => setTopHolders(e.target.value)}
                      placeholder="All"
                      className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => applyFilters()}
                      className="w-full px-4 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg hover:bg-purple-500/30 transition-colors"
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
                    className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Export Buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={exportCSV}
                    disabled={filteredHolders.length === 0}
                    className="px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg hover:bg-green-500/30 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                  <button
                    onClick={exportForAirdrop}
                    disabled={filteredHolders.length === 0}
                    className="px-4 py-2 bg-blue-500/20 border border-blue-500/50 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Export for Airdrop
                  </button>
                  <button
                    onClick={copyAllAddresses}
                    disabled={filteredHolders.length === 0}
                    className="px-4 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center gap-2 disabled:opacity-50"
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
              </div>
            )}
          </div>
        )}

        {/* Holders Table */}
        {filteredHolders.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold">
                Showing {Math.min(filteredHolders.length, 100)} of {filteredHolders.length.toLocaleString()} holders
              </h2>
              <span className="text-sm text-gray-400">
                Full list available in CSV export
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900/50">
                  <tr>
                    <th
                      className="px-4 py-3 text-left cursor-pointer hover:bg-gray-700/30"
                      onClick={() => handleSort("rank")}
                    >
                      <span className="flex items-center gap-1">
                        Rank
                        <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">Wallet</th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:bg-gray-700/30"
                      onClick={() => handleSort("balance")}
                    >
                      <span className="flex items-center justify-end gap-1">
                        Balance
                        <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:bg-gray-700/30"
                      onClick={() => handleSort("percentage")}
                    >
                      <span className="flex items-center justify-end gap-1">
                        % of Supply
                        <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-center">Explorer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredHolders.slice(0, 100).map((holder) => (
                    <tr key={holder.wallet} className="hover:bg-gray-700/20 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className={`font-mono ${
                            holder.rank <= 3
                              ? "text-yellow-400 font-bold"
                              : holder.rank <= 10
                              ? "text-blue-400"
                              : "text-gray-400"
                          }`}
                        >
                          #{holder.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm">
                          {holder.wallet.slice(0, 4)}...{holder.wallet.slice(-4)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatBalance(holder.balance)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`${
                            holder.percentage >= 10
                              ? "text-red-400"
                              : holder.percentage >= 5
                              ? "text-yellow-400"
                              : "text-gray-300"
                          }`}
                        >
                          {holder.percentage.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <a
                          href={`https://solscan.io/account/${holder.wallet}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center p-1 hover:bg-gray-600/50 rounded transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-400 hover:text-white" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && holders.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Enter a token mint address to take a holder snapshot</p>
          </div>
        )}
      </div>
    </div>
  );
}