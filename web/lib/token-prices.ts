// lib/token-prices.ts
// Utility to fetch token prices and calculate USD volumes for leaderboard tracking

interface TokenPrice {
  usd: number;
  lastUpdated: number;
}

// Cache prices for 30 seconds to avoid excessive API calls
const priceCache = new Map<string, TokenPrice>();
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Get USD price for a token
 * Uses DexScreener API for real-time prices
 * USDT/USDC are always $1
 */
export async function getTokenPriceUSD(tokenAddress: string): Promise<number> {
  // Handle stablecoins - always $1
  const STABLECOINS = [
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX',  // USDH
  ];

  if (STABLECOINS.includes(tokenAddress)) {
    return 1.0;
  }

  // Check cache first
  const cached = priceCache.get(tokenAddress);
  if (cached && Date.now() - cached.lastUpdated < CACHE_DURATION) {
    return cached.usd;
  }

  try {
    // Fetch from DexScreener
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      { 
        next: { revalidate: 30 } // Cache for 30 seconds
      }
    );

    if (!response.ok) {
      console.warn(`Failed to fetch price for ${tokenAddress}`);
      return 0;
    }

    const data = await response.json();
    
    // Get the most liquid pair (highest volume)
    if (data.pairs && data.pairs.length > 0) {
      const mainPair = data.pairs.reduce((best: any, current: any) => {
        const currentVolume = parseFloat(current.volume?.h24 || '0');
        const bestVolume = parseFloat(best.volume?.h24 || '0');
        return currentVolume > bestVolume ? current : best;
      }, data.pairs[0]);

      const price = parseFloat(mainPair.priceUsd || '0');
      
      // Cache the result
      priceCache.set(tokenAddress, {
        usd: price,
        lastUpdated: Date.now(),
      });

      return price;
    }

    return 0;
  } catch (error) {
    console.error(`Error fetching price for ${tokenAddress}:`, error);
    return 0;
  }
}

/**
 * Calculate USD volume for a swap
 * Tries both input and output tokens, uses the one with a known price
 */
export async function calculateSwapVolumeUSD(
  fromToken: string,
  fromAmount: number,
  toToken: string,
  toAmount: number
): Promise<{ volumeUsd: number; priceUsd: number; pricedToken: string }> {
  try {
    // Try to get price of input token first
    const fromPrice = await getTokenPriceUSD(fromToken);
    
    if (fromPrice > 0) {
      const volumeUsd = fromAmount * fromPrice;
      return {
        volumeUsd,
        priceUsd: fromPrice,
        pricedToken: fromToken,
      };
    }

    // If input token price not available, try output token
    const toPrice = await getTokenPriceUSD(toToken);
    
    if (toPrice > 0) {
      const volumeUsd = toAmount * toPrice;
      return {
        volumeUsd,
        priceUsd: toPrice,
        pricedToken: toToken,
      };
    }

    // No price found for either token
    console.warn(`No price found for swap: ${fromToken} -> ${toToken}`);
    return {
      volumeUsd: 0,
      priceUsd: 0,
      pricedToken: 'none',
    };
  } catch (error) {
    console.error('Error calculating swap volume USD:', error);
    return {
      volumeUsd: 0,
      priceUsd: 0,
      pricedToken: 'error',
    };
  }
}

/**
 * Get multiple token prices in parallel
 */
export async function getMultipleTokenPrices(
  tokenAddresses: string[]
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  
  // Fetch all prices in parallel
  const pricePromises = tokenAddresses.map(async (address) => {
    const price = await getTokenPriceUSD(address);
    return { address, price };
  });

  const results = await Promise.all(pricePromises);
  
  results.forEach(({ address, price }) => {
    prices.set(address, price);
  });

  return prices;
}

/**
 * Format USD value for display
 */
export function formatUSD(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01) return '<$0.01';
  if (value < 1) return `$${value.toFixed(3)}`;
  if (value < 1000) return `$${value.toFixed(2)}`;
  if (value < 1000000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${(value / 1000000).toFixed(2)}M`;
}