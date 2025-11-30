import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userWallet, tokenMint, poolId } = body;

    console.log('🗑️ [DELETE] Request received:', { userWallet, tokenMint, poolId });

    // Validate required fields
    if (!userWallet || !tokenMint || poolId === undefined) {
      console.error('❌ [DELETE] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // First check if the record exists
    const existingStake = await prisma.userStake.findUnique({
      where: {
        userWallet_tokenMint_poolId: {
          userWallet,
          tokenMint,
          poolId: parseInt(poolId),
        },
      },
    });

    console.log('🔍 [DELETE] Existing stake:', existingStake ? 'Found' : 'Not found');

    if (!existingStake) {
      console.log('⚠️ [DELETE] No stake found to delete - already gone');
      return NextResponse.json({ success: true, message: 'Stake already deleted' });
    }

    // Delete the stake record
    const deleted = await prisma.userStake.delete({
      where: {
        userWallet_tokenMint_poolId: {
          userWallet,
          tokenMint,
          poolId: parseInt(poolId),
        },
      },
    });

    console.log('✅ [DELETE] Stake deleted successfully:', deleted.id);
    
    // ✅ Convert BigInt to string before returning
    const deletedResponse = {
      id: deleted.id,
      userWallet: deleted.userWallet,
      tokenMint: deleted.tokenMint,
      poolId: deleted.poolId,
      stakedAmount: deleted.stakedAmount?.toString(), // Convert BigInt to string
      stakePda: deleted.stakePda,
    };
    
    return NextResponse.json({ success: true, message: 'Stake deleted', deleted: deletedResponse });
  } catch (error: any) {
    console.error('❌ [DELETE] Error:', error);
    
    // If record doesn't exist, that's fine - it's already deleted
    if (error.code === 'P2025') {
      console.log('⚠️ [DELETE] Record not found (P2025) - already deleted');
      return NextResponse.json({ success: true, message: 'Stake already deleted' });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to delete stake' },
      { status: 500 }
    );
  }
}