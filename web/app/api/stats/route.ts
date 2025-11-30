import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Cache for token decimals (in-memory, resets on server restart)
const decimalsCache = new Map<string, number>();

async function getTokenDecimals(connection: Connection, mintAddress: string): Promise<number> {
  // Check cache first
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

export async function GET(request: NextRequest) {
  try {
    console.log('\n📊 Fetching platform stats...');

    // Get RPC endpoint
    const rpcEndpoint = process.env.NEXT_PUBLIC_HELIUS_RPC || 'https://api.devnet.solana.com';
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

    // 4. Fetch decimals and calculate token amounts
    const tokenBreakdown = [];
    let totalValueLocked = 0;

    for (const [tokenMint, data] of Object.entries(byToken)) {
      // Fetch real decimals from blockchain
      const decimals = await getTokenDecimals(connection, tokenMint);
      
      // Calculate human-readable amount
      const divisor = Math.pow(10, decimals);
      const tokenAmount = Number(data.totalRaw) / divisor;
      
      console.log(`💰 ${tokenMint.substring(0, 8)}...: ${tokenAmount.toFixed(4)} tokens (${decimals} decimals)`);

      // Get pool name from database
      const pool = await prisma.pool.findFirst({
        where: { tokenMint }
      });

      totalValueLocked += tokenAmount;

      tokenBreakdown.push({
        tokenMint,
        poolName: pool?.name || 'Unknown',
        decimals,
        stakeCount: data.stakes.length,
        amount: tokenAmount,
        amountRaw: data.totalRaw.toString(),
      });
    }

    console.log(`✅ Total TVL: ${totalValueLocked.toFixed(2)} tokens`);
    console.log(`✅ Total Stakers: ${totalStakers}\n`);

    return NextResponse.json({
      success: true,
      totalStakers,
      totalStakes: stakes.length,
      totalValueLocked, // Total tokens staked (normalized by decimals)
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