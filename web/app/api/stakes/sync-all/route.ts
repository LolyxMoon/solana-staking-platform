import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { prisma } from '@/lib/prisma';
import { getPDAs, getReadOnlyProgram, PROGRAM_ID } from '@/lib/anchor-program';
import bs58 from 'bs58';

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
    let totalDeleted = 0;

    // Get stake discriminator from Anchor (first 8 bytes of sha256("account:Stake"))
    const stakeDiscriminator = Buffer.from([150, 138, 56, 227, 57, 217, 200, 243]);

    const allStakeAccounts = await connection.getProgramAccounts(
      new PublicKey(PROGRAM_ID),
      {
        filters: [
          { 
            memcmp: { 
              offset: 0, 
              bytes: bs58.encode(stakeDiscriminator)
            } 
          }
        ]
      }
    );

    console.log(`Found ${allStakeAccounts.length} stake accounts on-chain`);

    for (const { pubkey, account } of allStakeAccounts) {
      try {
        const decoded = program.coder.accounts.decode('stake', account.data);
        
        const userWallet = decoded.user?.toString() || decoded.owner?.toString();
        const amount = decoded.amount?.toString() || '0';
        
        if (!userWallet || amount === '0') {
          continue;
        }

        const projectPda = decoded.project?.toString();
        
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
          console.log(`Could not match stake ${pubkey.toString()} to any pool`);
          continue;
        }

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
        console.error(`Failed to decode stake ${pubkey.toString()}:`, e);
      }
    }

    const dbStakes = await prisma.userStake.findMany();
    for (const stake of dbStakes) {
      const exists = allStakeAccounts.some(s => s.pubkey.toString() === stake.stakePda);
      if (!exists) {
        await prisma.userStake.delete({
          where: { id: stake.id }
        });
        totalDeleted++;
        console.log(`Deleted stale stake: ${stake.userWallet.slice(0, 8)}...`);
      }
    }

    console.log(`\n=== SYNC COMPLETE ===`);
    console.log(`Synced: ${totalSynced} stakes`);
    console.log(`Deleted: ${totalDeleted} stale records\n`);

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      deleted: totalDeleted,
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}