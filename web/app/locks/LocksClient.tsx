"use client";

import { useState, useMemo } from "react";
import { Lock, Plus, Search, Filter } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import LockCard from "@/components/LockCard";
import CreateLockModal from "@/components/CreateLockModal";

interface Lock {
  id: string;
  lockId: number;
  tokenMint: string;
  name: string;
  symbol: string;
  amount: number;
  lockDuration: number;
  unlockTime: Date;
  creatorWallet: string;
  logo: string | null;
  isActive: boolean;
  isUnlocked: boolean;
  createdAt: Date;
}

interface LocksClientProps {
  locks: Lock[];
}

export default function LocksClient({ locks: initialLocks }: LocksClientProps) {
  const { publicKey } = useWallet();
  const [locks, setLocks] = useState<Lock[]>(initialLocks);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "my-locks" | "active" | "unlockable">("all");

  const refreshLocks = async () => {
    try {
      const response = await fetch("/api/locks");
      if (response.ok) {
        const data = await response.json();
        setLocks(data);
      }
    } catch (error) {
      console.error("Error refreshing locks:", error);
    }
  };

  const filteredLocks = useMemo(() => {
    let filtered = locks;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (lock) =>
          lock.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lock.tokenMint.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by type
    if (filterType === "my-locks" && publicKey) {
      filtered = filtered.filter(
        (lock) => lock.creatorWallet === publicKey.toString()
      );
    } else if (filterType === "active") {
      filtered = filtered.filter(
        (lock) => lock.isActive && new Date(lock.unlockTime) > new Date()
      );
    } else if (filterType === "unlockable") {
      filtered = filtered.filter(
        (lock) => lock.isActive && new Date(lock.unlockTime) <= new Date()
      );
    }

    return filtered;
  }, [locks, searchQuery, filterType, publicKey]);

  const myLocksCount = useMemo(() => {
    if (!publicKey) return 0;
    return locks.filter((lock) => lock.creatorWallet === publicKey.toString()).length;
  }, [locks, publicKey]);

  const stats = useMemo(() => {
    const now = new Date();
    const activeLocks = locks.filter((lock) => lock.isActive && new Date(lock.unlockTime) > now);
    const unlockableLocks = locks.filter((lock) => lock.isActive && new Date(lock.unlockTime) <= now);
    const totalLocked = locks.reduce((sum, lock) => sum + lock.amount, 0);

    return {
      total: locks.length,
      active: activeLocks.length,
      unlockable: unlockableLocks.length,
      totalLocked,
    };
  }, [locks]);

  return (
    <>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Token Locks</h1>
              <p className="text-gray-400">
                Lock your tokens securely for a specified duration
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-[#fb57ff] to-purple-600 text-white font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-5 h-5" />
              Create Lock
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-sm text-gray-400 mb-1">Total Locks</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-sm text-gray-400 mb-1">Active Locks</p>
              <p className="text-2xl font-bold text-white">{stats.active}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-sm text-gray-400 mb-1">Unlockable</p>
              <p className="text-2xl font-bold text-white">{stats.unlockable}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-sm text-gray-400 mb-1">My Locks</p>
              <p className="text-2xl font-bold text-white">{myLocksCount}</p>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, symbol, or token mint..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#fb57ff]/50 transition-colors"
              />
            </div>

            <div className="flex gap-2">
              {["all", "my-locks", "active", "unlockable"].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type as typeof filterType)}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium whitespace-nowrap transition-all ${
                    filterType === type
                      ? "bg-[#fb57ff]/10 border-[#fb57ff] text-[#fb57ff]"
                      : "bg-white/[0.02] border-white/[0.1] text-gray-400 hover:border-white/[0.2]"
                  }`}
                >
                  {type === "my-locks"
                    ? "My Locks"
                    : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Locks Grid */}
        {filteredLocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-full bg-white/[0.02] flex items-center justify-center mb-4">
              <Lock className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No locks found</h3>
            <p className="text-gray-400 text-center max-w-md mb-6">
              {filterType === "my-locks"
                ? "You haven't created any locks yet. Create your first lock to get started."
                : searchQuery
                ? "No locks match your search criteria. Try adjusting your filters."
                : "There are no locks available. Be the first to create one!"}
            </p>
            {filterType === "all" && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-[#fb57ff] to-purple-600 text-white font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-5 h-5" />
                Create Your First Lock
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLocks.map((lock) => (
              <LockCard key={lock.id} lock={lock} />
            ))}
          </div>
        )}
      </div>

      {/* Create Lock Modal */}
      <CreateLockModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={refreshLocks}
      />
    </>
  );
}

