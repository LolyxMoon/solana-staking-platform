import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all locks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const active = searchParams.get('active');

    const where: any = {};

    if (wallet) {
      where.creatorWallet = wallet;
    }

    if (active === 'true') {
      where.isActive = true;
      where.isUnlocked = false;
    }

    const locks = await prisma.lock.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Convert BigInt to string for JSON serialization
    const locksResponse = locks.map(lock => ({
      ...lock,
      lockId: lock.lockId.toString(),
    }));

    return NextResponse.json(locksResponse);
  } catch (error) {
    console.error('Error fetching locks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locks' },
      { status: 500 }
    );
  }
}

// POST create new lock
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      lockId,
      tokenMint,
      name,
      symbol,
      amount,
      lockDuration,
      creatorWallet,
      poolAddress,
      stakePda,
      poolId, // ← ADD THIS
      logo,
    } = body;

    // Validate required fields
    if (!tokenMint || !name || !symbol || !amount || !lockDuration || !creatorWallet) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate unlock time
    const unlockTime = new Date(Date.now() + lockDuration * 1000);

    // Convert lockId to BigInt for database
    const lockIdBigInt = BigInt(lockId || Date.now());

    // Use upsert to handle case where stakePda already exists
    // This can happen if user locks more tokens in the same pool
    const lock = await prisma.lock.upsert({
      where: {
        lock_token_lock_id_unique: {
          tokenMint,
          lockId: lockIdBigInt,
        },
      },
      update: {
        // Update the amount if lock already exists (user added more)
        amount: parseFloat(amount),
        unlockTime,
        updatedAt: new Date(),
      },
      create: {
        lockId: lockIdBigInt,
        tokenMint,
        name,
        symbol,
        amount: parseFloat(amount),
        lockDuration,
        unlockTime,
        creatorWallet,
        poolAddress: poolAddress || null,
        stakePda: stakePda || null,
        poolId: poolId !== undefined ? poolId : null, // ← ADD THIS
        logo: logo || null,
        isActive: true,
        isUnlocked: false,
      },
    });

    // Convert BigInt to string for JSON serialization
    const lockResponse = {
      ...lock,
      lockId: lock.lockId.toString(),
    };

    return NextResponse.json(lockResponse, { status: 201 });
  } catch (error: any) {
    console.error('Error creating lock:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    return NextResponse.json(
      { 
        error: 'Failed to create lock',
        details: error.message,
        code: error.code,
      },
      { status: 500 }
    );
  }
}