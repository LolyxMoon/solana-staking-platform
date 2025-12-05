import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Cache for token decimals (in-memory, resets on server restart)
const decimalsCache = new Map<string, number>();

// Cache for token prices (5 minute TTL)
const priceCache = new Map<string, { price: number; timestamp: number }>();
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Known token decimals (hardcoded for reliability)
const KNOWN_DECIMALS: Record<string, number> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6, // USDT
  'So11111111111111111111111111111111111111112': 9,  // SOL
};

// Known stablecoin prices (always $1)
const STABLECOINS: Record<string, number> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1, // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1, // USDT
};

async function getTokenDecimals(connection: Connection, mintAddress: string): Promise<number> {
  // Check known tokens first
  if (KNOWN_DECIMALS[mintAddress] !== undefined) {
    return KNOWN_DECIMALS[mintAddress];
  }

  // Check cache
  if (decimalsCache.has(mintAddress)) {
    return decimalsCache.get(mintAddress)!;
  }

  try {
    const mint = new PublicKey(mintAddress);
    const mintInfo = await getMint(connection, mint);
    const decimals = mintInfo.decimals;
    
    // Cache the result
    decimalsCache.set(mintAddress, decimals);
    console.log(`📊 Token ${mintAddress.substring(0, 8)}... has ${decimals} decimals`);
    
    return decimals;
  } catch (error) {
    console.error(`❌ Failed to fetch decimals for ${mintAddress}:`, error);
    // Default to 9 if we can't fetch
    return 9;
  }
}

async function getTokenPrice(tokenMint: string, pairAddress?: string | null): Promise<number> {
  // Check stablecoins first
  if (STABLECOINS[tokenMint] !== undefined) {
    return STABLECOINS[tokenMint];
  }

  // Check cache
  const cached = priceCache.get(tokenMint);
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
    return cached.price;
  }

  try {
    let price = 0;

    // Try DexScreener with pair address first
    if (pairAddress) {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`, {
        next: { revalidate: 60 }
      });
      const data = await res.json();
      if (data?.pairs?.[0]?.priceUsd) {
        price = parseFloat(data.pairs[0].priceUsd);
      }
    }

    // Fallback: Try DexScreener token search
    if (price === 0) {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`, {
        next: { revalidate: 60 }
      });
      const data = await res.json();
      if (data?.pairs?.length > 0) {
        // Sort by liquidity and get the best price
        const sortedPairs = data.pairs.sort((a: any, b: any) => 
          (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        );
        if (sortedPairs[0]?.priceUsd) {
          price = parseFloat(sortedPairs[0].priceUsd);
        }
      }
    }

    // Cache the result
    priceCache.set(tokenMint, { price, timestamp: Date.now() });
    console.log(`💵 Token ${tokenMint.substring(0, 8)}... price: $${price}`);
    
    return price;
  } catch (error) {
    console.error(`❌ Failed to fetch price for ${tokenMint}:`, error);
    return 0;
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('\n📊 Fetching platform stats...');

    // Get RPC endpoint
    const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_HELIUS_RPC || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');

    // 1. Get all stakes from database (using UserStake model - the correct one!)
    const stakes = await prisma.userStake.findMany();
    console.log(`📊 Found ${stakes.length} stakes in database`);

    if (stakes.length === 0) {
      return NextResponse.json({
        success: true,
        totalStakers: 0,
        totalStakes: 0,
        totalValueLocked: 0,
        tokenBreakdown: [],
      });
    }

    // 2. Count unique stakers
    const uniqueStakers = new Set(stakes.map(s => s.userWallet));
    const totalStakers = uniqueStakers.size;
    console.log(`👥 ${totalStakers} unique stakers`);

    // 3. Group stakes by token mint
    const byToken: Record<string, { stakes: any[], totalRaw: bigint }> = {};
    
    for (const stake of stakes) {
      if (!byToken[stake.tokenMint]) {
        byToken[stake.tokenMint] = {
          stakes: [],
          totalRaw: BigInt(0),
        };
      }
      byToken[stake.tokenMint].stakes.push(stake);
      byToken[stake.tokenMint].totalRaw += stake.stakedAmount; // Already BigInt
    }

    // 4. Fetch decimals, prices, and calculate USD values
    const tokenBreakdown = [];
    let totalValueLocked = 0;

    for (const [tokenMint, data] of Object.entries(byToken)) {
      // Fetch real decimals from blockchain
      const decimals = await getTokenDecimals(connection, tokenMint);
      
      // Calculate human-readable amount
      const divisor = Math.pow(10, decimals);
      const tokenAmount = Number(data.totalRaw) / divisor;

      // Get pool info for price lookup
      const pool = await prisma.pool.findFirst({
        where: { tokenMint }
      });

      // Fetch token price
      const price = await getTokenPrice(tokenMint, pool?.pairAddress);
      const usdValue = tokenAmount * price;
      
      console.log(`💰 ${pool?.symbol || tokenMint.substring(0, 8)}: ${tokenAmount.toFixed(4)} tokens × $${price} = $${usdValue.toFixed(2)}`);

      totalValueLocked += usdValue;

      tokenBreakdown.push({
        tokenMint,
        poolName: pool?.name || 'Unknown',
        symbol: pool?.symbol || 'Unknown',
        decimals,
        stakeCount: data.stakes.length,
        amount: tokenAmount,
        amountRaw: data.totalRaw.toString(),
        price,
        usdValue,
      });
    }

    console.log(`✅ Total TVL: $${totalValueLocked.toFixed(2)}`);
    console.log(`✅ Total Stakers: ${totalStakers}\n`);

    return NextResponse.json({
      success: true,
      totalStakers,
      totalStakes: stakes.length,
      totalValueLocked, // Now in USD!
      tokenBreakdown,
    });

  } catch (error: any) {
    console.error('❌ Error fetching stats:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        totalStakers: 0,
        totalStakes: 0,
        totalValueLocked: 0,
        tokenBreakdown: [],
      },
      { status: 500 }
    );
  }
}