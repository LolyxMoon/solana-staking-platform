// app/api/swap/transaction/route.ts
// JUPITER INTEGRATION - Like Phantom uses!

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6';
const MAINNET_RPC = process.env.NEXT_PUBLIC_SWAP_RPC_URL || 'https://api.mainnet-beta.solana.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userPublicKey, inputMint, outputMint, amount, slippage = 50 } = body;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🪐 JUPITER SWAP (LIKE PHANTOM)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('User:', userPublicKey);
    console.log('Input:', inputMint);
    console.log('Output:', outputMint);
    console.log('Amount:', amount);

    const connection = new Connection(MAINNET_RPC, 'confirmed');
    const userPubkey = new PublicKey(userPublicKey);

    // Get config
    const configResponse = await fetch(`${request.nextUrl.origin}/api/swap/config`);
    const config = await configResponse.json();

    if (!config.swapEnabled) {
      return NextResponse.json({ error: 'Swap disabled' }, { status: 403 });
    }

    // Step 1: Get Jupiter quote
    console.log('📡 Getting Jupiter quote...');
    
    const quoteParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippage.toString(),
      onlyDirectRoutes: 'false', // ✅ Allow ALL routes including Raydium
      asLegacyTransaction: 'false', // Use versioned transactions
    });

    const quoteUrl = `${JUPITER_QUOTE_API}/quote?${quoteParams}`;
    const quoteResponse = await fetch(quoteUrl);

    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      console.error('❌ Jupiter quote failed:', errorText);
      throw new Error('Failed to get Jupiter quote');
    }

    const quoteData = await quoteResponse.json();
    console.log('✅ Jupiter quote received');
    console.log('📊 Output amount:', quoteData.outAmount);
    console.log('📊 Route:', quoteData.routePlan?.map((r: any) => r.swapInfo?.label).join(' → '));

    // Step 2: Calculate platform fee
    const outputAmount = BigInt(quoteData.outAmount);
    const feeAmount = (outputAmount * BigInt(config.platformFeeBps)) / BigInt(10000);
    
    console.log('💰 Platform fee:', feeAmount.toString(), 'tokens');

    // Step 3: Get swap transaction from Jupiter
    console.log('📝 Creating Jupiter swap transaction...');
    
    const swapResponse = await fetch(`${JUPITER_SWAP_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    });

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      console.error('❌ Jupiter swap failed:', errorText);
      throw new Error('Failed to create Jupiter swap transaction');
    }

    const swapData = await swapResponse.json();
    console.log('✅ Jupiter transaction created');

    // Step 4: Add platform fee to the transaction
    if (config.platformFeeBps > 0 && outputMint !== 'So11111111111111111111111111111111111111112') {
      console.log('💰 Adding platform fee to transaction...');

      try {
        // Deserialize Jupiter's transaction
        const txBuffer = Buffer.from(swapData.swapTransaction, 'base64');
        let jupiterTx = VersionedTransaction.deserialize(txBuffer);

        // Get fee transfer accounts
        const outputMintPubkey = new PublicKey(outputMint);
        const treasuryPubkey = new PublicKey(config.treasuryWallet);
        const userOutputAccount = await getAssociatedTokenAddress(outputMintPubkey, userPubkey);
        const treasuryOutputAccount = await getAssociatedTokenAddress(outputMintPubkey, treasuryPubkey);

        // Check if treasury account exists
        const treasuryAccountInfo = await connection.getAccountInfo(treasuryOutputAccount);

        console.log('✅ Platform fee will be collected in separate transaction');
        console.log('💡 User signs both transactions at once');

        // Return both transactions for client to handle
        return NextResponse.json({
          swapTransaction: swapData.swapTransaction,
          quote: quoteData,
          source: 'jupiter',
          feeInfo: {
            platformFeeBps: config.platformFeeBps,
            treasuryWallet: config.treasuryWallet,
            outputMint: outputMint,
            outputAmount: quoteData.outAmount,
            feeAmount: feeAmount.toString(),
            needsAccountCreation: !treasuryAccountInfo,
            userOutputAccount: userOutputAccount.toBase58(),
            treasuryOutputAccount: treasuryOutputAccount.toBase58(),
          },
          rpcUrl: MAINNET_RPC,
        });

      } catch (feeError: any) {
        console.error('⚠️ Fee preparation failed:', feeError.message);
        // Return swap without fee info
        return NextResponse.json({
          swapTransaction: swapData.swapTransaction,
          quote: quoteData,
          source: 'jupiter',
          feeInfo: null,
          rpcUrl: MAINNET_RPC,
        });
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return NextResponse.json({
      swapTransaction: swapData.swapTransaction,
      quote: quoteData,
      source: 'jupiter',
      feeInfo: null,
      rpcUrl: MAINNET_RPC,
    });

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    
    return NextResponse.json(
      { error: error.message || 'Failed to create swap transaction' },
      { status: 500 }
    );
  }
}