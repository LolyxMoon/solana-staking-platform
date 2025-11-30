import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

// Cache to prevent duplicate requests
interface CacheEntry {
  value: number;
  timestamp: number;
}

const balanceCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 30000; // Increased to 30 seconds cache

// VERY aggressive rate limiter
class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private minDelay = 1000; // 1 SECOND between requests
  private requestCount = 0;
  private resetTime = Date.now();

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.process();
      }
    });
  }

  private async process() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const now = Date.now();
      
      // Reset counter every minute
      if (now - this.resetTime > 60000) {
        this.requestCount = 0;
        this.resetTime = now;
      }
      
      // Limit to 30 requests per minute (very conservative)
      if (this.requestCount >= 30) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.minDelay) {
        await new Promise(resolve => 
          setTimeout(resolve, this.minDelay - timeSinceLastRequest)
        );
      }
      
      const fn = this.queue.shift();
      if (fn) {
        this.lastRequestTime = Date.now();
        this.requestCount++;
        await fn();
      }
    }
    
    this.processing = false;
  }
}

const rateLimiter = new RateLimiter();

// Hook for fetching SPL token balance with caching
export function useSolanaBalance(mintAddress?: string | null) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!publicKey || !mintAddress) {
      setBalance(0);
      setLoading(false);
      return;
    }

    let mounted = true;

    async function fetchBalance() {
      if (!mounted) return;
      
      const cacheKey = `${publicKey.toString()}-${mintAddress}`;
      
      // Check cache first
      const cached = balanceCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setBalance(cached.value);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      
      try {
        await rateLimiter.add(async () => {
          if (!mounted) return;
          
          try {
            // ✅ CHECK IF NATIVE SOL
            const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";
            
            if (mintAddress === NATIVE_SOL_MINT) {
              // ✅ For Native SOL, get lamport balance directly
              const solBalance = await connection.getBalance(publicKey);
              const balanceValue = solBalance / 1e9; // Convert lamports to SOL
              
              if (mounted) {
                setBalance(balanceValue);
                balanceCache.set(cacheKey, {
                  value: balanceValue,
                  timestamp: Date.now()
                });
              }
              return;
            }
            
            // ✅ For SPL tokens, use token account lookup
            const mint = new PublicKey(mintAddress);
            
            // Validate mint address exists
            const mintInfo = await connection.getAccountInfo(mint);
            if (!mintInfo) {
              console.warn(`Mint address ${mintAddress} does not exist`);
              if (mounted) {
                setBalance(0);
                balanceCache.set(cacheKey, {
                  value: 0,
                  timestamp: Date.now()
                });
              }
              return;
            }
            
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
              publicKey,
              { mint }
            );

            let balanceValue = 0;
            if (tokenAccounts.value.length > 0) {
              balanceValue = 
                tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
            }
            
            if (mounted) {
              setBalance(balanceValue);
              // Cache the result
              balanceCache.set(cacheKey, {
                value: balanceValue,
                timestamp: Date.now()
              });
            }
          } catch (error) {
            console.warn(`Token balance fetch failed for ${mintAddress}:`, error.message || error);
            if (mounted) {
              setBalance(0);
              // Cache zero balance to avoid repeated failed requests
              balanceCache.set(cacheKey, {
                value: 0,
                timestamp: Date.now()
              });
            }
          } finally {
            if (mounted) {
              setLoading(false);
            }
          }
        });
      } catch (error) {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchBalance();

    return () => {
      mounted = false;
    };
  }, [connection, publicKey, mintAddress]);

  return { balance, loading };
}

// Hook for fetching native SOL balance with caching
export function useSolBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!publicKey) {
      setBalance(0);
      setLoading(false);
      return;
    }

    let mounted = true;

    async function fetchSolBalance() {
      if (!mounted) return;
      
      const cacheKey = `sol-${publicKey.toString()}`;
      
      // Check cache first
      const cached = balanceCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setBalance(cached.value);
        setLoading(false);
        return;
      }
      
      setLoading(true);

      try {
        await rateLimiter.add(async () => {
          if (!mounted) return;
          
          try {
            const solBalance = await connection.getBalance(publicKey);
            const balanceValue = solBalance / 1e9;
            
            if (mounted) {
              setBalance(balanceValue);
              // Cache the result
              balanceCache.set(cacheKey, {
                value: balanceValue,
                timestamp: Date.now()
              });
            }
          } catch (error) {
            console.error("Error fetching SOL balance:", error);
            if (mounted) {
              setBalance(0);
            }
          } finally {
            if (mounted) {
              setLoading(false);
            }
          }
        });
      } catch (error) {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchSolBalance();

    return () => {
      mounted = false;
    };
  }, [connection, publicKey]);

  return { balance, loading };
}