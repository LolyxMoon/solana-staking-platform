"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { RefreshCw, Trophy, Twitter, Wallet, Star, Users } from 'lucide-react';

// Constants
const SPT_MINT = new PublicKey('6uUU2z5GBasaxnkcqiQVHa2SXL68mAXDsq1zYN5Qxrm7');
const MIN_HOLDING = 10_000_000;
const SPT_DECIMALS = 9;
const REWARD_WALLET = new PublicKey('JutoRW8bYVaPpZQXUYouEUaMN24u6PxzLryCLuJZsL9');

interface UserData {
  wallet: string;
  twitterHandle: string | null;
  twitterId: string | null;
  points: number;
  totalLikes: number;
  totalRetweets: number;
  totalQuotes: number;
  lastChecked: Date | null;
  joinedAt: Date;
}

interface LeaderboardEntry {
  rank: number;
  wallet: string;
  twitterHandle: string;
  points: number;
}

const WhaleClub: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [isQualified, setIsQualified] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rewardPoolBalance, setRewardPoolBalance] = useState<number>(0);
  const [twitterConnected, setTwitterConnected] = useState<boolean>(false);
  const [syncing, setSyncing] = useState(false);

  // Check token balance (Token-2022 compatible)
  const checkTokenBalance = useCallback(async () => {
    if (!publicKey || !connection) return;
    
    try {
      const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
      const ata = await getAssociatedTokenAddress(SPT_MINT, publicKey, false, TOKEN_2022_PROGRAM_ID);
      const accountInfo = await connection.getAccountInfo(ata);
      
      if (accountInfo) {
        const data = accountInfo.data;
        const amountBytes = data.slice(64, 72);
        const amount = Number(new DataView(amountBytes.buffer, amountBytes.byteOffset, 8).getBigUint64(0, true));
        const balance = amount / Math.pow(10, SPT_DECIMALS);
        setTokenBalance(balance);
        setIsQualified(balance >= MIN_HOLDING);
      } else {
        setTokenBalance(0);
        setIsQualified(false);
      }
    } catch (error) {
      setTokenBalance(0);
      setIsQualified(false);
    }
    setIsLoading(false);
  }, [publicKey, connection]);

  const fetchRewardPoolBalance = useCallback(async () => {
    if (!connection) return;
    try {
      const solBalance = await connection.getBalance(REWARD_WALLET);
      setRewardPoolBalance(solBalance / 1e9);
    } catch (error) {
      console.error('Error fetching reward pool:', error);
    }
  }, [connection]);

  const fetchUserData = useCallback(async () => {
    if (!publicKey) return;
    try {
      const response = await fetch(`/api/whale-club/user/${publicKey.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const mappedData = {
          wallet: data.walletAddress,
          twitterHandle: data.twitterUsername,
          twitterId: data.twitterId,
          points: data.totalPoints,
          totalLikes: data.likesCount,
          totalRetweets: data.retweetsCount,
          totalQuotes: data.quotesCount,
          lastChecked: data.lastSyncedAt,
          joinedAt: data.createdAt,
        };
        setUserData(mappedData);
        setTwitterConnected(!!data.twitterUsername);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, [publicKey]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch('/api/whale-club/leaderboard');
      if (response.ok) {
        const data = await response.json();
        const mappedLeaderboard = data.map((entry: any, index: number) => ({
          rank: index + 1,
          wallet: entry.walletAddress,
          twitterHandle: entry.twitterUsername,
          points: entry.totalPoints,
        }));
        setLeaderboard(mappedLeaderboard);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  }, []);

  const connectTwitter = async () => {
    if (!publicKey) return;
    window.location.href = `/api/twitter/auth?wallet=${publicKey.toString()}`;
  };

  const syncTwitterActivity = async () => {
    if (!publicKey || syncing) return;
    setSyncing(true);
    try {
      const response = await fetch('/api/whale-club/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey.toString() }),
      });
      if (response.ok) {
        await fetchUserData();
        await fetchLeaderboard();
      }
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (connected && publicKey) {
      checkTokenBalance();
      fetchUserData();
    } else {
      setIsLoading(false);
    }
  }, [connected, publicKey, checkTokenBalance, fetchUserData]);

  useEffect(() => {
    fetchRewardPoolBalance();
    fetchLeaderboard();
  }, [fetchRewardPoolBalance, fetchLeaderboard]);

  const formatWallet = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;
  const formatNumber = (num: number) => num.toLocaleString();

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#fb57ff', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 pt-16 lg:pt-6">
      <div className="max-w-4xl mx-auto space-y-4">
        
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs" style={{ background: 'rgba(251, 87, 255, 0.15)', color: '#fb57ff' }}>
            <span>🐋</span>
            <span className="font-semibold tracking-wide">EXCLUSIVE ACCESS</span>
          </div>
          <h1 className="text-3xl font-bold" style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Whale Club
          </h1>
          <p className="text-gray-500 text-sm">
            Hold 10M+ SPT to unlock exclusive rewards
          </p>
        </div>

        {/* Reward Pool */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Reward Pool</p>
            <p className="text-2xl font-bold font-mono" style={{ color: '#fb57ff' }}>{rewardPoolBalance.toFixed(4)} SOL</p>
          </div>
          <div className="text-3xl">💰</div>
        </div>

        {/* Not Connected */}
        {!connected && (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 text-center space-y-4">
            <Wallet className="w-12 h-12 mx-auto text-gray-500" />
            <div>
              <h2 className="text-xl font-semibold mb-1">Connect Wallet</h2>
              <p className="text-gray-500 text-sm">Verify your SPT holdings to access Whale Club</p>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 max-w-xs mx-auto">
              <p className="text-xs text-gray-500">MINIMUM REQUIRED</p>
              <p className="text-lg font-mono" style={{ color: '#fb57ff' }}>{formatNumber(MIN_HOLDING)} SPT</p>
            </div>
            <WalletMultiButton />
          </div>
        )}

        {/* Not Qualified */}
        {connected && !isQualified && (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-2xl">🚫</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-1">Insufficient Holdings</h2>
              <p className="text-gray-500 text-sm">You need at least {formatNumber(MIN_HOLDING)} SPT</p>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 max-w-xs mx-auto">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Required</span>
                <span style={{ color: '#fb57ff' }}>{formatNumber(MIN_HOLDING)} SPT</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Your Balance</span>
                <span className="text-red-400">{formatNumber(tokenBalance)} SPT</span>
              </div>
            </div>
            <WalletMultiButton />
          </div>
        )}

        {/* Qualified - Dashboard */}
        {connected && isQualified && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Twitter Connection */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 md:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Twitter className="w-4 h-4" style={{ color: '#1da1f2' }} />
                  <span className="font-semibold text-sm">Twitter</span>
                </div>
                {twitterConnected && (
                  <button
                    onClick={syncTwitterActivity}
                    disabled={syncing}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-all disabled:opacity-50"
                    style={{ background: 'rgba(29, 161, 242, 0.15)', color: '#1da1f2' }}
                  >
                    <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync'}
                  </button>
                )}
              </div>
              
              {twitterConnected && userData ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1da1f2, #0d8ecf)' }}>
                    🐦
                  </div>
                  <div>
                    <p className="font-semibold">@{userData.twitterHandle}</p>
                    <p className="text-xs text-gray-500">
                      Last synced: {userData.lastChecked ? new Date(userData.lastChecked).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={connectTwitter}
                  className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #1da1f2, #0d8ecf)' }}
                >
                  <Twitter className="w-4 h-4" />
                  Connect Twitter
                </button>
              )}
            </div>

            {/* Points */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4" style={{ color: '#fb57ff' }} />
                <span className="font-semibold text-sm">Your Points</span>
              </div>
              <p className="text-3xl font-bold font-mono mb-3" style={{ color: '#fb57ff' }}>
                {formatNumber(userData?.points || 0)}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/[0.02] rounded-lg p-2">
                  <p className="font-semibold">{userData?.totalLikes || 0}</p>
                  <p className="text-[10px] text-gray-500">Likes</p>
                </div>
                <div className="bg-white/[0.02] rounded-lg p-2">
                  <p className="font-semibold">{userData?.totalRetweets || 0}</p>
                  <p className="text-[10px] text-gray-500">Retweets</p>
                </div>
                <div className="bg-white/[0.02] rounded-lg p-2">
                  <p className="font-semibold">{userData?.totalQuotes || 0}</p>
                  <p className="text-[10px] text-gray-500">Quotes</p>
                </div>
              </div>
            </div>

            {/* Holdings */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span>💎</span>
                <span className="font-semibold text-sm">Holdings</span>
              </div>
              <p className="text-3xl font-bold font-mono text-green-400 mb-3">
                {formatNumber(tokenBalance)}
              </p>
              <p className="text-xs text-gray-500 mb-2">SPT Tokens</p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                <span>✓</span>
                <span>Whale Status Active</span>
              </div>
            </div>

            {/* Scoring */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 md:col-span-2">
              <p className="text-xs font-semibold mb-2" style={{ color: '#fb57ff' }}>HOW POINTS WORK</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Like</span>
                  <span className="font-mono" style={{ color: '#fb57ff' }}>+1 pt</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Retweet</span>
                  <span className="font-mono" style={{ color: '#fb57ff' }}>+3 pts</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Quote</span>
                  <span className="font-mono" style={{ color: '#fb57ff' }}>+5 pts</span>
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4" style={{ color: '#fb57ff' }} />
                <span className="font-semibold text-sm">Leaderboard</span>
              </div>
              
              {leaderboard.length > 0 ? (
                <div className="space-y-2">
                  {leaderboard.slice(0, 5).map((entry, index) => (
                    <div 
                      key={entry.wallet}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        entry.wallet === publicKey?.toString() 
                          ? 'border' 
                          : 'bg-white/[0.02]'
                      }`}
                      style={entry.wallet === publicKey?.toString() ? { borderColor: 'rgba(251, 87, 255, 0.3)', background: 'rgba(251, 87, 255, 0.05)' } : {}}
                    >
                      <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500 text-black' :
                        index === 1 ? 'bg-gray-400 text-black' :
                        index === 2 ? 'bg-amber-700 text-white' :
                        'bg-white/[0.05] text-gray-400'
                      }`}>
                        {entry.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">@{entry.twitterHandle || 'Anonymous'}</p>
                        <p className="text-[10px] text-gray-500 font-mono">{formatWallet(entry.wallet)}</p>
                      </div>
                      <p className="font-mono text-sm" style={{ color: '#fb57ff' }}>{formatNumber(entry.points)} pts</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 text-sm py-4">No participants yet. Be the first!</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhaleClub;