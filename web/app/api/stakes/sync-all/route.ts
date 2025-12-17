import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { prisma } from '@/lib/prisma';
import { getPDAs, getReadOnlyProgram } from '@/lib/anchor-program';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

function bnToNumber(bn: any): number {
  try {
    return parseFloat(bn.toString());
  } catch {
    return 0;
  }
}

export async function GET(request: NextRequest) {
  try {
    const rpcEndpoint = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const program = getReadOnlyProgram(connection);

    // Get pools config
    const pools = await prisma.pool.findMany();
    
    // Get staker count directly from database
    const stakes = await prisma.userStake.findMany({
      select: { userWallet: true }
    });
    const uniqueWallets = new Set(stakes.map(s => s.userWallet));
    const totalStakers = uniqueWallets.size;

    // Build PDAs
    const projectPDAs: PublicKey[] = [];
    const poolConfigs: any[] = [];

    for (const pool of pools) {
      const mintPubkey = new PublicKey(pool.tokenMint);
      const [projectPDA] = getPDAs.project(mintPubkey, pool.poolId);
      projectPDAs.push(projectPDA);
      poolConfigs.push(pool);
    }

    // Fetch blockchain data
    const projectAccounts = await connection.getMultipleAccountsInfo(projectPDAs);

    const tokenBreakdown = [];
    let totalValueLocked = 0;

    for (let i = 0; i < projectPDAs.length; i++) {
      const account = projectAccounts[i];
      const pool = poolConfigs[i];

      if (!account) continue;

      try {
        const decoded = program.coder.accounts.decode('project', account.data);
        const totalStakedRaw = bnToNumber(decoded.totalStaked);
        const decimals = pool.tokenDecimals || 9;
        const tokenAmount = totalStakedRaw / Math.pow(10, decimals);
        const price = await getTokenPrice(pool.tokenMint, pool.pairAddress);
        const usdValue = tokenAmount * price;

        totalValueLocked += usdValue;

        tokenBreakdown.push({
          tokenMint: pool.tokenMint,
          poolName: pool.name,
          symbol: pool.symbol,
          poolId: pool.poolId,
          decimals,
          totalStaked: tokenAmount,
          totalStakedRaw: totalStakedRaw.toString(),
          price,
          usdValue,
        });
      } catch (e) {
        console.error(`Failed to decode ${pool.symbol}:`, e);
      }
    }

    return NextResponse.json({
      success: true,
      totalStakers,
      totalValueLocked,
      tokenBreakdown,
    });

  } catch (error: any) {
    console.error('Stats error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      totalStakers: 0,
      totalValueLocked: 0,
      tokenBreakdown: [],
    }, { status: 500 });
  }
}