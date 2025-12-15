"use client";
import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

interface TokenBalance {
  mint: string;
  balance: number;
  decimals: number;
}

interface PoolCache {
  decimals: number;
  price?: number;
  priceChange24h?: number;
}

interface UserData {
  solBalance: number;
  tokenBalances: Map<string, TokenBalance>;
  lastUpdated: number;
}

interface PoolDataContextType {
  // Token data (cached globally)
  getDecimals: (mint: string) => number;
  getPrice: (mint: string) => { price: number | null; change: number | null };
  
  // User data
  getUserTokenBalance: (mint: string) => number;
  getSolBalance: () => number;
  
  // Batch loading
  loadPoolsData: (mints: string[]) => Promise<void>;
  loadUserData: () => Promise<void>;
  
  // Status
  isLoading: boolean;
  isUserDataLoading: boolean;
}

const PoolDataContext = createContext<PoolDataContextType | undefined>(undefined);

// Global caches (persist across renders)
const decimalsCache = new Map<string, number>();
const priceCache = new Map<string, { price: number | null; change: number | null; timestamp: number }>();
const PRICE_CACHE_DURATION = 120000; // 2 minutes

export function PoolDataProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isUserDataLoading, setIsUserDataLoading] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  
  const connectionRef = useRef(connection);
  connectionRef.current = connection;
  
  const loadedMintsRef = useRef<Set<string>>(new Set());

  // Batch load decimals for all mints
  const loadPoolsData = useCallback(async (mints: string[]) => {
    const uniqueMints = [...new Set(mints)].filter(m => m && !decimalsCache.has(m));
    
    if (uniqueMints.length === 0) return;
    
    setIsLoading(true);
    
    try {
      const conn = connectionRef.current;
      const mintPubkeys = uniqueMints.map(m => new PublicKey(m));
      
      // ✅ BATCH CALL: Fetch all mint accounts in ONE call
      const accounts = await conn.getMultipleAccountsInfo(mintPubkeys);
      
      accounts.forEach((account, idx) => {
        const mint = uniqueMints[idx];
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
        loadedMintsRef.current.add(mint);
      });
      
      console.log(`✅ Batch loaded decimals for ${uniqueMints.length} mints in 1 RPC call`);
      
      // Batch fetch prices from DexScreener
      await batchFetchPrices(uniqueMints);
      
    } catch (error) {
      console.error('Batch load error:', error);
      // Fallback: set default decimals
      uniqueMints.forEach(mint => {
        if (!decimalsCache.has(mint)) {
          decimalsCache.set(mint, 9);
        }
      });
    } finally {
      setIsLoading(false);
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
  };

  // Load all user token balances in ONE call
  const loadUserData = useCallback(async () => {
    if (!publicKey || !connected) {
      setUserData(null);
      return;
    }
    
    setIsUserDataLoading(true);
    
    try {
      const conn = connectionRef.current;
      
      // ✅ SINGLE CALL: Get SOL balance
      const solBalance = await conn.getBalance(publicKey);
      
      // ✅ SINGLE CALL: Get ALL token accounts for user
      const tokenAccounts = await conn.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );
      
      const tokenBalances = new Map<string, TokenBalance>();
      
      tokenAccounts.value.forEach(account => {
        const parsed = account.account.data.parsed?.info;
        if (parsed) {
          const mint = parsed.mint;
          const balance = parsed.tokenAmount?.uiAmount || 0;
          const decimals = parsed.tokenAmount?.decimals || 9;
          
          tokenBalances.set(mint, { mint, balance, decimals });
          
          // Also update decimals cache
          if (!decimalsCache.has(mint)) {
            decimalsCache.set(mint, decimals);
          }
        }
      });
      
      setUserData({
        solBalance: solBalance / LAMPORTS_PER_SOL,
        tokenBalances,
        lastUpdated: Date.now()
      });
      
      console.log(`✅ Loaded user data: ${tokenBalances.size} token accounts in 2 RPC calls`);
      
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
      
      // Refresh every 2 minutes
      const interval = setInterval(loadUserData, 120000);
      return () => clearInterval(interval);
    } else {
      setUserData(null);
    }
  }, [connected, publicKey, loadUserData]);

  // Getters
  const getDecimals = useCallback((mint: string): number => {
    return decimalsCache.get(mint) || 9;
  }, []);

  const getPrice = useCallback((mint: string): { price: number | null; change: number | null } => {
    const cached = priceCache.get(mint);
    return cached ? { price: cached.price, change: cached.change } : { price: null, change: null };
  }, []);

  const getUserTokenBalance = useCallback((mint: string): number => {
    if (!userData) return 0;
    return userData.tokenBalances.get(mint)?.balance || 0;
  }, [userData]);

  const getSolBalance = useCallback((): number => {
    return userData?.solBalance || 0;
  }, [userData]);

  return (
    <PoolDataContext.Provider value={{
      getDecimals,
      getPrice,
      getUserTokenBalance,
      getSolBalance,
      loadPoolsData,
      loadUserData,
      isLoading,
      isUserDataLoading,
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