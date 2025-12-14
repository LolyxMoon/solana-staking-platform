import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import IDL from '@/lib/staking_program.json';

const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userWallet, tokenMint, poolId, stakePda } = body;
    
    console.log('💾 [UPSERT] Request received:', { userWallet, tokenMint, poolId, stakePda });
    
    // Validate required fields
    if (!userWallet || !tokenMint || poolId === undefined || !stakePda) {
      console.error('❌ [UPSERT] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // ✅ VERIFY ON-CHAIN: Fetch the actual stake from blockchain
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com');
    
    try {
      // Check if the stake PDA account exists on-chain
      const stakePdaKey = new PublicKey(stakePda);
      const accountInfo = await connection.getAccountInfo(stakePdaKey);
      
      if (!accountInfo) {
        console.error('❌ [UPSERT] Stake PDA does not exist on-chain');
        return NextResponse.json(
          { error: 'Stake not found on-chain. Please stake first.' },
          { status: 400 }
        );
      }

      // Decode the stake account to get the real amount
      // Note: Adjust this based on your actual program's account structure
      const provider = new AnchorProvider(connection, {} as any, { commitment: 'confirmed' });
      const program = new Program(IDL as any, new PublicKey(PROGRAM_ID), provider);
      
      const stakeAccount = await program.account.stakeEntry.fetch(stakePdaKey);
      
      // ✅ Verify the wallet owns this stake
      const onChainOwner = (stakeAccount as any).staker?.toBase58() || (stakeAccount as any).owner?.toBase58();
      if (onChainOwner !== userWallet) {
        console.error('❌ [UPSERT] Wallet does not own this stake');
        return NextResponse.json(
          { error: 'Unauthorized: wallet does not own this stake' },
          { status: 403 }
        );
      }

      // ✅ Use the ON-CHAIN amount, not user-provided
      const onChainAmount = (stakeAccount as any).stakedAmount || (stakeAccount as any).amount;
      const verifiedAmount = BigInt(onChainAmount.toString());

      console.log('✅ [UPSERT] On-chain verification passed:', {
        owner: onChainOwner,
        amount: verifiedAmount.toString()
      });

      // Now safe to upsert with verified blockchain data
      const stake = await prisma.userStake.upsert({
        where: {
          userWallet_tokenMint_poolId: {
            userWallet,
            tokenMint,
            poolId: parseInt(poolId),
          },
        },
        update: {
          stakedAmount: verifiedAmount,
          stakePda,
          updatedAt: new Date(),
        },
        create: {
          userWallet,
          tokenMint,
          poolId: parseInt(poolId),
          stakedAmount: verifiedAmount,
          stakePda,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log('✅ [UPSERT] Stake upserted successfully:', stake.id);

      return NextResponse.json({
        success: true,
        stake: {
          id: stake.id,
          userWallet: stake.userWallet,
          tokenMint: stake.tokenMint,
          poolId: stake.poolId,
          stakedAmount: stake.stakedAmount.toString(),
          stakePda: stake.stakePda,
          createdAt: stake.createdAt.toISOString(),
          updatedAt: stake.updatedAt.toISOString(),
        }
      });

    } catch (fetchError: any) {
      console.error('❌ [UPSERT] On-chain verification failed:', fetchError);
      return NextResponse.json(
        { error: 'Could not verify stake on-chain' },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('❌ [UPSERT] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upsert stake' },
      { status: 500 }
    );
  }
}