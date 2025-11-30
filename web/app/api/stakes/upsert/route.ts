import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userWallet, tokenMint, poolId, amount, stakePda, lastUpdated } = body;
    
    console.log('💾 [UPSERT] Request received:', { 
      userWallet, 
      tokenMint, 
      poolId, 
      amount: amount.slice(0, 10) + '...' 
    });
    
    // Validate required fields
    if (!userWallet || !tokenMint || poolId === undefined || !amount || !stakePda) {
      console.error('❌ [UPSERT] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Upsert the stake record using UserStake model
    const stake = await prisma.userStake.upsert({
      where: {
        userWallet_tokenMint_poolId: {
          userWallet,
          tokenMint,
          poolId: parseInt(poolId),
        },
      },
      update: {
        stakedAmount: BigInt(amount),
        stakePda,
        updatedAt: new Date(lastUpdated),
      },
      create: {
        userWallet,
        tokenMint,
        poolId: parseInt(poolId),
        stakedAmount: BigInt(amount),
        stakePda,
        createdAt: new Date(lastUpdated),
        updatedAt: new Date(lastUpdated),
      },
    });
    
    console.log('✅ [UPSERT] Stake upserted successfully:', stake.id);
    
    // Convert BigInt to string for JSON serialization
    return NextResponse.json({ 
      success: true, 
      stake: {
        id: stake.id,
        userWallet: stake.userWallet,
        tokenMint: stake.tokenMint,
        poolId: stake.poolId,
        stakedAmount: stake.stakedAmount.toString(), // Convert BigInt to string
        stakePda: stake.stakePda,
        createdAt: stake.createdAt.toISOString(),
        updatedAt: stake.updatedAt.toISOString(),
      }
    });
    
  } catch (error: any) {
    console.error('❌ [UPSERT] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upsert stake' },
      { status: 500 }
    );
  }
}