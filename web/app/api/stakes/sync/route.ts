import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { prisma } from '@/lib/prisma';
import { getPDAs, getReadOnlyProgram } from '@/lib/anchor-program';

export async function POST(request: NextRequest) {
  try {
    const { userWallet, tokenMint, poolId } = await request.json();

    // Validate inputs
    if (!userWallet || !tokenMint || poolId === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate public keys
    let userPubkey: PublicKey;
    let mintPubkey: PublicKey;
    try {
      userPubkey = new PublicKey(userWallet);
      mintPubkey = new PublicKey(tokenMint);
    } catch {
      return NextResponse.json({ error: 'Invalid public key' }, { status: 400 });
    }

    // Connect to blockchain
    const rpcEndpoint = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');
    const program = getReadOnlyProgram(connection);

    // Calculate the stake PDA
    const [projectPDA] = getPDAs.project(mintPubkey, poolId);
    const [userStakePDA] = getPDAs.userStake(projectPDA, userPubkey);

    // ✅ FETCH ACTUAL ON-CHAIN DATA - This is the source of truth
    let onChainStake: any = null;
    try {
      onChainStake = await program.account.stake.fetch(userStakePDA, 'confirmed');
    } catch (e) {
      // Account doesn't exist = user has no stake
      onChainStake = null;
    }

    if (onChainStake && onChainStake.amount.toNumber() > 0) {
      // ✅ User HAS a stake on-chain - upsert with VERIFIED amount
      const verifiedAmount = onChainStake.amount.toString();
      
      await prisma.userStake.upsert({
        where: {
          userWallet_tokenMint_poolId: {
            userWallet,
            tokenMint,
            poolId,
          },
        },
        update: {
          stakedAmount: BigInt(verifiedAmount),
          stakePda: userStakePDA.toString(),
          updatedAt: new Date(),
        },
        create: {
          userWallet,
          tokenMint,
          poolId,
          stakedAmount: BigInt(verifiedAmount),
          stakePda: userStakePDA.toString(),
        },
      });

      console.log(`✅ Synced stake: ${userWallet.slice(0, 8)}... → ${verifiedAmount} (verified on-chain)`);
      
      return NextResponse.json({ 
        success: true, 
        action: 'upserted',
        amount: verifiedAmount,
      });
    } else {
      // ✅ User has NO stake on-chain - delete from database
      await prisma.userStake.deleteMany({
        where: {
          userWallet,
          tokenMint,
          poolId,
        },
      });

      console.log(`🗑️ Deleted stake: ${userWallet.slice(0, 8)}... (no on-chain stake found)`);
      
      return NextResponse.json({ 
        success: true, 
        action: 'deleted',
      });
    }
  } catch (error: any) {
    console.error('❌ Stake sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}