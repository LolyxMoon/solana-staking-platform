"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { RefreshCw, Trophy, Twitter, Wallet, Star, MessageCircle, Send, Edit2, Check, X, Lock } from 'lucide-react';
import bs58 from 'bs58';

const SPT_MINT = new PublicKey('6uUU2z5GBasaxnkcqiQVHa2SXL68mAXDsq1zYN5Qxrm7');
const MIN_HOLDING = 10_000_000;
const SPT_DECIMALS = 9;
const REWARD_WALLET = new PublicKey('JutoRW8bYVaPpZQXUYouEUaMN24u6PxzLryCLuJZsL9');

interface UserData {
  wallet: string;
  twitterHandle: string | null;
  twitterId: string | null;
  nickname: string | null;
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
  nickname: string | null;
  points: number;
}

interface ChatMessage {
  id: string;
  wallet_address: string;
  nickname: string | null;
  message: string;
  created_at: string;
}

type TabType = 'dashboard' | 'chat';

const WhaleClub: React.FC = () => {
  const { publicKey, connected, signMessage } = useWallet();
  const { connection } = useConnection();
  
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [isQualified, setIsQualified] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rewardPoolBalance, setRewardPoolBalance] = useState<number>(0);
  const [twitterConnected, setTwitterConnected] = useState<boolean>(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // Nickname
  const [nickname, setNickname] = useState<string>('');
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameError, setNicknameError] = useState('');
  
  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Chat Auth
  const [chatSession, setChatSession] = useState<{ token: string; expiresAt: string } | null>(null);
  const [authenticating, setAuthenticating] = useState(false);

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
    } catch {
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
        setUserData({
          wallet: data.walletAddress,
          twitterHandle: data.twitterUsername,
          twitterId: data.twitterId,
          nickname: data.nickname,
          points: data.totalPoints,
          totalLikes: data.likesCount,
          totalRetweets: data.retweetsCount,
          totalQuotes: data.quotesCount,
          lastChecked: data.lastSyncedAt,
          joinedAt: data.createdAt,
        });
        setNickname(data.nickname || '');
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
        setLeaderboard(data.map((entry: any, index: number) => ({
          rank: index + 1,
          wallet: entry.walletAddress,
          twitterHandle: entry.twitterUsername,
          nickname: entry.nickname,
          points: entry.totalPoints,
        })));
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  }, []);

  const connectTwitter = () => {
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

  const saveNickname = async () => {
    if (!publicKey) return;
    setNicknameSaving(true);
    setNicknameError('');
    try {
      const response = await fetch('/api/whale-club/nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey.toString(), nickname: nicknameInput }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNicknameError(data.error || 'Failed to save');
        return;
      }
      setNickname(data.nickname || '');
      setEditingNickname(false);
      await fetchLeaderboard();
    } catch {
      setNicknameError('Failed to save nickname');
    } finally {
      setNicknameSaving(false);
    }
  };

  // ========== CHAT AUTH ==========
  const authenticateChat = async () => {
    if (!publicKey || !connection) return null;
    setAuthenticating(true);
    try {
        const timestamp = Date.now();
        
        // Create a simple transaction (0 SOL to self)
        const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: publicKey,
            lamports: 0,
        })
        );
        
        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        // Get wallet to sign (works with Ledger!)
        const wallet = (window as any).solana || (window as any).solflare;
        if (!wallet) throw new Error('No wallet found');
        
        const signedTransaction = await wallet.signTransaction(transaction);
        const serialized = signedTransaction.serialize().toString('base64');

        // Send to backend for verification
        const response = await fetch('/api/whale-club/verify-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            wallet: publicKey.toString(),
            signedTransaction: serialized,
            timestamp,
        }),
        });

        if (!response.ok) {
        throw new Error('Verification failed');
        }

        const data = await response.json();
        const session = { token: data.sessionToken, expiresAt: data.expiresAt };
        setChatSession(session);
        return session;
    } catch (error) {
        console.error('Failed to authenticate:', error);
        return null;
    } finally {
        setAuthenticating(false);
    }
    };

  // ========== CHAT FUNCTIONS ==========
  const fetchMessages = async () => {
    if (!publicKey || !chatSession) return;
    setLoadingMessages(true);
    try {
        const params = new URLSearchParams({
        wallet: publicKey.toString(),
        session: chatSession.token,
        limit: '50'
        });
        const response = await fetch(`/api/whale-club/chat?${params}`);
        if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        } else if (response.status === 401) {
        setChatSession(null);
        }
    } catch (error) {
        console.error('Error fetching messages:', error);
    } finally {
        setLoadingMessages(false);
    }
    };

    const sendMessage = async () => {
    if (!publicKey || !newMessage.trim() || sendingMessage || !chatSession) return;
    setSendingMessage(true);
    try {
        const response = await fetch('/api/whale-club/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            wallet: publicKey.toString(),
            nickname: nickname || null,
            message: newMessage.trim(),
            sessionToken: chatSession.token,
        }),
        });
        if (response.ok) {
        setNewMessage('');
        await fetchMessages();
        } else if (response.status === 401) {
        setChatSession(null);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    } finally {
        setSendingMessage(false);
    }
    };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  useEffect(() => {
    if (activeTab === 'chat' && isQualified && chatSession) {
        fetchMessages();
    }
    }, [activeTab, isQualified, chatSession]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const formatWallet = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;
  const formatNumber = (num: number) => num.toLocaleString();
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const getDisplayName = (wallet: string, nick: string | null, twitter?: string | null) => {
    if (nick) return nick;
    if (twitter) return `@${twitter}`;
    return formatWallet(wallet);
  };

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
          <p className="text-gray-500 text-sm">Hold 10M+ SPT to unlock exclusive rewards</p>
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

        {/* Qualified */}
        {connected && isQualified && (
          <>
            {/* Tabs */}
            <div className="flex gap-2 bg-white/[0.02] border border-white/[0.05] rounded-xl p-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'dashboard' ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
                style={activeTab === 'dashboard' ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}
              >
                <Trophy className="w-4 h-4" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'chat' ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
                style={activeTab === 'chat' ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}
              >
                <MessageCircle className="w-4 h-4" />
                Whale Chat
                <Lock className="w-3 h-3" />
              </button>
            </div>

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nickname & Twitter */}
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 md:col-span-2">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Edit2 className="w-4 h-4" style={{ color: '#fb57ff' }} />
                        <span className="font-semibold text-sm">Nickname</span>
                      </div>
                      {editingNickname ? (
                        <div className="flex items-center gap-2">
                          <input type="text" value={nicknameInput} onChange={(e) => setNicknameInput(e.target.value)} placeholder="Enter nickname..." maxLength={20} className="flex-1 px-3 py-2 bg-white/[0.05] border border-white/[0.1] rounded-lg text-sm focus:outline-none" />
                          <button onClick={saveNickname} disabled={nicknameSaving} className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50"><Check className="w-4 h-4" /></button>
                          <button onClick={() => { setEditingNickname(false); setNicknameError(''); }} className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-300">{nickname || 'Not set'}</span>
                          <button onClick={() => { setEditingNickname(true); setNicknameInput(nickname); }} className="text-xs px-2 py-1 rounded-lg hover:bg-white/[0.05]" style={{ color: '#fb57ff' }}>Edit</button>
                        </div>
                      )}
                      {nicknameError && <p className="text-xs text-red-400 mt-1">{nicknameError}</p>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Twitter className="w-4 h-4" style={{ color: '#1da1f2' }} />
                          <span className="font-semibold text-sm">Twitter</span>
                        </div>
                        {twitterConnected && (
                          <button onClick={syncTwitterActivity} disabled={syncing} className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-all disabled:opacity-50" style={{ background: 'rgba(29, 161, 242, 0.15)', color: '#1da1f2' }}>
                            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />Sync
                          </button>
                        )}
                      </div>
                      {twitterConnected && userData ? (
                        <span className="text-gray-300">@{userData.twitterHandle}</span>
                      ) : (
                        <button onClick={connectTwitter} className="px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #1da1f2, #0d8ecf)' }}>
                          <Twitter className="w-4 h-4" />Connect
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Points */}
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-4 h-4" style={{ color: '#fb57ff' }} />
                    <span className="font-semibold text-sm">Your Points</span>
                  </div>
                  <p className="text-3xl font-bold font-mono mb-3" style={{ color: '#fb57ff' }}>{formatNumber(userData?.points || 0)}</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/[0.02] rounded-lg p-2"><p className="font-semibold">{userData?.totalLikes || 0}</p><p className="text-[10px] text-gray-500">Likes</p></div>
                    <div className="bg-white/[0.02] rounded-lg p-2"><p className="font-semibold">{userData?.totalRetweets || 0}</p><p className="text-[10px] text-gray-500">Retweets</p></div>
                    <div className="bg-white/[0.02] rounded-lg p-2"><p className="font-semibold">{userData?.totalQuotes || 0}</p><p className="text-[10px] text-gray-500">Quotes</p></div>
                  </div>
                </div>

                {/* Holdings */}
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3"><span>💎</span><span className="font-semibold text-sm">Holdings</span></div>
                  <p className="text-3xl font-bold font-mono text-green-400 mb-3">{formatNumber(tokenBalance)}</p>
                  <p className="text-xs text-gray-500 mb-2">SPT Tokens</p>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}><span>✓</span><span>Whale Status Active</span></div>
                </div>

                {/* Scoring */}
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 md:col-span-2">
                  <p className="text-xs font-semibold mb-2" style={{ color: '#fb57ff' }}>HOW POINTS WORK</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2"><span className="text-gray-400">Like</span><span className="font-mono" style={{ color: '#fb57ff' }}>+1 pt</span></div>
                    <div className="flex items-center gap-2"><span className="text-gray-400">Retweet</span><span className="font-mono" style={{ color: '#fb57ff' }}>+3 pts</span></div>
                    <div className="flex items-center gap-2"><span className="text-gray-400">Quote</span><span className="font-mono" style={{ color: '#fb57ff' }}>+5 pts</span></div>
                  </div>
                </div>

                {/* Leaderboard */}
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 md:col-span-2">
                  <div className="flex items-center gap-2 mb-3"><Trophy className="w-4 h-4" style={{ color: '#fb57ff' }} /><span className="font-semibold text-sm">Leaderboard</span></div>
                  {leaderboard.length > 0 ? (
                    <div className="space-y-2">
                      {leaderboard.slice(0, 5).map((entry, index) => (
                        <div key={entry.wallet} className={`flex items-center gap-3 p-2 rounded-lg ${entry.wallet === publicKey?.toString() ? 'border' : 'bg-white/[0.02]'}`} style={entry.wallet === publicKey?.toString() ? { borderColor: 'rgba(251, 87, 255, 0.3)', background: 'rgba(251, 87, 255, 0.05)' } : {}}>
                          <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-500 text-black' : index === 1 ? 'bg-gray-400 text-black' : index === 2 ? 'bg-amber-700 text-white' : 'bg-white/[0.05] text-gray-400'}`}>{entry.rank}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{getDisplayName(entry.wallet, entry.nickname, entry.twitterHandle)}</p>
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

            {/* Chat Tab */}
            {activeTab === 'chat' && (
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden" style={{ height: '500px' }}>
                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" style={{ color: '#fb57ff' }} />
                    <span className="font-semibold text-sm">Whale Chat</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">🔒 Encrypted</span>
                  </div>
                  <span className="text-xs text-gray-500">{messages.length} messages</span>
                </div>

                {!chatSession ? (
                  <div className="h-[420px] flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(251, 87, 255, 0.1)' }}>🔐</div>
                    <h3 className="font-semibold mb-2">Encrypted Chat</h3>
                    <p className="text-sm text-gray-500 mb-4">Sign a transaction to verify your wallet (no SOL sent)</p>
                    <button onClick={authenticateChat} disabled={authenticating} className="px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all disabled:opacity-50" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
                      {authenticating ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Verifying...</>) : (<>🔓 Unlock Chat</>)}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="h-[380px] overflow-y-auto p-4 space-y-3">
                      {loadingMessages ? (
                        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#fb57ff', borderTopColor: 'transparent' }} /></div>
                      ) : messages.length === 0 ? (
                        <div className="text-center text-gray-500 py-8"><MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No messages yet. Start the conversation!</p></div>
                      ) : (
                        messages.map((msg) => {
                          const isOwn = msg.wallet_address === publicKey?.toString();
                          return (
                            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              <div className="max-w-[75%]">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium" style={{ color: isOwn ? '#fb57ff' : '#9ca3af' }}>{getDisplayName(msg.wallet_address, msg.nickname)}</span>
                                  <span className="text-[10px] text-gray-600">{formatTime(msg.created_at)}</span>
                                </div>
                                <div className={`px-3 py-2 rounded-xl text-sm ${isOwn ? 'rounded-br-sm' : 'bg-white/[0.05] rounded-bl-sm'}`} style={isOwn ? { background: 'linear-gradient(45deg, #1a1a2e, #fb57ff33)' } : {}}>{msg.message}</div>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    <div className="px-4 py-3 border-t border-white/[0.05]">
                      <div className="flex items-center gap-2">
                        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()} placeholder="Type a message..." maxLength={500} className="flex-1 px-4 py-2 bg-white/[0.05] border border-white/[0.05] rounded-xl text-sm focus:outline-none" style={{ borderColor: 'rgba(251, 87, 255, 0.2)' }} />
                        <button onClick={sendMessage} disabled={!newMessage.trim() || sendingMessage} className="p-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}><Send className="w-5 h-5" /></button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WhaleClub;