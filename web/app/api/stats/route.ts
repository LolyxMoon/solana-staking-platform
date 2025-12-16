import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { prisma } from '@/lib/prisma';
import { getPDAs, getReadOnlyProgram } from '@/lib/anchor-program';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Cache for token prices (5 minute TTL)
const priceCache = new Map<string, { price: number; timestamp: number }>();
const PRICE_CACHE_TTL = 5 * 60 * 1000;

const STABLECOINS: Record<string, number> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1,
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1,
};

async function getTokenPrice(tokenMint: string, pairAddress?: string | null): Promise<number> {
  if (STABLECOINS[tokenMint]) return STABLECOINS[tokenMint];

  const cached = priceCache.get(tokenMint);
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
    return cached.price;
  }

  try {
    let price = 0;

    if (pairAddress) {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`);
      const data = await res.json();
      if (data?.pairs?.[0]?.priceUsd) {
        price = parseFloat(data.pairs[0].priceUsd);
      }
    }

    if (price === 0) {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
      const data = await res.json();
      if (data?.pairs?.length > 0) {
        const sorted = data.pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
        if (sorted[0]?.priceUsd) price = parseFloat(sorted[0].priceUsd);
      }
    }

    priceCache.set(tokenMint, { price, timestamp: Date.now() });
    return price;
  } catch {
    return 0;
  }
}

// Safe conversion for large BN values
function bnToNumber(bn: any): number {
  try {
    const str = bn.toString();
    return parseFloat(str);
  } catch {
    return 0;
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('\nFetching platform stats from BLOCKCHAIN...');

    const rpcEndpoint = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const program = getReadOnlyProgram(connection);

    // 1. Get all pools from database (just for config: decimals, pairAddress, symbol)
    const pools = await prisma.pool.findMany();
    
    if (pools.length === 0) {
      return NextResponse.json({
        success: true,
        totalStakers: 0,
        totalValueLocked: 0,
        tokenBreakdown: [],
      });
    }

    // 2. Build PDAs for all pools
    const projectPDAs: PublicKey[] = [];
    const poolConfigs: any[] = [];

    for (const pool of pools) {
      const mintPubkey = new PublicKey(pool.tokenMint);
      const [projectPDA] = getPDAs.project(mintPubkey, pool.poolId);
      projectPDAs.push(projectPDA);
      poolConfigs.push(pool);
    }

    // 3. Batch fetch ALL project accounts from blockchain
    const projectAccounts = await connection.getMultipleAccountsInfo(projectPDAs);
    console.log(`Fetched ${projectAccounts.filter(Boolean).length} projects from blockchain`);

    // 4. Decode and calculate stats
    const tokenBreakdown = [];
    let totalValueLocked = 0;
    let totalStakers = 0;

    for (let i = 0; i < projectPDAs.length; i++) {
      const account = projectAccounts[i];
      const pool = poolConfigs[i];

      if (!account) {
        console.log(`No account found for ${pool.symbol}`);
        continue;
      }

      try {
        const decoded = program.coder.accounts.decode('project', account.data);
        
        // DEBUG: Log all fields to find staker count field name
        console.log(`\n=== ${pool.symbol} PROJECT FIELDS ===`);
        console.log('Available fields:', Object.keys(decoded));
        console.log('stakerCount:', decoded.stakerCount?.toString());
        console.log('staker_count:', decoded.staker_count?.toString());
        console.log('totalStakers:', decoded.totalStakers?.toString());
        console.log('numStakers:', decoded.numStakers?.toString());
        console.log('activeStakers:', decoded.activeStakers?.toString());
        
        // Use safe BN conversion for large numbers
        const totalStakedRaw = bnToNumber(decoded.totalStaked);
        
        // Try different possible field names for staker count
        const stakerCount = bnToNumber(
          decoded.stakerCount || 
          decoded.staker_count || 
          decoded.totalStakers || 
          decoded.numStakers ||
          decoded.activeStakers ||
          0
        );
        
        // Calculate human-readable amount
        const decimals = pool.tokenDecimals || 9;
        const tokenAmount = totalStakedRaw / Math.pow(10, decimals);

        // Get price
        const price = await getTokenPrice(pool.tokenMint, pool.pairAddress);
        const usdValue = tokenAmount * price;

        console.log(`${pool.symbol}: ${tokenAmount.toFixed(2)} tokens x $${price.toFixed(6)} = $${usdValue.toFixed(2)} (${stakerCount} stakers)`);

        totalValueLocked += usdValue;
        totalStakers += stakerCount;

        tokenBreakdown.push({
          tokenMint: pool.tokenMint,
          poolName: pool.name,
          symbol: pool.symbol,
          poolId: pool.poolId,
          decimals,
          totalStaked: tokenAmount,
          totalStakedRaw: totalStakedRaw.toString(),
          stakerCount,
          price,
          usdValue,
        });
      } catch (e) {
        console.error(`Failed to decode project ${pool.symbol}:`, e);
      }
    }

    console.log(`\nTotal TVL: $${totalValueLocked.toFixed(2)}`);
    console.log(`Total Stakers: ${totalStakers}\n`);

    return NextResponse.json({
      success: true,
      totalStakers,
      totalValueLocked,
      tokenBreakdown,
    });

  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      totalStakers: 0,
      totalValueLocked: 0,
      tokenBreakdown: [],
    }, { status: 500 });
  }
}