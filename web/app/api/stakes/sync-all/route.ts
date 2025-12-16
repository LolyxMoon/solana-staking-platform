import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { prisma } from '@/lib/prisma';
import { getPDAs, getReadOnlyProgram, PROGRAM_ID } from '@/lib/anchor-program';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { adminKey } = await request.json();
    if (adminKey !== process.env.ADMIN_SYNC_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('\n=== SYNCING ALL STAKES FROM BLOCKCHAIN ===\n');

    const rpcEndpoint = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const program = getReadOnlyProgram(connection);

    const pools = await prisma.pool.findMany();
    console.log(`Found ${pools.length} pools to scan`);

    let totalSynced = 0;

    // Fetch all program accounts and try to decode as stake
    const allAccounts = await connection.getProgramAccounts(new PublicKey(PROGRAM_ID));
    console.log(`Found ${allAccounts.length} total program accounts`);

    const validStakes: { pubkey: string; userWallet: string; tokenMint: string; poolId: number; amount: string }[] = [];

    for (const { pubkey, account } of allAccounts) {
      try {
        // Try to decode as stake account
        const decoded = program.coder.accounts.decode('stake', account.data);
        
        // If successful, it's a stake account
        const userWallet = decoded.user?.toString();
        const amount = decoded.amount?.toString() || '0';
        const projectPda = decoded.project?.toString();
        
        if (!userWallet || amount === '0' || !projectPda) {
          continue;
        }

        // Match to a pool
        let matchedPool = null;
        for (const pool of pools) {
          const mintPubkey = new PublicKey(pool.tokenMint);
          const [expectedProjectPDA] = getPDAs.project(mintPubkey, pool.poolId);
          if (expectedProjectPDA.toString() === projectPda) {
            matchedPool = pool;
            break;
          }
        }

        if (!matchedPool) {
          console.log(`Could not match stake ${pubkey.toString().slice(0, 8)}... to any pool`);
          continue;
        }

        validStakes.push({
          pubkey: pubkey.toString(),
          userWallet,
          tokenMint: matchedPool.tokenMint,
          poolId: matchedPool.poolId,
          amount,
        });

        // Upsert to database
        await prisma.userStake.upsert({
          where: {
            userWallet_tokenMint_poolId: {
              userWallet,
              tokenMint: matchedPool.tokenMint,
              poolId: matchedPool.poolId,
            },
          },
          update: {
            stakedAmount: BigInt(amount),
            stakePda: pubkey.toString(),
            updatedAt: new Date(),
          },
          create: {
            userWallet,
            tokenMint: matchedPool.tokenMint,
            poolId: matchedPool.poolId,
            stakedAmount: BigInt(amount),
            stakePda: pubkey.toString(),
          },
        });

        totalSynced++;
        console.log(`Synced: ${userWallet.slice(0, 8)}... -> ${matchedPool.symbol} (${amount})`);

      } catch (e) {
        // Not a stake account, skip
        continue;
      }
    }

    console.log(`\n=== SYNC COMPLETE ===`);
    console.log(`Synced: ${totalSynced} stakes\n`);

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      stakes: validStakes.map(s => ({
        wallet: s.userWallet.slice(0, 8) + '...',
        pool: s.tokenMint.slice(0, 8) + '...',
        amount: s.amount,
      })),
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}