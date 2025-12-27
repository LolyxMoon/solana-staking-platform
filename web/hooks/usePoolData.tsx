"use client";
import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL, AccountInfo } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { getPDAs, getReadOnlyProgram } from "@/lib/anchor-program";

interface TokenBalance {
  mint: string;
  balance: number;
  decimals: number;
}

interface UserData {
  solBalance: number;
  tokenBalances: Map<string, TokenBalance>;
  lastUpdated: number;
}

interface PoolInfo {
  tokenMint: string;
  poolId: number;
}

interface PoolDataContextType {
  // Token data (cached globally)
  getDecimals: (mint: string) => number;
  getPrice: (mint: string) => { price: number | null; change: number | null };
  
  // User data
  getUserTokenBalance: (mint: string) => number;
  getSolBalance: () => number;
  
  // Pool data
  getPoolProject: (tokenMint: string, poolId: number) => any | null;
  getUserStake: (tokenMint: string, poolId: number) => any | null;
  
  // Batch loading
  loadPoolsData: (mints: string[]) => Promise<void>;
  loadAllPoolData: (pools: PoolInfo[]) => Promise<void>;
  loadUserData: () => Promise<void>;
  
  // Status
  isLoading: boolean;
  isUserDataLoading: boolean;
  isPoolDataLoading: boolean;
}

const PoolDataContext = createContext<PoolDataContextType | undefined>(undefined);

// Global caches (persist across renders)
const decimalsCache = new Map<string, number>();
const priceCache = new Map<string, { price: number | null; change: number | null; timestamp: number }>();
const projectCache = new Map<string, any>();
const stakeCache = new Map<string, any>();
const PRICE_CACHE_DURATION = 120000; // 2 minutes

