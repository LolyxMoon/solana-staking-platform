'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import { 
  RefreshCw, 
  Wallet, 
  AlertCircle, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Coins,
  Plus,
  TrendingUp,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Users
} from 'lucide-react';
import { useAdminProgram } from '@/hooks/useAdminProgram';
import { useStakingProgram } from '@/hooks/useStakingProgram';
import { useToast } from '@/components/ToastContainer';
import { useSound } from '@/hooks/useSound';

interface Pool {
  id: string;
  poolId?: number;
  name: string;
  symbol: string;
  logo?: string;
  type: string;
  mintAddress?: string;
  tokenMint?: string;
  apr?: string;
  apy?: number | string;
  lockPeriod?: number | string;
  isInitialized?: boolean;
  isPaused?: boolean;
  poolAddress?: string;
  transferTaxBps?: number;
  referralEnabled?: boolean;
  referralWallet?: string;
  referralSplitPercent?: number;
  // On-chain data
  onChainAdmin?: string;
  totalStaked?: string;
  rewardVaultBalance?: number;
}

interface ExpandedPool {
  pool: Pool;
  vaultInfo: any;
  projectInfo: any;
}

export default function MyPoolsPage() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { showSuccess, showError, showInfo } = useToast();
  const { playSound } = useSound();
  const {
    depositRewards,
    getProjectInfo,
    getVaultInfo,
    setProjectReferrer,
  } = useAdminProgram();

  const { getPoolRate } = useStakingProgram();

  const [myPools, setMyPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<Record<string, ExpandedPool>>({});
  
  // Deposit modal state
  const [depositModal, setDepositModal] = useState<{
    isOpen: boolean;
    pool: Pool | null;
  }>({ isOpen: false, pool: null });
  const [depositAmount, setDepositAmount] = useState<number>(1000);
  const [isDepositing, setIsDepositing] = useState(false);
  const [userTokenBalance, setUserTokenBalance] = useState<string | null>(null);

  // Referral modal state
  const [referralModal, setReferralModal] = useState<{
    isOpen: boolean;
    pool: Pool | null;
  }>({ isOpen: false, pool: null });
  const [referralEnabled, setReferralEnabled] = useState(false);
  const [referralWallet, setReferralWallet] = useState('');
  const [referralSplit, setReferralSplit] = useState(50);
  const [isUpdatingReferral, setIsUpdatingReferral] = useState(false);

  // Fetch pools where connected wallet is admin
  const fetchMyPools = useCallback(async () => {
    if (!publicKey) {
      setMyPools([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch all pools from API
      const response = await fetch('/api/pools');
      if (!response.ok) throw new Error('Failed to fetch pools');
      
      const allPools: Pool[] = await response.json();
      
      // Check each pool's on-chain admin
      const poolsWithAdmin: Pool[] = [];
      
      for (const pool of allPools) {
        const tokenMint = pool.tokenMint || pool.mintAddress;
        if (!tokenMint) continue;
        
        try {
          const projectInfo = await getProjectInfo(tokenMint, pool.poolId ?? 0);
          const onChainAdmin = projectInfo.admin?.toString();

          // Check if connected wallet is the admin
          if (onChainAdmin === publicKey.toString()) {
            // Get rate like PoolCard does
            let onChainApy = pool.apy || 0;
            try {
              const rateResult = await getPoolRate(tokenMint, pool.poolId ?? 0);
              if (rateResult?.rate !== undefined) {
                onChainApy = rateResult.rate;
              }
            } catch (e) {
              // Use database fallback
            }

            poolsWithAdmin.push({
              ...pool,
              onChainAdmin,
              totalStaked: projectInfo.totalStaked?.toString() || '0',
              apy: onChainApy,
              // Get referrer info from on-chain data
              referralWallet: projectInfo.referrer?.toString() || pool.referralWallet,
              referralSplitPercent: projectInfo.referrerSplitBps 
                ? Number(projectInfo.referrerSplitBps) / 100 
                : pool.referralSplitPercent,
              referralEnabled: !!projectInfo.referrer || pool.referralEnabled,
            });
          }
        } catch (err) {
          // Pool might not be initialized yet, skip
          console.log(`Skipping pool ${pool.name}: not initialized or error`);
        }
      }
      
      setMyPools(poolsWithAdmin);
      
      if (poolsWithAdmin.length === 0) {
        showInfo('No pools found where you are the admin');
      }
    } catch (error: any) {
      console.error('Error fetching pools:', error);
      showError(`Failed to fetch pools: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchMyPools();
  }, [fetchMyPools]);

  // Load expanded pool data
  const loadPoolDetails = async (pool: Pool) => {
    const tokenMint = pool.tokenMint || pool.mintAddress;
    if (!tokenMint) return;

    try {
      const [projectInfo, vaultInfo] = await Promise.all([
        getProjectInfo(tokenMint, pool.poolId ?? 0),
        getVaultInfo(tokenMint, pool.poolId ?? 0),
      ]);

      setExpandedData(prev => ({
        ...prev,
        [pool.id]: { pool, vaultInfo, projectInfo }
      }));
    } catch (error: any) {
      console.error('Error loading pool details:', error);
      showError(`Failed to load details: ${error.message}`);
    }
  };

  const toggleExpand = (poolId: string, pool: Pool) => {
    if (expandedPoolId === poolId) {
      setExpandedPoolId(null);
    } else {
      setExpandedPoolId(poolId);
      if (!expandedData[poolId]) {
        loadPoolDetails(pool);
      }
    }
  };

  // Check user's token balance for deposit
  const checkTokenBalance = async (tokenMint: string) => {
    if (!publicKey) return;
    
    try {
      const tokenMintPubkey = new PublicKey(tokenMint);
      
      // Use getParsedTokenAccountsByOwner with mint filter - works for both SPL and Token-2022
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { mint: tokenMintPubkey }
      );
      
      if (tokenAccounts.value.length > 0) {
        const parsed = tokenAccounts.value[0].account.data.parsed.info;
        const balance = parsed.tokenAmount.uiAmount || 0;
        setUserTokenBalance(balance.toLocaleString(undefined, { maximumFractionDigits: 4 }));
      } else {
        setUserTokenBalance('0');
      }
    } catch (error) {
      console.error('Error checking balance:', error);
      setUserTokenBalance('0');
    }
  };

  // Open deposit modal
  const openDepositModal = (pool: Pool) => {
    const tokenMint = pool.tokenMint || pool.mintAddress;
    if (tokenMint) {
      checkTokenBalance(tokenMint);
    }
    setDepositModal({ isOpen: true, pool });
    setDepositAmount(1000);
  };

  // Open referral modal
  const openReferralModal = (pool: Pool) => {
    setReferralEnabled(pool.referralEnabled || false);
    setReferralWallet(pool.referralWallet || '');
    setReferralSplit(pool.referralSplitPercent || 50);
    setReferralModal({ isOpen: true, pool });
  };

  // Handle deposit rewards
  const handleDepositRewards = async () => {
    const pool = depositModal.pool;
    if (!publicKey || !pool) {
      showError('Wallet not connected or pool not selected');
      return;
    }

    const tokenMint = pool.tokenMint || pool.mintAddress;
    if (!tokenMint) {
      showError('Token mint not found');
      return;
    }

    if (depositAmount <= 0) {
      showError('Please enter a valid amount');
      return;
    }

    setIsDepositing(true);

    try {
      // Get token decimals
      const tokenMintPubkey = new PublicKey(tokenMint);
      const mintInfo = await connection.getParsedAccountInfo(tokenMintPubkey);

      if (!mintInfo.value || !('parsed' in mintInfo.value.data)) {
        throw new Error('Could not fetch token mint info');
      }

      const decimals = mintInfo.value.data.parsed.info.decimals;

      // Handle BigInt properly to avoid overflow with large numbers
      const depositStr = depositAmount.toString();
      const [whole, fraction = ''] = depositStr.split('.');
      const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
      const amountString = whole + paddedFraction;
      const amountInLamports = BigInt(amountString);

      console.log(`💰 Depositing ${depositAmount} tokens (${amountInLamports} raw units)`);

      showInfo('📝 Sending transaction...');

      const txSignature = await depositRewards(tokenMint, pool.poolId ?? 0, amountInLamports.toString());

      playSound('success');
      showSuccess(`✅ Deposited ${depositAmount.toLocaleString()} tokens! TX: ${txSignature.slice(0, 8)}...`);

      // Close modal and refresh
      setDepositModal({ isOpen: false, pool: null });
      setDepositAmount(1000);
      
      // Refresh pool data
      if (expandedPoolId === pool.id) {
        loadPoolDetails(pool);
      }
      fetchMyPools();

    } catch (error: any) {
      console.error('Deposit error:', error);
      playSound('error');

      if (error.message?.includes('insufficient funds')) {
        showError('❌ Insufficient token balance!');
      } else if (error.message?.includes('User rejected')) {
        showError('❌ Transaction cancelled');
      } else {
        showError(`❌ Error: ${error.message}`);
      }
    } finally {
      setIsDepositing(false);
    }
  };

  // Handle update referral
  const handleUpdateReferral = async () => {
    const pool = referralModal.pool;
    if (!publicKey || !pool) {
      showError('Wallet not connected or pool not selected');
      return;
    }

    const tokenMint = pool.tokenMint || pool.mintAddress;
    if (!tokenMint) {
      showError('Token mint not found');
      return;
    }

    if (referralEnabled && !referralWallet) {
      showError('Please enter a referral wallet address');
      return;
    }

    // Validate referral wallet address if enabled
    if (referralEnabled) {
      try {
        new PublicKey(referralWallet);
      } catch {
        showError('Invalid referral wallet address');
        return;
      }
    }

    setIsUpdatingReferral(true);

    try {
      showInfo('📝 Sending transaction...');

      if (referralEnabled) {
        await setProjectReferrer(tokenMint, pool.poolId ?? 0, referralWallet, referralSplit * 100);
      } else {
        await setProjectReferrer(tokenMint, pool.poolId ?? 0, null, 0);
      }

      // Update database
      await fetch(`/api/admin/pools`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          id: pool.id,
          referralEnabled,
          referralWallet: referralEnabled ? referralWallet : null,
          referralSplitPercent: referralEnabled ? referralSplit : null
        }),
      });

      playSound('success');
      showSuccess('✅ Referral settings updated!');

      // Close modal and refresh
      setReferralModal({ isOpen: false, pool: null });
      fetchMyPools();

    } catch (error: any) {
      console.error('Update referral error:', error);
      playSound('error');

      if (error.message?.includes('User rejected')) {
        showError('❌ Transaction cancelled');
      } else {
        showError(`❌ Failed: ${error.message}`);
      }
    } finally {
      setIsUpdatingReferral(false);
    }
  };

  // Format large numbers
  const formatNumber = (value: string | number | undefined): string => {
    if (!value) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toLocaleString();
  };

  if (!publicKey) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-20">
            <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-500" />
            <h1 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h1>
            <p className="text-gray-400">
              Connect your wallet to view and manage pools you've created
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">My Pools</h1>
            <p className="text-gray-400 mt-1">
              Manage pools where you are the admin
            </p>
          </div>
          <button
            onClick={fetchMyPools}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
            style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Connected Wallet Info */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5" style={{ color: '#fb57ff' }} />
            <div>
              <p className="text-sm text-gray-400">Connected Wallet</p>
              <p className="font-mono text-sm text-white">
                {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div 
              className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
              style={{ borderColor: '#fb57ff', borderTopColor: 'transparent' }}
            />
            <p className="text-gray-400">Loading your pools...</p>
          </div>
        )}

        {/* No Pools */}
        {!loading && myPools.length === 0 && (
          <div className="text-center py-12 bg-white/[0.02] border border-white/[0.05] rounded-xl">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <h2 className="text-xl font-semibold text-white mb-2">No Pools Found</h2>
            <p className="text-gray-400 mb-4">
              You don't have any pools where you are the on-chain admin.
            </p>
            <p className="text-sm text-gray-500">
              Create a pool to start managing it here.
            </p>
          </div>
        )}

        {/* Pool List */}
        {!loading && myPools.length > 0 && (
          <div className="space-y-4">
            {myPools.map((pool) => (
              <div
                key={pool.id}
                className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden"
              >
                {/* Pool Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => toggleExpand(pool.id, pool)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {pool.logo ? (
                        <img
                          src={pool.logo}
                          alt={pool.symbol}
                          className="w-12 h-12 rounded-full"
                        />
                      ) : (
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(251, 87, 255, 0.2)' }}
                        >
                          <Coins className="w-6 h-6" style={{ color: '#fb57ff' }} />
                        </div>
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-white">{pool.name}</h3>
                        <p className="text-sm text-gray-400">{pool.symbol}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Referral Status */}
                      {pool.referralEnabled && (
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Referral</p>
                          <p className="font-semibold text-green-400">
                            ✅ {pool.referralSplitPercent}%
                          </p>
                        </div>
                      )}

                      {/* Status */}
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Status</p>
                        <p className={`font-semibold ${pool.isPaused ? 'text-yellow-400' : 'text-green-400'}`}>
                          {pool.isPaused ? '⏸️ Paused' : '✅ Active'}
                        </p>
                      </div>

                      {/* APY */}
                      <div className="text-right">
                        <p className="text-sm text-gray-400">APY</p>
                        <p className="font-semibold text-white">
                          {typeof pool.apy === 'number' ? pool.apy.toFixed(2) : pool.apy || '0'}%
                        </p>
                      </div>

                      {/* Expand Icon */}
                      {expandedPoolId === pool.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedPoolId === pool.id && (
                  <div className="border-t border-white/[0.05] p-4 space-y-4">
                    {/* Pool Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white/[0.02] rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-1">Lock Period</p>
                        <p className="font-semibold text-white">
                          {pool.lockPeriod || 0} days
                        </p>
                      </div>
                      <div className="bg-white/[0.02] rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-1">Total Staked</p>
                        <p className="font-semibold text-white">
                          {formatNumber(pool.totalStaked)}
                        </p>
                      </div>
                      <div className="bg-white/[0.02] rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-1">Pool ID</p>
                        <p className="font-semibold text-white">
                          {pool.poolId ?? 0}
                        </p>
                      </div>
                      <div className="bg-white/[0.02] rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-1">Token Mint</p>
                        <p className="font-mono text-xs text-white truncate">
                          {(pool.tokenMint || pool.mintAddress)?.slice(0, 12)}...
                        </p>
                      </div>
                    </div>

                    {/* Referral Info (if enabled) */}
                    {pool.referralEnabled && pool.referralWallet && (
                      <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4" style={{ color: '#fb57ff' }} />
                          <span className="text-sm font-semibold text-white">Referral Settings</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-400">Referral Wallet</p>
                            <p className="font-mono text-xs text-white">
                              {pool.referralWallet.slice(0, 8)}...{pool.referralWallet.slice(-8)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">Fee Split</p>
                            <p className="text-white">{pool.referralSplitPercent}%</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Vault Balances */}
                    {expandedData[pool.id]?.vaultInfo && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Staking Vault */}
                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">Staking Vault</span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              expandedData[pool.id].vaultInfo.stakingVault.exists 
                                ? 'bg-green-900/50 text-green-300' 
                                : 'bg-red-900/50 text-red-300'
                            }`}>
                              {expandedData[pool.id].vaultInfo.stakingVault.exists ? '✓ Active' : '✗ Not Init'}
                            </span>
                          </div>
                          <p className="text-xl font-bold text-white">
                            {formatNumber(expandedData[pool.id].vaultInfo.stakingVault.balance)}
                          </p>
                        </div>

                        {/* Reward Vault */}
                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">Reward Vault</span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              expandedData[pool.id].vaultInfo.rewardVault.exists 
                                ? 'bg-green-900/50 text-green-300' 
                                : 'bg-red-900/50 text-red-300'
                            }`}>
                              {expandedData[pool.id].vaultInfo.rewardVault.exists ? '✓ Active' : '✗ Not Init'}
                            </span>
                          </div>
                          <p className="text-xl font-bold" style={{ color: '#fb57ff' }}>
                            {formatNumber(expandedData[pool.id].vaultInfo.rewardVault.balance)}
                          </p>
                        </div>

                        {/* Reflection Vault */}
                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">Reflection Vault</span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              expandedData[pool.id].vaultInfo.reflectionVault.exists 
                                ? 'bg-green-900/50 text-green-300' 
                                : 'bg-gray-700 text-gray-400'
                            }`}>
                              {expandedData[pool.id].vaultInfo.reflectionVault.tokenMint 
                                ? (expandedData[pool.id].vaultInfo.reflectionVault.exists ? '✓ Active' : '⚠ Config')
                                : 'N/A'}
                            </span>
                          </div>
                          <p className="text-xl font-bold text-white">
                            {expandedData[pool.id].vaultInfo.reflectionVault.tokenMint 
                              ? formatNumber(expandedData[pool.id].vaultInfo.reflectionVault.balance)
                              : '-'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDepositModal(pool);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Rewards
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openReferralModal(pool);
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                        style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                      >
                        <Users className="w-4 h-4" />
                        Referral
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadPoolDetails(pool);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Refresh Data
                      </button>

                      <a
                        href={`https://solscan.io/account/${pool.tokenMint || pool.mintAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View on Solscan
                      </a>
                    </div>

                    {/* Warning if reward vault is empty */}
                    {expandedData[pool.id]?.vaultInfo?.rewardVault?.balance === 0 && (
                      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
                        <p className="text-yellow-300 text-sm">
                          ⚠️ <strong>Reward vault is empty!</strong> Users won't earn rewards until you deposit tokens.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deposit Modal */}
      {depositModal.isOpen && depositModal.pool && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 p-4">
          <div className="bg-[#0a0a0f] border border-white/[0.05] p-6 rounded-xl shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-white">
              💰 Deposit Rewards to {depositModal.pool.name}
            </h2>

            {isDepositing && (
              <div className="mb-4 p-3 bg-white/[0.02] border border-white/[0.05] rounded text-gray-300 text-sm">
                ⏳ Processing transaction... Please check your wallet.
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Amount (tokens)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  disabled={isDepositing}
                  className="w-full p-3 rounded-lg bg-white/[0.02] text-white border border-white/[0.05] focus:border-[#fb57ff] focus:outline-none disabled:opacity-50"
                  placeholder="Enter amount"
                />
              </div>

              {userTokenBalance && (
                <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                  <p className="text-green-300 text-sm">
                    💰 Your balance: <strong>{userTokenBalance}</strong> tokens
                  </p>
                </div>
              )}

              {depositModal.pool.transferTaxBps && depositModal.pool.transferTaxBps > 0 && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-300 text-sm">
                    ⚠️ This token has a {(depositModal.pool.transferTaxBps / 100).toFixed(1)}% transfer tax.
                    Depositing {depositAmount} will result in ~{(depositAmount * (1 - depositModal.pool.transferTaxBps / 10000)).toFixed(4)} tokens in the vault.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDepositRewards}
                disabled={isDepositing || depositAmount <= 0}
                className="flex-1 px-4 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
              >
                {isDepositing ? '⏳ Processing...' : '💰 Deposit'}
              </button>
              <button
                onClick={() => {
                  setDepositModal({ isOpen: false, pool: null });
                  setDepositAmount(1000);
                  setUserTokenBalance(null);
                }}
                disabled={isDepositing}
                className="px-4 py-3 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Referral Modal */}
      {referralModal.isOpen && referralModal.pool && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 p-4">
          <div className="bg-[#0a0a0f] border border-white/[0.05] p-6 rounded-xl shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
              <Users className="w-5 h-5" style={{ color: '#fb57ff' }} />
              Referral Settings - {referralModal.pool.name}
            </h2>

            {isUpdatingReferral && (
              <div className="mb-4 p-3 bg-white/[0.02] border border-white/[0.05] rounded text-gray-300 text-sm">
                ⏳ Processing transaction... Please check your wallet.
              </div>
            )}

            <div className="space-y-4 mb-6">
              {/* Enable/Disable Toggle */}
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/[0.02] rounded-lg border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
                <input
                  type="checkbox"
                  checked={referralEnabled}
                  onChange={(e) => setReferralEnabled(e.target.checked)}
                  disabled={isUpdatingReferral}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <span className="text-white font-medium">Enable Referral Program</span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Split platform fees with a referrer wallet
                  </p>
                </div>
              </label>

              {referralEnabled && (
                <>
                  {/* Referral Wallet */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Referral Wallet Address</label>
                    <input
                      type="text"
                      value={referralWallet}
                      onChange={(e) => setReferralWallet(e.target.value)}
                      disabled={isUpdatingReferral}
                      className="w-full p-3 rounded-lg bg-white/[0.02] text-white border border-white/[0.05] focus:border-[#fb57ff] focus:outline-none disabled:opacity-50 font-mono text-sm"
                      placeholder="Enter Solana wallet address"
                    />
                  </div>

                  {/* Split Percentage */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Fee Split to Referrer: {referralSplit}%
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={referralSplit}
                      onChange={(e) => setReferralSplit(Number(e.target.value))}
                      disabled={isUpdatingReferral}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                      style={{ 
                        background: `linear-gradient(to right, #fb57ff 0%, #fb57ff ${referralSplit}%, rgba(255,255,255,0.1) ${referralSplit}%, rgba(255,255,255,0.1) 100%)` 
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <p className="text-blue-300 text-sm">
                      ℹ️ The referrer will receive <strong>{referralSplit}%</strong> of the platform's SOL fees from this pool. 
                      The remaining <strong>{100 - referralSplit}%</strong> goes to the platform fee collector.
                    </p>
                  </div>
                </>
              )}

              {!referralEnabled && referralModal.pool.referralEnabled && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-300 text-sm">
                    ⚠️ Disabling will remove the current referrer from receiving fee splits.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleUpdateReferral}
                disabled={isUpdatingReferral || (referralEnabled && !referralWallet)}
                className="flex-1 px-4 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
              >
                {isUpdatingReferral ? '⏳ Updating...' : 'Update Referral'}
              </button>
              <button
                onClick={() => {
                  setReferralModal({ isOpen: false, pool: null });
                  setReferralEnabled(false);
                  setReferralWallet('');
                  setReferralSplit(50);
                }}
                disabled={isUpdatingReferral}
                className="px-4 py-3 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}