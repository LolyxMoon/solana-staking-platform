"use client";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Link2, Copy, Check, Users, Coins, TrendingUp, ExternalLink, Share2 } from "lucide-react";
import Link from "next/link";

export default function ReferPage() {
  const { publicKey, connected } = useWallet();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({
    totalReferrals: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
  });

  const referralLink = publicKey 
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/create-pool?ref=${publicKey.toString()}`
    : '';

  const copyLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // TODO: Fetch actual referral stats from database
  useEffect(() => {
    if (publicKey) {
      // Fetch referral stats
      // const fetchStats = async () => {
      //   const res = await fetch(`/api/referrals/stats?wallet=${publicKey.toString()}`);
      //   const data = await res.json();
      //   setStats(data);
      // };
      // fetchStats();
    }
  }, [publicKey]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ 
              background: 'linear-gradient(45deg, white, #fb57ff)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent' 
            }}>
              StakePoint
            </span>
          </Link>
          <WalletMultiButton />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#fb57ff]/10 border border-[#fb57ff]/30 rounded-full mb-6">
            <Share2 className="w-4 h-4" style={{ color: '#fb57ff' }} />
            <span className="text-sm font-medium" style={{ color: '#fb57ff' }}>Referral Program</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ 
            background: 'linear-gradient(45deg, white, #fb57ff)', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent' 
          }}>
            Earn From Every Pool Created
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Share your referral link and earn <span className="text-white font-semibold">50%</span> of platform fees from every pool created through your link.
          </p>
        </div>

        {/* How It Works */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 hover:border-[#fb57ff]/30 transition-colors">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
              <Link2 className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2">1. Share Your Link</h3>
            <p className="text-gray-400 text-sm">
              Connect your wallet and share your unique referral link with project owners.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 hover:border-[#fb57ff]/30 transition-colors">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2">2. They Create Pools</h3>
            <p className="text-gray-400 text-sm">
              When someone creates a staking pool through your link, you're automatically set as the referrer.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 hover:border-[#fb57ff]/30 transition-colors">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
              <Coins className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2">3. Earn SOL Forever</h3>
            <p className="text-gray-400 text-sm">
              Earn 50% of all platform fees (deposits, withdrawals, claims) from that pool - forever!
            </p>
          </div>
        </div>

        {/* Referral Link Section */}
        {connected && publicKey ? (
          <div className="bg-white/[0.02] border border-[#fb57ff]/30 rounded-2xl p-8 mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
                <Link2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Your Referral Link</h2>
                <p className="text-sm text-gray-400">Share this link to earn from pool creations</p>
              </div>
            </div>

            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={referralLink}
                readOnly
                className="flex-1 px-4 py-3 bg-black border border-white/[0.1] rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[#fb57ff]/50"
                onClick={(e) => e.currentTarget.select()}
              />
              <button
                onClick={copyLink}
                className="px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 min-w-[120px] justify-center"
                style={{ 
                  background: copied ? 'linear-gradient(45deg, #22c55e, #16a34a)' : 'linear-gradient(45deg, black, #fb57ff)'
                }}
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy
                  </>
                )}
              </button>
            </div>

            {/* Quick Share Buttons */}
            <div className="flex flex-wrap gap-3">
              <a
                href={`https://twitter.com/intent/tweet?text=Create%20your%20staking%20pool%20on%20StakePoint!%20%F0%9F%9A%80&url=${encodeURIComponent(referralLink)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] hover:border-[#fb57ff]/30 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Share on X
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Create%20your%20staking%20pool%20on%20StakePoint!`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] hover:border-[#fb57ff]/30 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121L8.32 13.617l-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/></svg>
                Share on Telegram
              </a>
            </div>
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-[#fb57ff]/30 rounded-2xl p-8 mb-12 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
              <Link2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-6">Connect your wallet to generate your unique referral link</p>
            <WalletMultiButton />
          </div>
        )}

        {/* Stats Section (for connected users) */}
        {connected && publicKey && (
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-400">Total Referrals</span>
              </div>
              <div className="text-3xl font-bold">{stats.totalReferrals}</div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Coins className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-400">Total Earnings</span>
              </div>
              <div className="text-3xl font-bold">{stats.totalEarnings.toFixed(4)} <span className="text-lg text-gray-400">SOL</span></div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5" style={{ color: '#fb57ff' }} />
                <span className="text-sm text-gray-400">Pending Earnings</span>
              </div>
              <div className="text-3xl font-bold" style={{ color: '#fb57ff' }}>{stats.pendingEarnings.toFixed(4)} <span className="text-lg">SOL</span></div>
            </div>
          </div>
        )}

        {/* Benefits */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Why Refer Projects to StakePoint?</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
                <Check className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Passive Income</h3>
                <p className="text-sm text-gray-400">Earn automatically on every stake, unstake, and claim from referred pools.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
                <Check className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Lifetime Earnings</h3>
                <p className="text-sm text-gray-400">Your referral status is permanent. Earn for the entire lifetime of the pool.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
                <Check className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Instant Payments</h3>
                <p className="text-sm text-gray-400">Referral fees are paid directly to your wallet on-chain - no waiting.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
                <Check className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Help Projects Grow</h3>
                <p className="text-sm text-gray-400">Projects get staking infrastructure, communities get rewards, everyone wins.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link
            href="/pools"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] hover:border-[#fb57ff]/30 rounded-lg font-semibold transition-all"
          >
            View All Pools
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}