export function PoolDataProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isUserDataLoading, setIsUserDataLoading] = useState(false);
  const [isPoolDataLoading, setIsPoolDataLoading] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [poolsLoaded, setPoolsLoaded] = useState(false);
  const [priceVersion, setPriceVersion] = useState(0);
  
  const connectionRef = useRef(connection);
  connectionRef.current = connection;
  
  const publicKeyRef = useRef(publicKey);
  publicKeyRef.current = publicKey;

  // Track loaded pools for re-fetching user stakes
  const loadedPoolsRef = useRef<PoolInfo[]>([]);

  // Batch load decimals for all mints
  const loadPoolsData = useCallback(async (mints: string[]) => {
    const allMints = [...new Set(mints)].filter(m => m);
    const mintsNeedingDecimals = allMints.filter(m => !decimalsCache.has(m));
    
    setIsLoading(true);
    
    try {
      // Fetch decimals for mints that need them
      if (mintsNeedingDecimals.length > 0) {
        const conn = connectionRef.current;
        const mintPubkeys = mintsNeedingDecimals.map(m => new PublicKey(m));
        
        // ✅ BATCH CALL: Fetch all mint accounts in ONE call
        const accounts = await conn.getMultipleAccountsInfo(mintPubkeys);
        
        accounts.forEach((account, idx) => {
          const mint = mintsNeedingDecimals[idx];
          if (account) {
            try {
              // Parse mint account data - decimals at byte 44
              const decimals = account.data[44] || 9;
              decimalsCache.set(mint, decimals);
            } catch {
              decimalsCache.set(mint, 9);
            }
          } else {
            decimalsCache.set(mint, 9);
          }
        });
        
        console.log(`✅ Batch loaded decimals for ${mintsNeedingDecimals.length} mints in 1 RPC call`);
      }
      
      // ✅ ALWAYS fetch prices for ALL mints (price cache has its own expiry)
      if (allMints.length > 0) {
        await batchFetchPrices(allMints);
      }
      
    } catch (error) {
      console.error('Batch load error:', error);
      mintsNeedingDecimals.forEach(mint => {
        if (!decimalsCache.has(mint)) {
          decimalsCache.set(mint, 9);
        }
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ✅ NEW: Batch load ALL pool projects and user stakes in 2 RPC calls
  const loadAllPoolData = useCallback(async (pools: PoolInfo[]) => {
    if (pools.length === 0) return;
    
    setIsPoolDataLoading(true);
    
    try {
      const conn = connectionRef.current;
      const program = getReadOnlyProgram(conn);
      
      // Calculate all PDAs
      const projectPDAs: PublicKey[] = [];
      const userStakePDAs: PublicKey[] = [];
      const poolKeys: string[] = [];
      
      for (const pool of pools) {
        const mint = new PublicKey(pool.tokenMint);
        const [projectPDA] = getPDAs.project(mint, pool.poolId);
        projectPDAs.push(projectPDA);
        poolKeys.push(`${pool.tokenMint}-${pool.poolId}`);
      }
      
      // ✅ BATCH CALL 1: Fetch ALL project accounts
      console.log(`🔄 Fetching ${projectPDAs.length} project accounts...`);
      const projectAccounts = await conn.getMultipleAccountsInfo(projectPDAs);
      
      // Decode project accounts
      projectAccounts.forEach((account, idx) => {
        const key = poolKeys[idx];
        if (account) {
          try {
            const decoded = program.coder.accounts.decode('project', account.data);
            projectCache.set(key, {
              ...decoded,
              address: projectPDAs[idx],
            });
          } catch (e) {
            console.warn(`Failed to decode project ${key}:`, e);
          }
        }
      });
      
      console.log(`✅ Batch loaded ${projectAccounts.filter(Boolean).length} projects in 1 RPC call`);
      
      // ✅ BATCH CALL 2: Fetch ALL user stake accounts (if wallet connected)
      if (publicKeyRef.current) {
        const userStakePDAsForUser: PublicKey[] = [];
        
        for (let i = 0; i < pools.length; i++) {
          const [userStakePDA] = getPDAs.userStake(projectPDAs[i], publicKeyRef.current);
          userStakePDAsForUser.push(userStakePDA);
        }
        
        console.log(`🔄 Fetching ${userStakePDAsForUser.length} user stake accounts...`);
        const stakeAccounts = await conn.getMultipleAccountsInfo(userStakePDAsForUser);
        
        stakeAccounts.forEach((account, idx) => {
          const key = poolKeys[idx];
          if (account) {
            try {
              const decoded = program.coder.accounts.decode('stake', account.data);
              stakeCache.set(key, decoded);
            } catch (e) {
              // User hasn't staked in this pool
            }
          }
        });
        
        console.log(`✅ Batch loaded ${stakeAccounts.filter(Boolean).length} user stakes in 1 RPC call`);
      }
      
      setPoolsLoaded(true);
      loadedPoolsRef.current = pools;
      
    } catch (error) {
      console.error('Batch pool data load error:', error);
    } finally {
      setIsPoolDataLoading(false);
    }
  }, []);

  // Batch fetch prices from DexScreener
  const batchFetchPrices = async (mints: string[]) => {
    const now = Date.now();
    const mintsNeedingPrice = mints.filter(m => {
      const cached = priceCache.get(m);
      return !cached || (now - cached.timestamp > PRICE_CACHE_DURATION);
    });
    
    if (mintsNeedingPrice.length === 0) return;
    
    // DexScreener allows comma-separated addresses (up to ~30)
    const chunks = [];
    for (let i = 0; i < mintsNeedingPrice.length; i += 30) {
      chunks.push(mintsNeedingPrice.slice(i, i + 30));
    }
    
    for (const chunk of chunks) {
      try {
        const addresses = chunk.join(',');
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses}`, {
          cache: 'no-store'
        });
        
        if (res.ok) {
          const data = await res.json();
          const pairs = data?.pairs || [];
          
          // Group pairs by base token
          const pairsByToken = new Map<string, any[]>();
          pairs.forEach((pair: any) => {
            const token = pair.baseToken?.address;
            if (token) {
              if (!pairsByToken.has(token)) {
                pairsByToken.set(token, []);
              }
              pairsByToken.get(token)!.push(pair);
            }
          });
          
          // Get best pair for each token
          chunk.forEach(mint => {
            const tokenPairs = pairsByToken.get(mint) || [];
            const bestPair = tokenPairs.sort(
              (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
            )[0];
            
            priceCache.set(mint, {
              price: bestPair ? parseFloat(bestPair.priceUsd) || null : null,
              change: bestPair ? parseFloat(bestPair.priceChange?.h24 || 0) : null,
              timestamp: now
            });
          });
        }
      } catch (error) {
        console.error('Price fetch error:', error);
      }
    }
    
    console.log(`✅ Batch fetched prices for ${mintsNeedingPrice.length} tokens`);
    setPriceVersion(v => v + 1);
  };

  // Load all user token balances
  const loadUserData = useCallback(async () => {
    if (!publicKey || !connected) {
      setUserData(null);
      return;
    }
    
    setIsUserDataLoading(true);
    
    try {
      const conn = connectionRef.current;
      
      // Get SOL balance
      const solBalance = await conn.getBalance(publicKey);
      
      const tokenBalances = new Map<string, TokenBalance>();
      
      // Fetch standard SPL tokens
      const tokenAccounts = await conn.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );
      
      tokenAccounts.value.forEach(account => {
        const parsed = account.account.data.parsed?.info;
        if (parsed) {
          const mint = parsed.mint;
          const balance = parsed.tokenAmount?.uiAmount || 0;
          const decimals = parsed.tokenAmount?.decimals || 9;
          
          tokenBalances.set(mint, { mint, balance, decimals });
          
          if (!decimalsCache.has(mint)) {
            decimalsCache.set(mint, decimals);
          }
        }
      });
      
      // ✅ ALSO fetch Token-2022 tokens (like SPT)
      try {
        const token2022Accounts = await conn.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: TOKEN_2022_PROGRAM_ID }
        );
        
        token2022Accounts.value.forEach(account => {
          const parsed = account.account.data.parsed?.info;
          if (parsed) {
            const mint = parsed.mint;
            const balance = parsed.tokenAmount?.uiAmount || 0;
            const decimals = parsed.tokenAmount?.decimals || 9;
            
            tokenBalances.set(mint, { mint, balance, decimals });
            
            if (!decimalsCache.has(mint)) {
              decimalsCache.set(mint, decimals);
            }
          }
        });
      } catch (e) {
        console.warn('Token-2022 fetch failed:', e);
      }
      
      setUserData({
        solBalance: solBalance / LAMPORTS_PER_SOL,
        tokenBalances,
        lastUpdated: Date.now()
      });
      
      console.log(`✅ Loaded user data: ${tokenBalances.size} token accounts in 3 RPC calls`);
      
    } catch (error) {
      console.error('User data load error:', error);
    } finally {
      setIsUserDataLoading(false);
    }
  }, [publicKey, connected]);

  // Auto-load user data when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      loadUserData();
      
      // Re-fetch user stakes if pools were already loaded
      if (loadedPoolsRef.current.length > 0) {
        console.log('🔄 Wallet connected - refetching user stakes...');
        loadAllPoolData(loadedPoolsRef.current);
      }
      
      // Refresh every 2 minutes
      const interval = setInterval(loadUserData, 120000);
      return () => clearInterval(interval);
    } else {
      setUserData(null);
      // Clear user-specific caches
      stakeCache.clear();
    }
  }, [connected, publicKey, loadUserData, loadAllPoolData]);

  // Getters
  const getDecimals = useCallback((mint: string): number => {
    return decimalsCache.get(mint) || 9;
  }, []);

  const getPrice = useCallback((mint: string): { price: number | null; change: number | null } => {
    const cached = priceCache.get(mint);
    return cached ? { price: cached.price, change: cached.change } : { price: null, change: null };
  }, [priceVersion]);

  const getUserTokenBalance = useCallback((mint: string): number => {
    if (!userData) return 0;
    return userData.tokenBalances.get(mint)?.balance || 0;
  }, [userData]);

  const getSolBalance = useCallback((): number => {
    return userData?.solBalance || 0;
  }, [userData]);

  // Get cached pool project data
  const getPoolProject = useCallback((tokenMint: string, poolId: number): any | null => {
    const key = `${tokenMint}-${poolId}`;
    return projectCache.get(key) || null;
  }, []);

  // Get cached user stake data
  const getUserStake = useCallback((tokenMint: string, poolId: number): any | null => {
    const key = `${tokenMint}-${poolId}`;
    return stakeCache.get(key) || null;
  }, []);

  return (
    <PoolDataContext.Provider value={{
      getDecimals,
      getPrice,
      getUserTokenBalance,
      getSolBalance,
      getPoolProject,
      getUserStake,
      loadPoolsData,
      loadAllPoolData,
      loadUserData,
      isLoading,
      isUserDataLoading,
      isPoolDataLoading,
    }}>
      {children}
    </PoolDataContext.Provider>
  );
}

export function usePoolData() {
  const context = useContext(PoolDataContext);
  if (!context) {
    throw new Error('usePoolData must be used within PoolDataProvider');
  }
  return context;
}