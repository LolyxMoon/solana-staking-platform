import React, { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

// Constants
const SPT_MINT = new PublicKey('6uUU2z5GBasaxnkcqiQVHa2SXL68mAXDsq1zYN5Qxrm7');
const MIN_HOLDING = 10_000_000;
const SPT_DECIMALS = 9; // Adjust if different
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
  tokenBalance: number;
}

const WhaleClub: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  
  // State
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [isQualified, setIsQualified] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rewardPoolBalance, setRewardPoolBalance] = useState<number>(0);
  const [twitterConnected, setTwitterConnected] = useState<boolean>(false);
  const [pointsBreakdown, setPointsBreakdown] = useState({
    likes: 0,
    retweets: 0,
    quotes: 0,
  });

  // Check token balance
  const checkTokenBalance = useCallback(async () => {
    if (!publicKey || !connection) return;
    
    try {
      const ata = await getAssociatedTokenAddress(SPT_MINT, publicKey);
      const account = await getAccount(connection, ata);
      const balance = Number(account.amount) / Math.pow(10, SPT_DECIMALS);
      setTokenBalance(balance);
      setIsQualified(balance >= MIN_HOLDING);
    } catch (error) {
      console.log('No token account found or error:', error);
      setTokenBalance(0);
      setIsQualified(false);
    }
    setIsLoading(false);
  }, [publicKey, connection]);

  // Fetch reward pool balance
  const fetchRewardPoolBalance = useCallback(async () => {
    if (!connection) return;
    
    try {
      const solBalance = await connection.getBalance(REWARD_WALLET);
      setRewardPoolBalance(solBalance / 1e9);
    } catch (error) {
      console.error('Error fetching reward pool:', error);
    }
  }, [connection]);

  // Fetch user data from backend
  const fetchUserData = useCallback(async () => {
  if (!publicKey) return;
  
  try {
    const response = await fetch(`/api/whale-club/user/${publicKey.toString()}`);
    if (response.ok) {
      const data = await response.json();
      // Map API fields to component fields
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
      setPointsBreakdown({
        likes: data.likesCount * 1,
        retweets: data.retweetsCount * 3,
        quotes: data.quotesCount * 5,
      });
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
  }
}, [publicKey]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
  try {
    const response = await fetch('/api/whale-club/leaderboard');
    if (response.ok) {
      const data = await response.json();
      // Map API fields and add rank
      const mappedLeaderboard = data.map((entry: any, index: number) => ({
        rank: index + 1,
        wallet: entry.walletAddress,
        twitterHandle: entry.twitterUsername,
        points: entry.totalPoints,
        tokenBalance: 0,
      }));
      setLeaderboard(mappedLeaderboard);
    }
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
  }
}, []);

  // Twitter OAuth initiation
  const connectTwitter = async () => {
    if (!publicKey) return;
    sessionStorage.setItem('whale_club_wallet', publicKey.toString());
    window.location.href = `/api/twitter/auth?wallet=${publicKey.toString()}`;
  };

  // Manual sync trigger
  const syncTwitterActivity = async () => {
    if (!publicKey) return;
    
    try {
      const response = await fetch('/api/whale-club/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey.toString() }),
      });
      
      if (response.ok) {
        await fetchUserData();
      }
    } catch (error) {
      console.error('Error syncing Twitter activity:', error);
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

  const formatWallet = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <div className="whale-club">
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        
        .whale-club {
          min-height: 100vh;
          background: linear-gradient(135deg, #000000 0%, #0a0a0f 50%, #050508 100%);
          color: #e4e4e7;
          font-family: 'Inter', sans-serif;
          position: relative;
          overflow-x: hidden;
        }
        
        .whale-club::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(ellipse at 20% 20%, rgba(251, 87, 255, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(251, 87, 255, 0.05) 0%, transparent 50%);
          pointer-events: none;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem;
          padding-top: 4rem;
          position: relative;
          z-index: 1;
        }
        
        @media (min-width: 640px) {
          .container {
            padding: 1.5rem;
            padding-top: 1.5rem;
          }
        }
        
        @media (min-width: 1024px) {
          .container {
            padding: 2rem;
          }
        }
        
        /* Header */
        .header {
          text-align: center;
          padding: 2rem 0;
          border-bottom: 1px solid rgba(251, 87, 255, 0.15);
          margin-bottom: 2rem;
        }
        
        .club-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(251, 87, 255, 0.1);
          border: 1px solid rgba(251, 87, 255, 0.2);
          padding: 0.5rem 1.25rem;
          border-radius: 50px;
          margin-bottom: 1.5rem;
        }
        
        .club-badge span {
          font-size: 1.5rem;
        }
        
        .club-badge p {
          font-family: 'Space Mono', monospace;
          font-size: 0.75rem;
          color: #fb57ff;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }
        
        .title {
          font-size: 2.5rem;
          font-weight: 800;
          background: linear-gradient(45deg, #ffffff 0%, #fb57ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 1rem;
          letter-spacing: -0.02em;
        }
        
        @media (min-width: 640px) {
          .title {
            font-size: 3rem;
          }
        }
        
        .subtitle {
          font-size: 1rem;
          color: #71717a;
          max-width: 500px;
          margin: 0 auto;
          line-height: 1.6;
        }
        
        /* Reward Pool Banner */
        .reward-pool {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(251, 87, 255, 0.15);
          border-radius: 16px;
          padding: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          transition: border-color 0.3s ease;
        }
        
        .reward-pool:hover {
          border-color: rgba(251, 87, 255, 0.3);
        }
        
        .reward-pool-label {
          font-size: 0.75rem;
          color: #a1a1aa;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        
        .reward-pool-value {
          font-family: 'Space Mono', monospace;
          font-size: 1.75rem;
          font-weight: 700;
          color: #fb57ff;
        }
        
        @media (min-width: 640px) {
          .reward-pool-value {
            font-size: 2rem;
          }
        }
        
        .reward-pool-subtext {
          font-size: 0.75rem;
          color: #71717a;
          margin-top: 0.25rem;
        }
        
        /* Gate Screen */
        .gate-screen {
          text-align: center;
          padding: 3rem 1rem;
        }
        
        .gate-icon {
          font-size: 4rem;
          margin-bottom: 1.5rem;
          opacity: 0.8;
        }
        
        .gate-title {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 1rem;
          background: linear-gradient(45deg, #ffffff 0%, #fb57ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .gate-text {
          color: #71717a;
          max-width: 400px;
          margin: 0 auto 2rem;
          line-height: 1.6;
        }
        
        .requirement-box {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 1.5rem;
          max-width: 350px;
          margin: 0 auto 2rem;
        }
        
        .requirement-label {
          font-size: 0.75rem;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 0.5rem;
        }
        
        .requirement-value {
          font-family: 'Space Mono', monospace;
          font-size: 1.5rem;
          color: #fb57ff;
        }
        
        .balance-display {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .balance-label {
          font-size: 0.75rem;
          color: #71717a;
          margin-bottom: 0.25rem;
        }
        
        .balance-value {
          font-family: 'Space Mono', monospace;
          font-size: 1.125rem;
        }
        
        .balance-value.qualified {
          color: #22c55e;
        }
        
        .balance-value.not-qualified {
          color: #ef4444;
        }
        
        /* Dashboard Grid */
        .dashboard {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }
        
        @media (min-width: 768px) {
          .dashboard {
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
          }
        }
        
        .card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 1.25rem;
          transition: border-color 0.3s ease;
        }
        
        @media (min-width: 640px) {
          .card {
            padding: 1.5rem;
          }
        }
        
        .card:hover {
          border-color: rgba(251, 87, 255, 0.3);
        }
        
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
        }
        
        .card-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #e4e4e7;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .card-icon {
          font-size: 1.25rem;
        }
        
        /* Twitter Connection Card */
        .twitter-card {
          grid-column: span 1;
        }
        
        @media (min-width: 768px) {
          .twitter-card {
            grid-column: span 2;
          }
        }
        
        .twitter-status {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          margin-bottom: 1rem;
        }
        
        @media (min-width: 640px) {
          .twitter-status {
            flex-direction: row;
            align-items: center;
          }
        }
        
        .twitter-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1da1f2 0%, #0d8ecf 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
        }
        
        .twitter-info {
          flex: 1;
        }
        
        .twitter-info h4 {
          font-weight: 600;
          margin-bottom: 0.25rem;
        }
        
        .twitter-info p {
          font-size: 0.875rem;
          color: #71717a;
        }
        
        .connect-twitter-btn {
          width: 100%;
          padding: 1rem;
          min-height: 44px;
          background: linear-gradient(135deg, #1da1f2 0%, #0d8ecf 100%);
          border: none;
          border-radius: 12px;
          color: white;
          font-family: 'Inter', sans-serif;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .connect-twitter-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(29, 161, 242, 0.3);
        }
        
        .sync-btn {
          padding: 0.5rem 1rem;
          min-height: 44px;
          background: rgba(29, 161, 242, 0.15);
          border: 1px solid rgba(29, 161, 242, 0.3);
          border-radius: 8px;
          color: #1da1f2;
          font-family: 'Inter', sans-serif;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
        }
        
        .sync-btn:hover {
          background: rgba(29, 161, 242, 0.25);
        }
        
        /* Points Card */
        .points-display {
          text-align: center;
          padding: 1rem 0;
        }
        
        .points-value {
          font-family: 'Space Mono', monospace;
          font-size: 2.5rem;
          font-weight: 700;
          color: #fb57ff;
          margin-bottom: 0.5rem;
        }
        
        @media (min-width: 640px) {
          .points-value {
            font-size: 3rem;
          }
        }
        
        .points-label {
          font-size: 0.875rem;
          color: #71717a;
        }
        
        .points-breakdown {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .breakdown-item {
          text-align: center;
        }
        
        .breakdown-value {
          font-family: 'Space Mono', monospace;
          font-size: 1.125rem;
          font-weight: 600;
          color: #e4e4e7;
        }
        
        .breakdown-label {
          font-size: 0.7rem;
          color: #71717a;
          margin-top: 0.25rem;
        }
        
        /* Scoring Info */
        .scoring-info {
          background: rgba(251, 87, 255, 0.05);
          border: 1px solid rgba(251, 87, 255, 0.1);
          border-radius: 12px;
          padding: 1rem;
          margin-top: 1rem;
        }
        
        .scoring-title {
          font-size: 0.7rem;
          color: #fb57ff;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 0.75rem;
        }
        
        .scoring-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .scoring-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
        }
        
        .scoring-action {
          color: #a1a1aa;
        }
        
        .scoring-points {
          font-family: 'Space Mono', monospace;
          color: #fb57ff;
        }
        
        /* Leaderboard */
        .leaderboard-card {
          grid-column: span 1;
        }
        
        @media (min-width: 768px) {
          .leaderboard-card {
            grid-column: span 2;
          }
        }
        
        .leaderboard-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .leaderboard-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          border: 1px solid transparent;
          transition: all 0.2s ease;
        }
        
        @media (min-width: 640px) {
          .leaderboard-item {
            gap: 1rem;
            padding: 1rem;
          }
        }
        
        .leaderboard-item:hover {
          background: rgba(255, 255, 255, 0.04);
        }
        
        .leaderboard-item.top-3 {
          border-color: rgba(251, 87, 255, 0.2);
        }
        
        .leaderboard-item.current-user {
          border-color: rgba(251, 87, 255, 0.4);
          background: rgba(251, 87, 255, 0.05);
        }
        
        .rank {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Space Mono', monospace;
          font-weight: 700;
          font-size: 0.875rem;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          flex-shrink: 0;
        }
        
        .rank.gold {
          background: linear-gradient(135deg, #ffd700 0%, #ffb142 100%);
          color: #0a0a0f;
        }
        
        .rank.silver {
          background: linear-gradient(135deg, #c0c0c0 0%, #a8a8a8 100%);
          color: #0a0a0f;
        }
        
        .rank.bronze {
          background: linear-gradient(135deg, #cd7f32 0%, #b87333 100%);
          color: #0a0a0f;
        }
        
        .leaderboard-user {
          flex: 1;
          min-width: 0;
        }
        
        .leaderboard-handle {
          font-weight: 600;
          margin-bottom: 0.125rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .leaderboard-wallet {
          font-family: 'Space Mono', monospace;
          font-size: 0.7rem;
          color: #71717a;
        }
        
        .leaderboard-points {
          font-family: 'Space Mono', monospace;
          font-size: 1rem;
          color: #fb57ff;
          white-space: nowrap;
        }
        
        @media (min-width: 640px) {
          .leaderboard-points {
            font-size: 1.125rem;
          }
        }
        
        /* Holdings Display */
        .holdings-card .holdings-value {
          font-family: 'Space Mono', monospace;
          font-size: 1.75rem;
          color: #22c55e;
          margin-bottom: 0.5rem;
        }
        
        @media (min-width: 640px) {
          .holdings-card .holdings-value {
            font-size: 2rem;
          }
        }
        
        .holdings-label {
          font-size: 0.875rem;
          color: #71717a;
        }
        
        .holdings-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;
          padding: 0.75rem;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.2);
          border-radius: 8px;
          font-size: 0.875rem;
          color: #22c55e;
        }
        
        /* Wallet Button Override */
        .wallet-section {
          display: flex;
          justify-content: center;
        }
        
        .wallet-section :global(.wallet-adapter-button) {
          background: linear-gradient(45deg, #000000, #fb57ff) !important;
          border-radius: 12px !important;
          font-family: 'Inter', sans-serif !important;
          font-weight: 600 !important;
          padding: 0.875rem 2rem !important;
          min-height: 44px !important;
          transition: transform 0.2s, box-shadow 0.2s !important;
        }
        
        .wallet-section :global(.wallet-adapter-button:hover) {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 24px rgba(251, 87, 255, 0.3) !important;
        }
        
        /* Loading */
        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4rem;
        }
        
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(251, 87, 255, 0.2);
          border-top-color: #fb57ff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="container">
        {/* Header */}
        <header className="header">
          <div className="club-badge">
            <span>🐋</span>
            <p>Exclusive Access</p>
          </div>
          <h1 className="title">Whale Club</h1>
          <p className="subtitle">
            Hold 10M+ SPT tokens to unlock exclusive rewards and earn points through social engagement
          </p>
        </header>

        {/* Reward Pool Banner */}
        <div className="reward-pool">
          <div>
            <p className="reward-pool-label">Total Reward Pool</p>
            <p className="reward-pool-value">{rewardPoolBalance.toFixed(4)} SOL</p>
            <p className="reward-pool-subtext">Distributed proportionally based on points</p>
          </div>
          <span style={{ fontSize: '3rem' }}>💰</span>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="loading">
            <div className="spinner" />
          </div>
        )}

        {/* Not Connected */}
        {!isLoading && !connected && (
          <div className="gate-screen">
            <div className="gate-icon">🔒</div>
            <h2 className="gate-title">Connect Your Wallet</h2>
            <p className="gate-text">
              Connect your Solana wallet to verify your SPT holdings and access the Whale Club
            </p>
            <div className="requirement-box">
              <p className="requirement-label">Minimum Required</p>
              <p className="requirement-value">{formatNumber(MIN_HOLDING)} SPT</p>
            </div>
            <div className="wallet-section">
              <WalletMultiButton />
            </div>
          </div>
        )}

        {/* Connected but Not Qualified */}
        {!isLoading && connected && !isQualified && (
          <div className="gate-screen">
            <div className="gate-icon">🚫</div>
            <h2 className="gate-title">Insufficient Holdings</h2>
            <p className="gate-text">
              You need to hold at least {formatNumber(MIN_HOLDING)} SPT tokens to access the Whale Club
            </p>
            <div className="requirement-box">
              <p className="requirement-label">Minimum Required</p>
              <p className="requirement-value">{formatNumber(MIN_HOLDING)} SPT</p>
              <div className="balance-display">
                <p className="balance-label">Your Balance</p>
                <p className="balance-value not-qualified">
                  {formatNumber(tokenBalance)} SPT
                </p>
              </div>
            </div>
            <div className="wallet-section">
              <WalletMultiButton />
            </div>
          </div>
        )}

        {/* Qualified - Show Dashboard */}
        {!isLoading && connected && isQualified && (
          <div className="dashboard">
            {/* Twitter Connection */}
            <div className="card twitter-card">
              <div className="card-header">
                <h3 className="card-title">Twitter Connection</h3>
                <span className="card-icon">🐦</span>
              </div>
              
              {twitterConnected && userData ? (
                <>
                  <div className="twitter-status">
                    <div className="twitter-avatar">🐦</div>
                    <div className="twitter-info">
                      <h4>@{userData.twitterHandle}</h4>
                      <p>Connected • Last synced {userData.lastChecked ? new Date(userData.lastChecked).toLocaleDateString() : 'Never'}</p>
                    </div>
                    <button className="sync-btn" onClick={syncTwitterActivity}>
                      Sync Now
                    </button>
                  </div>
                  <div className="scoring-info">
                    <p className="scoring-title">How Points Work</p>
                    <div className="scoring-list">
                      <div className="scoring-item">
                        <span className="scoring-action">Like a @StakePoint tweet</span>
                        <span className="scoring-points">+1 pt</span>
                      </div>
                      <div className="scoring-item">
                        <span className="scoring-action">Retweet @StakePoint</span>
                        <span className="scoring-points">+3 pts</span>
                      </div>
                      <div className="scoring-item">
                        <span className="scoring-action">Quote tweet @StakePoint</span>
                        <span className="scoring-points">+5 pts</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ color: '#71717a', marginBottom: '1rem' }}>
                    Connect your Twitter account to start earning points for engaging with StakePoint tweets
                  </p>
                  <button className="connect-twitter-btn" onClick={connectTwitter}>
                    <span>🐦</span>
                    Connect Twitter
                  </button>
                </>
              )}
            </div>

            {/* Points Display */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Your Points</h3>
                <span className="card-icon">⭐</span>
              </div>
              <div className="points-display">
                <p className="points-value">{formatNumber(userData?.points || 0)}</p>
                <p className="points-label">Total Points Earned</p>
                <div className="points-breakdown">
                  <div className="breakdown-item">
                    <p className="breakdown-value">{userData?.totalLikes || 0}</p>
                    <p className="breakdown-label">Likes</p>
                  </div>
                  <div className="breakdown-item">
                    <p className="breakdown-value">{userData?.totalRetweets || 0}</p>
                    <p className="breakdown-label">Retweets</p>
                  </div>
                  <div className="breakdown-item">
                    <p className="breakdown-value">{userData?.totalQuotes || 0}</p>
                    <p className="breakdown-label">Quotes</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Holdings Display */}
            <div className="card holdings-card">
              <div className="card-header">
                <h3 className="card-title">Your Holdings</h3>
                <span className="card-icon">💎</span>
              </div>
              <p className="holdings-value">{formatNumber(tokenBalance)}</p>
              <p className="holdings-label">SPT Tokens</p>
              <div className="holdings-status">
                <span>✓</span>
                Whale Status Active
              </div>
            </div>

            {/* Leaderboard */}
            <div className="card leaderboard-card">
              <div className="card-header">
                <h3 className="card-title">Leaderboard</h3>
                <span className="card-icon">🏆</span>
              </div>
              <div className="leaderboard-list">
                {leaderboard.length > 0 ? (
                  leaderboard.map((entry, index) => (
                    <div 
                      key={entry.wallet}
                      className={`leaderboard-item ${index < 3 ? 'top-3' : ''} ${entry.wallet === publicKey?.toString() ? 'current-user' : ''}`}
                    >
                      <div className={`rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}`}>
                        {entry.rank}
                      </div>
                      <div className="leaderboard-user">
                        <p className="leaderboard-handle">@{entry.twitterHandle || 'Anonymous'}</p>
                        <p className="leaderboard-wallet">{formatWallet(entry.wallet)}</p>
                      </div>
                      <p className="leaderboard-points">{formatNumber(entry.points)} pts</p>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#71717a', textAlign: 'center', padding: '2rem' }}>
                    No participants yet. Be the first!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhaleClub;
