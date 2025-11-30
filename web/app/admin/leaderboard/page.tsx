"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Activity, DollarSign, Trophy, Calendar, Copy, ExternalLink } from "lucide-react";

interface WalletStat {
  rank: number;
  address: string;
  volumeUsd: number;
  swaps: number;
}

interface SwapStats {
  totalSwaps: number;
  totalVolumeUsd: number;
  totalFeesUsd: number;
  last24hVolumeUsd: number;
  last7dVolumeUsd: number;
  topPairs: {
    pair: string;
    volumeUsd: number;
    swaps: number;
  }[];
  topWallets: WalletStat[];
  dateRange: {
    start: string | null;
    end: string | null;
  };
}

export default function SwapLeaderboardPage() {
  const [stats, setStats] = useState<SwapStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "7d" | "30d" | "custom">("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const loadStats = async (start?: string, end?: string) => {
    setLoading(true);
    try {
      let url = "/api/swap/stats";
      const params = new URLSearchParams();
      
      if (start) params.append("startDate", start);
      if (end) params.append("endDate", end);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load stats");
      
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      console.error("Failed to load swap stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const applyDateFilter = () => {
    const now = new Date();
    let start: string | undefined;
    let end: string | undefined;

    switch (dateFilter) {
      case "today":
        start = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        end = new Date().toISOString();
        break;
      case "7d":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case "30d":
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case "custom":
        if (customStart) start = new Date(customStart).toISOString();
        if (customEnd) end = new Date(customEnd).toISOString();
        break;
    }

    loadStats(start, end);
  };

  useEffect(() => {
    applyDateFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Calculate proportional rewards
  const calculateRewards = () => {
    if (!stats || !stats.topWallets.length) return [];
    
    const rewardPool = stats.totalFeesUsd * 0.4; // 40% of fees
    const top10 = stats.topWallets.slice(0, 10);
    const top10TotalVolume = top10.reduce((sum, w) => sum + w.volumeUsd, 0);
    
    return stats.topWallets.map(wallet => {
      if (wallet.rank <= 10 && top10TotalVolume > 0) {
        const share = (wallet.volumeUsd / top10TotalVolume) * 100;
        const reward = (wallet.volumeUsd / top10TotalVolume) * rewardPool;
        return { ...wallet, share, reward };
      }
      return { ...wallet, share: 0, reward: 0 };
    });
  };

  const walletsWithRewards = calculateRewards();
  const rewardPool = (stats?.totalFeesUsd || 0) * 0.4;

  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 
            className="text-4xl font-bold mb-2"
            style={{ 
              background: 'linear-gradient(45deg, white, #fb57ff)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            🏆 Swap Leaderboard
          </h1>
          <p className="text-gray-500">Track top traders and reward high-volume swappers</p>
        </div>

        {/* Date Filter */}
        <div className="bg-white/[0.02] backdrop-blur border border-white/[0.05] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5" style={{ color: '#fb57ff' }} />
            <span className="font-semibold">Date Range</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {["all", "today", "7d", "30d", "custom"].map((filter) => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter as any)}
                className={`px-4 py-2 rounded-lg transition-all ${
                  dateFilter === filter
                    ? "text-white"
                    : "bg-white/[0.05] text-gray-300 hover:bg-white/[0.08]"
                }`}
                style={dateFilter === filter ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}
              >
                {filter === "all" ? "All Time" : 
                 filter === "today" ? "Today" :
                 filter === "7d" ? "Last 7 Days" :
                 filter === "30d" ? "Last 30 Days" :
                 "Custom Range"}
              </button>
            ))}
          </div>

          {dateFilter === "custom" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-2 bg-white/[0.05] border border-white/[0.05] rounded-lg text-white focus:outline-none"
              />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-2 bg-white/[0.05] border border-white/[0.05] rounded-lg text-white focus:outline-none"
              />
              <button
                onClick={applyDateFilter}
                className="px-4 py-2 rounded-lg text-white"
                style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
              >
                Apply Filter
              </button>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/[0.02] backdrop-blur border border-white/[0.05] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-5 h-5" style={{ color: '#fb57ff' }} />
              <span className="text-gray-400 text-sm">Total Swaps</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {stats?.totalSwaps.toLocaleString() || 0}
            </p>
          </div>

          <div className="bg-white/[0.02] backdrop-blur border border-white/[0.05] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5" style={{ color: '#fb57ff' }} />
              <span className="text-gray-400 text-sm">Total Volume (USD)</span>
            </div>
            <p className="text-3xl font-bold text-white">
              ${stats?.totalVolumeUsd?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}
            </p>
          </div>

          <div className="bg-white/[0.02] backdrop-blur border border-white/[0.05] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5" style={{ color: '#fb57ff' }} />
              <span className="text-gray-400 text-sm">Fees Collected (USD)</span>
            </div>
            <p className="text-3xl font-bold text-white">
              ${stats?.totalFeesUsd?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}
            </p>
          </div>

          <div className="bg-white/[0.02] backdrop-blur border border-white/[0.05] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-5 h-5" style={{ color: '#fb57ff' }} />
              <span className="text-gray-400 text-sm">Reward Pool (40%)</span>
            </div>
            <p className="text-3xl font-bold text-white">
              ${rewardPool.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">Split among top 10 by volume</p>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white/[0.02] backdrop-blur border border-white/[0.05] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5" style={{ color: '#fb57ff' }} />
            Top Traders Leaderboard
          </h3>

          {!stats?.topWallets || stats.topWallets.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No swaps recorded yet</p>
              <p className="text-sm mt-2">Be the first to trade!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Rank</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Wallet</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Volume (USD)</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Swaps</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Reward (USD)</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {walletsWithRewards.map((wallet) => (
                    <tr 
                      key={wallet.address}
                      className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-all"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {wallet.rank <= 3 && (
                            <span className="text-2xl">
                              {wallet.rank === 1 ? "🥇" : wallet.rank === 2 ? "🥈" : "🥉"}
                            </span>
                          )}
                          <span className="font-bold text-white">#{wallet.rank}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <code className="text-sm bg-white/[0.05] px-2 py-1 rounded">
                          {shortenAddress(wallet.address)}
                        </code>
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-white">
                        ${wallet.volumeUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 text-right text-gray-300">
                        {wallet.swaps}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {wallet.rank <= 10 ? (
                          <div>
                            <div className="font-semibold text-green-400">
                              ${wallet.reward.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-gray-500">
                              {wallet.share.toFixed(1)}% share
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => copyAddress(wallet.address)}
                            className="p-2 hover:bg-white/[0.05] rounded-lg transition-all"
                            title="Copy address"
                          >
                            <Copy className="w-4 h-4 text-gray-400" />
                          </button>
                          <a
                            href={`https://solscan.io/account/${wallet.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-white/[0.05] rounded-lg transition-all"
                            title="View on Solscan"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Copy notification */}
        {copiedAddress && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
            ✅ Address copied!
          </div>
        )}
      </div>
    </div>
  );
}