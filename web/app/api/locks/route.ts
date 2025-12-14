import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TelegramBotService } from '@/lib/telegram-bot';
import { Connection, PublicKey } from '@solana/web3.js';

// GET all locks - public read is fine
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
      poolId,
      logo,
    } = body;

    // Validate required fields
    if (!tokenMint || !name || !symbol || !amount || !lockDuration || !creatorWallet || !stakePda) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate public key formats
    try {
      new PublicKey(tokenMint);
      new PublicKey(creatorWallet);
      new PublicKey(stakePda);
      if (poolAddress) new PublicKey(poolAddress);
    } catch {
      return NextResponse.json(
        { error: 'Invalid public key format' },
        { status: 400 }
      );
    }

    // ✅ VERIFY ON-CHAIN: Check that the lock/stake PDA exists
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
    );

    try {
      const stakePdaKey = new PublicKey(stakePda);
      const accountInfo = await connection.getAccountInfo(stakePdaKey);

      if (!accountInfo) {
        console.error('❌ Lock PDA does not exist on-chain:', stakePda);
        return NextResponse.json(
          { error: 'Lock not found on-chain. Please create the lock first.' },
          { status: 400 }
        );
      }

      console.log('✅ Lock PDA verified on-chain:', stakePda);

      // Optional: Decode account to verify owner matches creatorWallet
      // This depends on your program's account structure
      // const program = new Program(IDL, PROGRAM_ID, provider);
      // const lockAccount = await program.account.lockEntry.fetch(stakePdaKey);
      // if (lockAccount.owner.toBase58() !== creatorWallet) {
      //   return NextResponse.json({ error: 'Wallet mismatch' }, { status: 403 });
      // }

    } catch (fetchError: any) {
      console.error('❌ On-chain verification failed:', fetchError);
      return NextResponse.json(
        { error: 'Could not verify lock on-chain' },
        { status: 400 }
      );
    }

    const unlockTime = new Date(Date.now() + lockDuration * 1000);
    const lockIdBigInt = BigInt(lockId || Date.now());

    const lock = await prisma.lock.upsert({
      where: {
        lock_token_lock_id_unique: {
          tokenMint,
          lockId: lockIdBigInt,
        },
      },
      update: {
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
        poolId: poolId !== undefined ? poolId : null,
        logo: logo || null,
        isActive: true,
        isUnlocked: false,
      },
    });

    console.log('✅ Lock created/updated:', lock.id);

    // 📢 Send Telegram alert for new lock
    try {
      const telegramBot = new TelegramBotService(prisma);
      await telegramBot.sendLockCreatedAlert({
        tokenName: name,
        tokenSymbol: symbol,
        amount: parseFloat(amount),
        lockDurationDays: Math.floor(lockDuration / 86400),
        creatorWallet,
        tokenLogo: logo || undefined,
      });
    } catch (telegramError) {
      console.error('⚠️ Telegram lock alert failed:', telegramError);
    }

    const lockResponse = {
      ...lock,
      lockId: lock.lockId.toString(),
    };

    return NextResponse.json(lockResponse, { status: 201 });
  } catch (error: any) {
    console.error('Error creating lock:', error);
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