"use client";

import { useState } from "react";
import { claimRewards } from "@/lib/claim";
import toast from "react-hot-toast";
import Spinner from "@/components/Spinner";

export default function RewardsSummary({
  pools,
  prices,
}: {
  pools: any[];
  prices: Record<string, number>;
}) {
  const [isClaimingAll, setIsClaimingAll] = useState(false);

  const activePools = pools.filter((p) => !p.staked.startsWith("0"));
  const breakdown = activePools.map((pool) => {
    const match = pool.rewards.match(/^([\d.]+)\s*(\w+)/);
    if (!match) return { ...pool, usdValue: 0 };
    const [, num, symbol] = match;
    const amount = parseFloat(num);
    const price = prices[symbol] || 0;
    return { ...pool, usdValue: amount * price };
  });
  const totalUsd = breakdown.reduce((sum, p) => sum + p.usdValue, 0);

  const handleClaimAll = async () => {
    if (activePools.length === 0) return;
    setIsClaimingAll(true);

    try {
      for (const pool of activePools) {
        await claimRewards(pool.name);
      }
      toast.success("✅ Successfully claimed rewards from all staked pools!");
    } catch (err: any) {
      toast.error(err.message || "❌ Claim all failed.");
    } finally {
      setIsClaimingAll(false);
    }
  };

  return (
    <div className="rounded-xl border border-dark-border bg-dark-secondary p-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-dark-text">Your Rewards</h2>
        <p className="text-sm text-dark-muted">
          Total Value:{" "}
          <span className="font-medium text-brand-purple">
            {totalUsd > 0 ? `$${totalUsd.toFixed(2)}` : "Fetching..."}
          </span>
        </p>

        <ul className="mt-2 text-sm text-dark-muted">
          {breakdown.map((pool) => (
            <li key={pool.name}>
              {pool.name}:{" "}
              <span className="text-brand-purple font-medium">
                {pool.rewards}{" "}
                {pool.usdValue > 0
                  ? `($${pool.usdValue.toFixed(2)})`
                  : "(Fetching...)"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={handleClaimAll}
        disabled={isClaimingAll || activePools.length === 0}
        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-transform duration-200 ${
          isClaimingAll
            ? "border-brand-purple text-brand-purple cursor-not-allowed opacity-80"
            : "border-dark-border bg-dark-secondary text-dark-text hover:scale-105 hover:border-brand-purple hover:text-brand-purple hover:shadow-md"
        }`}
      >
        {isClaimingAll ? <Spinner /> : "Claim All"}
      </button>
    </div>
  );
}
