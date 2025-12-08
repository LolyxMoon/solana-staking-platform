"use client";
import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from "@solana/web3.js";

const ADMIN_WALLET = "ecfvkqWdJiYJRyUtWvuYpPWP5faf9GBcA1K6TaDW7wS";
const REWARD_WALLET = new PublicKey("JutoRW8bYVaPpZQXUYouEUaMN24u6PxzLryCLuJZsL9");

interface DistributionEntry {
  walletAddress: string;
  twitterUsername: string;
  totalPoints: number;
  likesCount: number;
  retweetsCount: number;
  quotesCount: number;
  sharePercent: string;
  solAmount?: number;
}

interface SyncUpdate {
  wallet: string;
  username: string;
  addedLikes: number;
  addedRetweets: number;
  addedPoints: number;
  totalPoints: number;
}

export default function WhaleClubAdmin() {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [isLoading, setIsLoading] = useState(false);
  const [rewardPoolBalance, setRewardPoolBalance] = useState<number>(0);
  const [snapshot, setSnapshot] = useState<{
  totalPoints: number;
  userCount: number;
  distribution: DistributionEntry[];
  removed?: any[];
  removedCount?: number;
} | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  // Twitter Sync
  const [tweetIdsInput, setTweetIdsInput] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    tweetsProcessed: number;
    usersUpdated: number;
    updates: SyncUpdate[];
  } | null>(null);

  const isAdmin = connected && publicKey?.toString() === ADMIN_WALLET;

  // Fetch reward pool balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const balance = await connection.getBalance(REWARD_WALLET);
        setRewardPoolBalance(balance / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error("Error fetching reward pool balance:", error);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [connection]);

  const handleAction = async (action: "snapshot" | "reset") => {
    if (!publicKey || !signTransaction || !connection) {
      setMessage("Wallet not connected");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const timestamp = Date.now();

      // Create a 0 SOL transaction to self (works with Ledger)
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: publicKey,
          lamports: 0,
        })
      );
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signedTransaction = await signTransaction(transaction);
      const serialized = Buffer.from(signedTransaction.serialize()).toString('base64');

      const response = await fetch("/api/whale-club/admin/distribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminWallet: publicKey.toString(),
          action,
          signedTransaction: serialized,
          timestamp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Action failed");
      }

      if (action === "snapshot") {
        const distributionWithSol = data.distribution.map((entry: DistributionEntry) => ({
          ...entry,
          solAmount: (parseFloat(entry.sharePercent) / 100) * rewardPoolBalance,
        }));

        setSnapshot({
          ...data,
          distribution: distributionWithSol,
        });
        setMessage(`Snapshot taken: ${data.userCount} users, ${data.totalPoints} total points`);
      } else {
        setSnapshot(null);
        setMessage("✅ All points have been reset to zero");
      }
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncTwitter = async () => {
    if (!publicKey) {
      setMessage("Wallet not connected");
      return;
    }

    const tweetIds = tweetIdsInput
      .split(/[\n,\s]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (tweetIds.length === 0) {
      setMessage("❌ Enter at least one tweet ID");
      return;
    }

    setSyncing(true);
    setMessage(null);
    setSyncResult(null);

    try {
      const response = await fetch("/api/whale-club/admin/sync-engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          tweetIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Sync failed");
      }

      setSyncResult(data);
      setMessage(`✅ Synced ${data.tweetsProcessed} tweets, updated ${data.usersUpdated} users`);
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            🐋 Whale Club Admin
          </h1>
          <p className="text-gray-400">
            Manage Twitter sync, reward distribution, and reset points
          </p>
        </div>

        {/* Reward Pool Balance */}
        <div className="bg-white/[0.02] border border-[#fb57ff]/20 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Reward Pool Balance</p>
              <p className="text-3xl font-bold text-[#fb57ff] font-mono">
                {rewardPoolBalance.toFixed(4)} SOL
              </p>
            </div>
            <div className="text-4xl">💰</div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Wallet: {REWARD_WALLET.toString().slice(0, 8)}...{REWARD_WALLET.toString().slice(-8)}
          </p>
        </div>

        {/* Wallet Connection */}
        {!connected && (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-8 text-center">
            <p className="text-gray-400 mb-4">Connect admin wallet to continue</p>
            <WalletMultiButton />
          </div>
        )}

        {/* Not Admin */}
        {connected && !isAdmin && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
            <p className="text-red-400 text-lg mb-2">⛔ Unauthorized</p>
            <p className="text-gray-400 text-sm">
              Connected: {publicKey?.toString().slice(0, 8)}...
            </p>
            <p className="text-gray-500 text-xs mt-2">
              Required: {ADMIN_WALLET.slice(0, 8)}...
            </p>
          </div>
        )}

        {/* Admin Panel */}
        {isAdmin && (
          <div className="space-y-6">
            
            {/* Twitter Sync Section */}
            <div className="bg-white/[0.02] border border-blue-500/20 rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <span>🐦</span> Twitter Engagement Sync
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                Enter StakePoint tweet IDs to sync likes and retweets from registered users.
                Find tweet IDs from the URL: twitter.com/StakePointApp/status/<strong>TWEET_ID</strong>
              </p>
              
              <textarea
                value={tweetIdsInput}
                onChange={(e) => setTweetIdsInput(e.target.value)}
                placeholder="Enter tweet IDs (one per line or comma-separated)&#10;Example:&#10;1234567890123456789&#10;9876543210987654321"
                className="w-full h-32 px-4 py-3 bg-black/50 border border-white/[0.1] rounded-lg text-sm 
                         focus:outline-none focus:border-blue-500/50 resize-none font-mono"
              />
              
              <button
                onClick={handleSyncTwitter}
                disabled={syncing || !tweetIdsInput.trim()}
                className="mt-4 w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 
                         hover:from-blue-600 hover:to-blue-700 rounded-lg font-semibold 
                         transition-all disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
              >
                {syncing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>🔄 Sync Engagement</>
                )}
              </button>

              {/* Sync Results */}
              {syncResult && (
                <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="font-semibold text-green-400 mb-2">
                    ✅ Sync Complete
                  </p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-400">Tweets Processed</p>
                      <p className="text-xl font-bold">{syncResult.tweetsProcessed}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Users Updated</p>
                      <p className="text-xl font-bold">{syncResult.usersUpdated}</p>
                    </div>
                  </div>
                  
                  {syncResult.updates.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400 font-semibold">Updates:</p>
                      {syncResult.updates.map((update, i) => (
                        <div key={i} className="flex justify-between items-center text-sm bg-black/30 rounded px-3 py-2">
                          <span>@{update.username}</span>
                          <span className="text-gray-400">
                            +{update.addedLikes} likes, +{update.addedRetweets} RTs = 
                            <span className="text-[#fb57ff] ml-1">+{update.addedPoints} pts</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => handleAction("snapshot")}
                disabled={isLoading}
                className="bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 
                         rounded-xl p-6 text-left transition-all disabled:opacity-50"
              >
                <div className="text-2xl mb-2">📊</div>
                <h3 className="font-semibold mb-1">Take Snapshot</h3>
                <p className="text-sm text-gray-400">
                  View current standings and SOL distribution amounts
                </p>
              </button>

              <button
                onClick={() => handleAction("reset")}
                disabled={isLoading}
                className="bg-white/[0.02] border border-red-500/20 hover:border-red-500/50 
                         rounded-xl p-6 text-left transition-all disabled:opacity-50"
              >
                <div className="text-2xl mb-2">🔄</div>
                <h3 className="font-semibold mb-1">Reset Points</h3>
                <p className="text-sm text-gray-400">
                  Clear all points after distribution (cannot undo!)
                </p>
              </button>
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 text-center">
                <div className="w-6 h-6 border-2 border-[#fb57ff] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-gray-400">Processing... Sign the transaction in your wallet</p>
              </div>
            )}

            {/* Message */}
            {message && (
              <div className={`rounded-xl p-4 ${
                message.startsWith("❌") 
                  ? "bg-red-500/10 border border-red-500/30 text-red-400"
                  : "bg-green-500/10 border border-green-500/30 text-green-400"
              }`}>
                {message}
              </div>
            )}

            {/* Snapshot Results */}
            {snapshot && (
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <span>📊</span> Distribution Snapshot
                </h3>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-black/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-1">Total Users</p>
                    <p className="text-2xl font-bold text-[#fb57ff]">{snapshot.userCount}</p>
                  </div>
                  <div className="bg-black/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-1">Total Points</p>
                    <p className="text-2xl font-bold text-[#fb57ff]">{snapshot.totalPoints.toLocaleString()}</p>
                  </div>
                  <div className="bg-black/50 rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-1">Pool Balance</p>
                    <p className="text-2xl font-bold text-green-400">{rewardPoolBalance.toFixed(4)}</p>
                  </div>
                </div>

                {/* Distribution Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.05]">
                        <th className="text-left py-2 text-gray-400 font-medium">#</th>
                        <th className="text-left py-2 text-gray-400 font-medium">User</th>
                        <th className="text-right py-2 text-gray-400 font-medium">Points</th>
                        <th className="text-right py-2 text-gray-400 font-medium">Share</th>
                        <th className="text-right py-2 text-gray-400 font-medium">SOL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.distribution.map((entry, index) => (
                        <tr key={entry.walletAddress} className="border-b border-white/[0.02]">
                          <td className="py-3 text-gray-500">{index + 1}</td>
                          <td className="py-3">
                            <p className="font-medium">@{entry.twitterUsername || "Anonymous"}</p>
                            <p className="text-xs text-gray-500 font-mono">
                              {entry.walletAddress.slice(0, 4)}...{entry.walletAddress.slice(-4)}
                            </p>
                          </td>
                          <td className="py-3 text-right font-mono">{entry.totalPoints.toLocaleString()}</td>
                          <td className="py-3 text-right font-mono text-gray-400">{entry.sharePercent}%</td>
                          <td className="py-3 text-right font-mono text-green-400 font-semibold">
                            {entry.solAmount?.toFixed(4)} SOL
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>]

                {/* Removed Users */}
                {snapshot.removed && snapshot.removed.length > 0 && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="font-semibold text-red-400 mb-2">
                    🗑️ {snapshot.removedCount} Users Removed (Sold Below 10M SPT)
                    </p>
                    <div className="space-y-2">
                    {snapshot.removed.map((user: any) => (
                        <div key={user.walletAddress} className="flex justify-between items-center text-sm bg-black/30 rounded px-3 py-2">
                        <span>@{user.twitterUsername || 'Anonymous'}</span>
                        <span className="text-red-400">
                            Had {user.totalPoints} pts, holds {user.totalBalance.toLocaleString()} SPT
                        </span>
                        </div>
                    ))}
                    </div>
                </div>
                )}

                {/* Total Check */}
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex justify-between items-center">
                  <span className="text-gray-400">Total to Distribute:</span>
                  <span className="font-mono font-bold text-green-400">
                    {snapshot.distribution.reduce((sum, e) => sum + (e.solAmount || 0), 0).toFixed(4)} SOL
                  </span>
                </div>

                {/* Copy Options */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const text = snapshot.distribution
                        .map((e) => `${e.walletAddress}: ${e.solAmount?.toFixed(4)} SOL`)
                        .join("\n");
                      navigator.clipboard.writeText(text);
                      setMessage("✅ Wallet addresses & SOL amounts copied");
                    }}
                    className="py-2 bg-white/[0.05] hover:bg-white/[0.08] 
                             border border-white/[0.05] rounded-lg text-sm transition-all"
                  >
                    📋 Copy Wallets + SOL
                  </button>
                  <button
                    onClick={() => {
                      const text = snapshot.distribution
                        .map((e) => e.walletAddress)
                        .join("\n");
                      navigator.clipboard.writeText(text);
                      setMessage("✅ Wallet addresses copied");
                    }}
                    className="py-2 bg-white/[0.05] hover:bg-white/[0.08] 
                             border border-white/[0.05] rounded-lg text-sm transition-all"
                  >
                    📋 Copy Wallets Only
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}