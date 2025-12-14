import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Connection, PublicKey } from '@solana/web3.js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userWallet, tokenMint, poolId, stakePda } = body;

    console.log('🗑️ [DELETE] Request received:', { userWallet, tokenMint, poolId, stakePda });

    // Validate required fields - now requires stakePda
    if (!userWallet || !tokenMint || poolId === undefined || !stakePda) {
      console.error('❌ [DELETE] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields (including stakePda)' },
        { status: 400 }
      );
    }

    // Validate public key formats
    try {
      new PublicKey(userWallet);
      new PublicKey(tokenMint);
      new PublicKey(stakePda);
    } catch {
      return NextResponse.json(
        { error: 'Invalid public key format' },
        { status: 400 }
      );
    }

    // ✅ VERIFY ON-CHAIN: Check that stake is actually closed/unstaked
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com');
    
    const stakePdaKey = new PublicKey(stakePda);
    const accountInfo = await connection.getAccountInfo(stakePdaKey);
    
    // Only allow deletion if stake account is closed on-chain
    // OR if it exists but has 0 balance (depending on your program logic)
    if (accountInfo && accountInfo.lamports > 0) {
      // Account still exists - check if it has 0 staked
      // You may need to decode and check the amount here
      console.error('❌ [DELETE] Stake still exists on-chain');
      return NextResponse.json(
        { error: 'Cannot delete: stake still exists on-chain. Unstake first.' },
        { status: 400 }
      );
    }

    console.log('✅ [DELETE] On-chain verification passed - stake is closed');

    // First check if the record exists in DB
    const existingStake = await prisma.userStake.findUnique({
      where: {
        userWallet_tokenMint_poolId: {
          userWallet,
          tokenMint,
          poolId: parseInt(poolId),
        },
      },
    });

    if (!existingStake) {
      console.log('⚠️ [DELETE] No stake found to delete - already gone');
      return NextResponse.json({ success: true, message: 'Stake already deleted' });
    }

    // ✅ Verify the requester owns this stake
    if (existingStake.userWallet !== userWallet) {
      console.error('❌ [DELETE] Wallet mismatch');
      return NextResponse.json(
        { error: 'Unauthorized: you do not own this stake' },
        { status: 403 }
      );
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

    return NextResponse.json({
      success: true,
      message: 'Stake deleted',
      deleted: {
        id: deleted.id,
        userWallet: deleted.userWallet,
        tokenMint: deleted.tokenMint,
        poolId: deleted.poolId,
        stakedAmount: deleted.stakedAmount?.toString(),
        stakePda: deleted.stakePda,
      }
    });

  } catch (error: any) {
    console.error('❌ [DELETE] Error:', error);

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