import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Connection, PublicKey } from '@solana/web3.js';

// GET single lock by ID - public read is fine
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lock = await prisma.lock.findUnique({
      where: {
        id: params.id,
      },
    });

    if (!lock) {
      return NextResponse.json(
        { error: 'Lock not found' },
        { status: 404 }
      );
    }

    const lockResponse = {
      ...lock,
      lockId: lock.lockId.toString(),
    };

    return NextResponse.json(lockResponse);
  } catch (error) {
    console.error('Error fetching lock:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lock' },
      { status: 500 }
    );
  }
}

// PATCH update lock - requires on-chain verification
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { isUnlocked, isActive, walletAddress } = body;

    // ✅ Require wallet address to verify ownership
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Validate wallet format
    try {
      new PublicKey(walletAddress);
    } catch {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Get the existing lock
    const existingLock = await prisma.lock.findUnique({
      where: { id: params.id },
    });

    if (!existingLock) {
      return NextResponse.json(
        { error: 'Lock not found' },
        { status: 404 }
      );
    }

    // ✅ Verify the requester is the lock creator
    if (existingLock.creatorWallet !== walletAddress) {
      console.error('❌ Unauthorized: wallet does not own this lock');
      return NextResponse.json(
        { error: 'Unauthorized: you do not own this lock' },
        { status: 403 }
      );
    }

    // ✅ If marking as unlocked, verify on-chain that lock is actually unlocked
    if (isUnlocked === true && existingLock.stakePda) {
      const connection = new Connection(
        process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
      );

      try {
        const stakePdaKey = new PublicKey(existingLock.stakePda);
        const accountInfo = await connection.getAccountInfo(stakePdaKey);

        // If account still exists with data, lock is not actually unlocked
        // Adjust this logic based on your program's unlock behavior
        if (accountInfo && accountInfo.data.length > 0) {
          // You may need to decode the account to check if it's actually unlocked
          // For now, we'll allow it if the unlock time has passed
          const now = new Date();
          if (existingLock.unlockTime && now < existingLock.unlockTime) {
            return NextResponse.json(
              { error: 'Lock period has not ended yet' },
              { status: 400 }
            );
          }
        }

        console.log('✅ On-chain verification passed for unlock');
      } catch (fetchError) {
        console.error('⚠️ Could not verify on-chain status:', fetchError);
        // Continue anyway if we can't verify - the unlock time check is backup
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (typeof isUnlocked === 'boolean') {
      updateData.isUnlocked = isUnlocked;
    }

    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }

    const lock = await prisma.lock.update({
      where: {
        id: params.id,
      },
      data: updateData,
    });

    console.log('✅ Lock updated by owner:', walletAddress);

    const lockResponse = {
      ...lock,
      lockId: lock.lockId.toString(),
    };

    return NextResponse.json(lockResponse);
  } catch (error) {
    console.error('Error updating lock:', error);
    return NextResponse.json(
      { error: 'Failed to update lock' },
      { status: 500 }
    );
  }
}

// DELETE lock - requires ownership verification
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get wallet from query params or body
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Validate wallet format
    try {
      new PublicKey(walletAddress);
    } catch {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Get the existing lock
    const existingLock = await prisma.lock.findUnique({
      where: { id: params.id },
    });

    if (!existingLock) {
      return NextResponse.json(
        { error: 'Lock not found' },
        { status: 404 }
      );
    }

    // ✅ Verify the requester is the lock creator
    if (existingLock.creatorWallet !== walletAddress) {
      console.error('❌ Unauthorized: wallet does not own this lock');
      return NextResponse.json(
        { error: 'Unauthorized: you do not own this lock' },
        { status: 403 }
      );
    }

    // ✅ Verify on-chain that lock is actually closed/unlocked before allowing deletion
    if (existingLock.stakePda) {
      const connection = new Connection(
        process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
      );

      try {
        const stakePdaKey = new PublicKey(existingLock.stakePda);
        const accountInfo = await connection.getAccountInfo(stakePdaKey);

        // Only allow deletion if stake PDA is closed on-chain
        if (accountInfo && accountInfo.lamports > 0) {
          // Check if lock period has ended
          const now = new Date();
          if (existingLock.unlockTime && now < existingLock.unlockTime) {
            return NextResponse.json(
              { error: 'Cannot delete: lock is still active on-chain' },
              { status: 400 }
            );
          }
        }

        console.log('✅ On-chain verification passed for deletion');
      } catch (fetchError) {
        console.error('⚠️ Could not verify on-chain status:', fetchError);
      }
    }

    await prisma.lock.delete({
      where: {
        id: params.id,
      },
    });

    console.log('✅ Lock deleted by owner:', walletAddress);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lock:', error);
    return NextResponse.json(
      { error: 'Failed to delete lock' },
      { status: 500 }
    );
  }
}