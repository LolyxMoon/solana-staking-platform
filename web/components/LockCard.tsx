"use client";

import { useState, useEffect } from "react";
import { Lock, Calendar, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatDistance } from "date-fns";

interface LockCardProps {
  lock: {
    id: string;
    name: string;
    symbol: string;
    amount: number;
    lockDuration: number;
    unlockTime: Date | string;
    logo?: string | null;
    isActive: boolean;
    isUnlocked: boolean;
    createdAt: Date | string;
  };
}

export default function LockCard({ lock }: LockCardProps) {
  const [mounted, setMounted] = useState(false);
  const unlockDate = new Date(lock.unlockTime);
  const createdDate = new Date(lock.createdAt);
  
  // Only calculate time-sensitive values on client
  const [now, setNow] = useState<Date | null>(null);
  
  useEffect(() => {
    setMounted(true);
    setNow(new Date());
  }, []);

  const isUnlockable = now ? unlockDate <= now : false;
  const timeRemaining = mounted && now
    ? (unlockDate > now
        ? formatDistance(unlockDate, now, { addSuffix: true })
        : "Unlocked")
    : "...";

  const progress = mounted && now
    ? (isUnlockable
        ? 100
        : ((now.getTime() - createdDate.getTime()) /
            (unlockDate.getTime() - createdDate.getTime())) *
          100)
    : 0;

  return (
    <Link
      href={`/locks/${lock.id}`}
      className="block group relative overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-sm hover:border-[#fb57ff]/30 hover:bg-white/[0.04] transition-all duration-300"
    >
      {/* Gradient glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div
          className="absolute inset-0 blur-xl"
          style={{
            background:
              "radial-gradient(circle at center, rgba(251, 87, 255, 0.1), transparent 70%)",
          }}
        />
      </div>

      <div className="relative p-6">
        {/* Header with logo and status */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {lock.logo ? (
              <img
                src={lock.logo}
                alt={lock.symbol}
                className="w-12 h-12 rounded-full"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#fb57ff] to-purple-600 flex items-center justify-center">
                <Lock className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-[#fb57ff] transition-colors">
                {lock.name}
              </h3>
              <p className="text-sm text-gray-400">{lock.symbol}</p>
            </div>
          </div>

          {/* Status badge */}
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              isUnlockable
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : lock.isActive
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
            }`}
          >
            {isUnlockable ? "Unlockable" : lock.isActive ? "Locked" : "Inactive"}
          </div>
        </div>

        {/* Amount */}
        <div className="mb-4">
          <p className="text-2xl font-bold text-white">
            {lock.amount.toLocaleString()} {lock.symbol}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400">Lock Progress</span>
            <span className="text-xs text-gray-400">{Math.min(progress, 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#fb57ff] to-purple-600 transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Lock details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">Unlocks:</span>
            <span className={`font-medium ${isUnlockable ? "text-green-400" : "text-white"}`}>
              {timeRemaining}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">Unlock date:</span>
            <span className="text-white font-medium">
              {mounted ? unlockDate.toLocaleDateString() : "..."}
            </span>
          </div>
        </div>

        {/* View details link */}
        <div className="mt-4 pt-4 border-t border-white/[0.05] flex items-center justify-between">
          <span className="text-sm text-gray-400">View details</span>
          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-[#fb57ff] transition-colors" />
        </div>
      </div>
    </Link>
  );
}

