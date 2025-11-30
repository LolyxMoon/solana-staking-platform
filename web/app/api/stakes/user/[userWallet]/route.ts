import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { userWallet: string } }
) {
  try {
    const { userWallet } = params;

    console.log('📊 Fetching stakes for user:', userWallet);

    // Get all stakes for this user
    const stakes = await prisma.userStake.findMany({
      where: {
        userWallet,
      },
      orderBy: {
        stakedAmount: 'desc',
      },
    });

    console.log(`✅ Found ${stakes.length} stakes for user`);

    if (stakes.length === 0) {
      return NextResponse.json({
        success: true,
        stakes: [],
        totalStaked: 0,
      });
    }

    // Fetch pool details for each stake
    const stakesWithPoolInfo = await Promise.all(
      stakes.map(async (stake) => {
        const pool = await prisma.pool.findFirst({
          where: {
            tokenMint: stake.tokenMint,
            poolId: stake.poolId,
          },
        });

        return {
          id: stake.id,
          tokenMint: stake.tokenMint,
          poolId: stake.poolId,
          stakedAmount: stake.stakedAmount.toString(),
          stakePda: stake.stakePda,
          createdAt: stake.createdAt.toISOString(),
          updatedAt: stake.updatedAt.toISOString(),
          poolName: pool?.name || 'Unknown Pool',
          poolSymbol: pool?.symbol || 'UNKNOWN',
          poolLogo: pool?.logo || null,
          apy: pool?.apy || null,
          apr: pool?.apr || null,
          type: pool?.type || 'unlocked',
        };
      })
    );

    // Calculate total staked (in human-readable format, assuming 9 decimals)
    const totalStaked = stakes.reduce((sum, stake) => {
      return sum + Number(stake.stakedAmount) / 1e9;
    }, 0);

    console.log(`✅ Total staked: ${totalStaked.toFixed(2)} tokens`);

    return NextResponse.json({
      success: true,
      stakes: stakesWithPoolInfo,
      totalStaked,
    });

  } catch (error: any) {
    console.error('❌ Error fetching user stakes:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch user stakes',
        stakes: [],
        totalStaked: 0,
      },
      { status: 500 }
    );
  }
}