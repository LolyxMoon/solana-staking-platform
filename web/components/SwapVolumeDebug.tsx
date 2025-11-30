// components/SwapVolumeDebug.tsx
// Admin component to verify USD volume tracking is working correctly
// Add this temporarily to your swap page to verify tracking

"use client";

import { useState, useEffect } from "react";
import { formatUSD } from "@/lib/token-prices";

interface SwapStat {
  id: string;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  volumeUsd: number;
  priceUsd: number;
  userAddress: string;
  createdAt: string;
}

export default function SwapVolumeDebug() {
  const [recentSwaps, setRecentSwaps] = useState<SwapStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentSwaps();
    // Refresh every 10 seconds
    const interval = setInterval(loadRecentSwaps, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadRecentSwaps = async () => {
    try {
      const res = await fetch('/api/swap/recent?limit=10');
      if (res.ok) {
        const data = await res.json();
        setRecentSwaps(data.swaps || []);
      }
    } catch (error) {
      console.error('Failed to load recent swaps:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
        <p className="text-gray-400">Loading recent swaps...</p>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white">Recent Swaps (USD Tracking Debug)</h3>
        <button 
          onClick={loadRecentSwaps}
          className="text-sm px-3 py-1 bg-white/[0.05] rounded-lg hover:bg-white/[0.08]"
        >
          Refresh
        </button>
      </div>

      {recentSwaps.length === 0 ? (
        <p className="text-gray-400 text-sm">No swaps recorded yet</p>
      ) : (
        <div className="space-y-2">
          {recentSwaps.map((swap) => (
            <div 
              key={swap.id}
              className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-white">
                  {swap.fromToken} → {swap.toToken}
                </span>
                <span className={`font-bold ${swap.volumeUsd > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {swap.volumeUsd > 0 ? formatUSD(swap.volumeUsd) : 'No USD price'}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>
                  {swap.fromAmount.toFixed(4)} {swap.fromToken} → {swap.toAmount.toFixed(4)} {swap.toToken}
                </span>
                {swap.priceUsd > 0 && (
                  <span>
                    ${swap.priceUsd.toFixed(4)} per token
                  </span>
                )}
              </div>

              <div className="text-xs text-gray-500 font-mono">
                {swap.userAddress.slice(0, 8)}...{swap.userAddress.slice(-6)}
              </div>

              {/* USDT/USDC indicator */}
              {(swap.fromToken === 'USDT' || swap.fromToken === 'USDC' || 
                swap.toToken === 'USDT' || swap.toToken === 'USDC') && (
                <div className="flex items-center gap-1 text-xs text-blue-400">
                  <span>💵</span>
                  <span>Stablecoin swap - priced at $1.00</span>
                </div>
              )}

              {/* Warning if no USD price */}
              {swap.volumeUsd === 0 && (
                <div className="flex items-center gap-1 text-xs text-yellow-400">
                  <span>⚠️</span>
                  <span>Price not found - won't count toward leaderboard</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-white/[0.05] space-y-1">
        <p className="text-xs text-gray-400">
          ✅ USDT/USDC swaps are always valued at $1.00
        </p>
        <p className="text-xs text-gray-400">
          ✅ Other tokens use DexScreener real-time prices
        </p>
        <p className="text-xs text-gray-400">
          ℹ️ Only swaps with USD values count toward leaderboard
        </p>
      </div>
    </div>
  );
}