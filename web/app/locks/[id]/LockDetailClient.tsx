"use client";

import { useState, useEffect } from "react";
import {
  Lock,
  Calendar,
  Clock,
  User,
  Copy,
  ExternalLink,
  Share2,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { formatDistance, format } from "date-fns";
import Link from "next/link";
import LockChart from "@/components/LockChart";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useStakingProgram } from "@/hooks/useStakingProgram";

interface LockDetailClientProps {
  lock: {
    id: string;
    lockId: number;
    tokenMint: string;
    name: string;
    symbol: string;
    amount: number;
    lockDuration: number;
    unlockTime: Date;
    creatorWallet: string;
    poolId?: number;
    stakePda?: string;
    logo: string | null;
    isActive: boolean;
    isUnlocked: boolean;
    createdAt: Date;
  };
}

export default function LockDetailClient({ lock: initialLock }: LockDetailClientProps) {
  const { publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const { unstake } = useStakingProgram();
  const [lock, setLock] = useState(initialLock);
  const [copied, setCopied] = useState<string | null>(null);
  const [shareTooltip, setShareTooltip] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  const unlockDate = new Date(lock.unlockTime);
  const createdDate = new Date(lock.createdAt);
  
  const [now, setNow] = useState<Date | null>(null);
  
  useEffect(() => {
    setMounted(true);
    setNow(new Date());
  }, []);

  const isUnlockable = now ? unlockDate <= now : false;
  const isOwner = publicKey && lock.creatorWallet === publicKey.toString();

  const timeRemaining = mounted && now
    ? (unlockDate > now
        ? formatDistance(unlockDate, now, { addSuffix: true })
        : "Unlocked")
    : "...";

  const progress = mounted && now
    ? ((now.getTime() - createdDate.getTime()) /
        (unlockDate.getTime() - createdDate.getTime())) * 100
    : 0;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const shareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setShareTooltip(true);
    setTimeout(() => setShareTooltip(false), 2000);
  };

  const handleUnlock = async () => {
    if (!publicKey || !isOwner || !wallet) {
      setUnlockError("You must be the owner and have your wallet connected");
      return;
    }

    if (lock.poolId === null || lock.poolId === undefined) {
      setUnlockError("Pool ID not found. Cannot unlock.");
      return;
    }

    setIsUnlocking(true);
    setUnlockError("");

    try {
      console.log("🔓 Starting unlock process...");
      console.log("   Token Mint:", lock.tokenMint);
      console.log("   Pool ID:", lock.poolId);
      console.log("   Saved Stake PDA:", lock.stakePda);
      
      const { getProgram, getPDAs } = await import("@/lib/anchor-program");
      const { PublicKey: PK } = await import("@solana/web3.js");
      
      const program = getProgram(wallet.adapter, connection);
      const tokenMintPubkey = new PK(lock.tokenMint);
      
      // Derive PDAs
      const [projectPDA] = getPDAs.project(tokenMintPubkey, lock.poolId);
      const [stakingVaultPDA] = getPDAs.stakingVault(tokenMintPubkey, lock.poolId);
      const [derivedStakePDA] = getPDAs.userStake(projectPDA, publicKey);
      
      console.log("🔍 PDAs:");
      console.log("   Project PDA:", projectPDA.toString());
      console.log("   Staking Vault:", stakingVaultPDA.toString());
      console.log("   Derived Stake PDA:", derivedStakePDA.toString());
      console.log("   Saved Stake PDA:  ", lock.stakePda || "NOT SAVED");
      console.log("   PDAs Match:", lock.stakePda === derivedStakePDA.toString());
      
      // Use saved PDA if available
      const userStakePDA = lock.stakePda 
        ? new PK(lock.stakePda) 
        : derivedStakePDA;
      
      console.log("   Using Stake PDA:", userStakePDA.toString());
      
      // Check if project exists
      try {
        const project = await program.account.project.fetch(projectPDA, "confirmed");
        console.log("✅ Project exists on-chain");
        console.log("   Token Mint:", project.tokenMint.toString());
        console.log("   Pool ID:", project.poolId.toString());
      } catch (e) {
        console.error("❌ Project NOT FOUND on-chain!");
        setUnlockError(`Project not found for poolId ${lock.poolId}`);
        setIsUnlocking(false);
        return;
      }
      
      // Check if user stake exists using the correct PDA
      try {
        const stakeAccount = await program.account.stake.fetch(userStakePDA, "confirmed");
        console.log("✅ User stake exists on-chain");
        console.log("   Staked Amount:", stakeAccount.amount.toString());
      
      if (stakeAccount.amount.toNumber() === 0) {
        setUnlockError("This lock has already been unlocked.");
        setIsUnlocking(false);
        return;
      }
      } catch (e) {
        console.error("❌ User stake NOT FOUND!");
        setUnlockError("Stake account not found. May have been unlocked already.");
        setIsUnlocking(false);
        return;
      }
      
      // Check vault balance
      try {
        const vaultBalance = await connection.getTokenAccountBalance(stakingVaultPDA);
        console.log("✅ Vault balance:", vaultBalance.value.uiAmount);
      } catch (e) {
        console.error("❌ Could not fetch vault balance");
      }
      
      console.log("✅ All checks passed, proceeding with unstake...");
      
      await unstake(lock.tokenMint, lock.poolId);
      
      const response = await fetch(`/api/locks/${lock.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false, isUnlocked: true }),
      });

      if (response.ok) {
        setLock(await response.json());
      }
      
      alert("Tokens unlocked successfully! ✅");
    } catch (error: any) {
      console.error("❌ Error unlocking:", error);
      setUnlockError(error.message || "Failed to unlock tokens");
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back button */}
      <Link
        href="/locks"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Locks
      </Link>

      {/* Header Card */}
      <div className="mb-6 p-6 rounded-2xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-sm relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background:
              "radial-gradient(circle at top right, rgba(251, 87, 255, 0.3), transparent 50%)",
          }}
        />

        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              {lock.logo ? (
                <img
                  src={lock.logo}
                  alt={lock.symbol}
                  className="w-16 h-16 rounded-full"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#fb57ff] to-purple-600 flex items-center justify-center">
                  <Lock className="w-8 h-8 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">{lock.name}</h1>
                <p className="text-lg text-gray-400">{lock.symbol}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={shareLink}
                className="relative p-3 rounded-lg bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.08] transition-colors"
              >
                <Share2 className="w-5 h-5 text-gray-400" />
                {shareTooltip && (
                  <div className="absolute -bottom-10 right-0 px-3 py-1 rounded bg-green-500 text-white text-xs whitespace-nowrap">
                    Link copied!
                  </div>
                )}
              </button>
              <div
                className={`px-4 py-3 rounded-lg text-sm font-medium ${
                  isUnlockable
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : lock.isActive
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                }`}
              >
                {isUnlockable ? "🔓 Unlockable" : lock.isActive ? "🔒 Locked" : "Inactive"}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-400 mb-1">Locked Amount</p>
            <p className="text-4xl font-bold text-white">
              {lock.amount.toLocaleString()} {lock.symbol}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Time Remaining</span>
              </div>
              <p
                className={`text-lg font-semibold ${
                  isUnlockable ? "text-green-400" : "text-white"
                }`}
              >
                {timeRemaining}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Unlock Date</span>
              </div>
              <p className="text-lg font-semibold text-white">
                {mounted ? format(unlockDate, "MMM dd, yyyy") : "..."}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Lock className="w-4 h-4" />
                <span className="text-sm">Lock Duration</span>
              </div>
              <p className="text-lg font-semibold text-white">
                {Math.floor(lock.lockDuration / 86400)} days
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 p-6 rounded-2xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-sm">
        <h2 className="text-xl font-bold text-white mb-6">Lock Timeline</h2>
        <LockChart createdAt={lock.createdAt} unlockTime={lock.unlockTime} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="p-6 rounded-2xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white mb-4">Token Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-400 mb-1">Token Mint</p>
              <div className="flex items-center gap-2">
                <code className="text-sm text-white bg-white/[0.05] px-3 py-2 rounded flex-1 overflow-hidden text-ellipsis">
                  {lock.tokenMint.slice(0, 8)}...{lock.tokenMint.slice(-8)}
                </code>
                <button
                  onClick={() => copyToClipboard(lock.tokenMint, "mint")}
                  className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
                >
                  {copied === "mint" ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                <a
                  href={`https://solscan.io/token/${lock.tokenMint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </a>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-1">Lock ID</p>
              <p className="text-white font-medium">#{lock.lockId}</p>
            </div>

            {lock.poolId !== undefined && (
              <div>
                <p className="text-sm text-gray-400 mb-1">Pool ID</p>
                <p className="text-white font-medium">#{lock.poolId}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-400 mb-1">Created</p>
              <p className="text-white font-medium">
                {mounted ? format(createdDate, "MMM dd, yyyy HH:mm") : "..."}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white mb-4">Creator</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-400 mb-1">Wallet Address</p>
              <div className="flex items-center gap-2">
                <code className="text-sm text-white bg-white/[0.05] px-3 py-2 rounded flex-1 overflow-hidden text-ellipsis">
                  {lock.creatorWallet.slice(0, 8)}...{lock.creatorWallet.slice(-8)}
                </code>
                <button
                  onClick={() => copyToClipboard(lock.creatorWallet, "creator")}
                  className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
                >
                  {copied === "creator" ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                <a
                  href={`https://solscan.io/account/${lock.creatorWallet}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </a>
              </div>
            </div>

            {isOwner && (
              <div className="mt-4 p-3 rounded-lg bg-[#fb57ff]/10 border border-[#fb57ff]/20 flex items-start gap-2">
                <User className="w-5 h-5 text-[#fb57ff] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#fb57ff]">You own this lock</p>
                  <p className="text-xs text-gray-400 mt-1">
                    You created this token lock
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Button */}
      {isOwner && isUnlockable && (
        <div className="p-6 rounded-2xl border border-green-500/20 bg-green-500/5 backdrop-blur-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Your tokens are ready to unlock!
                </h3>
                <p className="text-sm text-gray-400">
                  The lock period has ended. You can now withdraw your tokens.
                </p>
                {unlockError && (
                  <p className="text-sm text-red-400 mt-2">{unlockError}</p>
                )}
              </div>
            </div>
            <button 
              onClick={handleUnlock}
              disabled={isUnlocking}
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-50 flex items-center gap-2"
            >
              {isUnlocking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Unlocking...
                </>
              ) : (
                "Unlock Tokens"
              )}
            </button>
          </div>
        </div>
      )}

      {!isUnlockable && (
        <div className="p-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Lock is active</h3>
              <p className="text-sm text-gray-400">
                Your tokens are securely locked. They will be available for withdrawal{" "}
                {timeRemaining}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}