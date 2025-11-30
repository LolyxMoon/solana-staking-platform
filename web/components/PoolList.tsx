"use client";

import { useState, useMemo } from "react";
import PoolCard from "@/components/PoolCard";

export default function PoolList({
  pools,
  prices,
}: {
  pools: any[];
  prices: Record<string, number>;
}) {
  const [sortOption, setSortOption] = useState("az");

  // ✅ Sorting logic
  const sortedPools = useMemo(() => {
    const copy = [...pools];
    switch (sortOption) {
      case "az":
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      case "za":
        return copy.sort((a, b) => b.name.localeCompare(a.name));
      case "highest":
        return copy.sort(
          (a, b) =>
            (prices[b.symbol] || 0) * (b.totalStaked || 0) -
            (prices[a.symbol] || 0) * (a.totalStaked || 0)
        );
      default:
        return copy;
    }
  }, [sortOption, pools, prices]);

  return (
    <div className="space-y-6">
      {/* ✅ Sorting dropdown */}
      <div className="flex justify-end mb-4">
        <label className="text-sm text-gray-400 mr-2">Sort by:</label>
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          className="px-3 py-2 rounded bg-slate-900 text-white text-sm border border-gray-600 focus:ring-2 focus:ring-blue-500"
        >
          <option value="az">A–Z</option>
          <option value="za">Z–A</option>
          <option value="highest">Highest $</option>
        </select>
      </div>

      {/* ✅ Pool grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sortedPools.map((pool) => (
          <PoolCard key={pool.id} {...pool} prices={prices} />
        ))}
      </div>
    </div>
  );
}
