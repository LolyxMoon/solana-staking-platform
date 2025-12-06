// lib/jupiter-swap.ts - Ultra API with Phantom checklist compliance

import { 
  Connection, 
  PublicKey, 
  VersionedTransaction,
  TransactionMessage,
  ComputeBudgetProgram,
  AddressLookupTableAccount,
} from "@solana/web3.js";

const REFERRAL_ACCOUNT = process.env.NEXT_PUBLIC_JUPITER_REFERRAL_ACCOUNT || "";
const REFERRAL_FEE_BPS = parseInt(process.env.NEXT_PUBLIC_JUPITER_REFERRAL_FEE || "50");

interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: any;
  priceImpactPct: string;
  routePlan: any[];
}

export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 100,
  platformFeeBps?: number,
  treasuryWallet?: string
): Promise<JupiterQuoteResponse | null> {
  try {
    console.log('🪐 Jupiter Quote Request:', {
      inputMint,
      outputMint,
      amount,
      slippageBps,
    });

    const quoteParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
    });

    const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?${quoteParams.toString()}`;
    
    let quoteResponse = await fetch(quoteUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!quoteResponse.ok) {
      const quoteUrlPro = `https://api.jup.ag/swap/v1/quote?${quoteParams.toString()}`;
      quoteResponse = await fetch(quoteUrlPro, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
    }

    if (!quoteResponse.ok) {
      console.error('❌ Quote failed:', quoteResponse.status);
      return null;
    }

    const quoteData = await quoteResponse.json();
    
    console.log('✅ Quote received:', {
      inputAmount: quoteData.inAmount,
      outputAmount: quoteData.outAmount,
      priceImpact: quoteData.priceImpactPct,
    });

    return {
      inputMint: quoteData.inputMint,
      inAmount: quoteData.inAmount,
      outputMint: quoteData.outputMint,
      outAmount: quoteData.outAmount,
      otherAmountThreshold: quoteData.otherAmountThreshold,
      swapMode: quoteData.swapMode,
      slippageBps: quoteData.slippageBps,
      platformFee: REFERRAL_ACCOUNT ? { feeBps: REFERRAL_FEE_BPS } : null,
      priceImpactPct: quoteData.priceImpactPct,
      routePlan: quoteData.routePlan || [],
    };

  } catch (error) {
    console.error("❌ Jupiter quote error:", error);
    return null;
  }
}

export async function executeJupiterSwap(
  connection: Connection,
  userPublicKey: PublicKey,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 100,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  platformFeeBps?: number,
  treasuryWallet?: string
): Promise<string> {
  try {
    console.log('🔄 Jupiter Ultra Swap:', {
      inputMint,
      outputMint,
      amount,
      slippageBps,
      userWallet: userPublicKey.toString(),
    });

    // Step 1: Get order from Ultra API
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      taker: userPublicKey.toString(),
      slippageBps: slippageBps.toString(),
    });

    if (REFERRAL_ACCOUNT) {
      params.append('referralAccount', REFERRAL_ACCOUNT);
      params.append('referralFee', REFERRAL_FEE_BPS.toString());
      console.log('💰 Referral:', REFERRAL_ACCOUNT);
    }

    const orderUrl = `https://lite-api.jup.ag/ultra/v1/order?${params.toString()}`;
    
    console.log('📡 Fetching Ultra order...');
    const orderResponse = await fetch(orderUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error('❌ Order failed:', orderResponse.status, errorText);
      throw new Error(`Failed to get order: ${errorText}`);
    }

    const orderData = await orderResponse.json();
    
    if (orderData.error) {
      console.error('❌ Jupiter error:', orderData.error);
      throw new Error(orderData.error);
    }
    
    if (!orderData.transaction) {
      throw new Error('No transaction returned from Ultra API');
    }

    console.log('✅ Order received:', {
      requestId: orderData.requestId,
      feeMint: orderData.feeMint,
      feeBps: orderData.feeBps,
    });

    // Step 2: Deserialize the transaction
    const transactionBuf = Buffer.from(orderData.transaction, 'base64');
    const originalTx = VersionedTransaction.deserialize(transactionBuf);

    // Step 3: PHANTOM CHECKLIST - Check transaction size
    const txSize = transactionBuf.length;
    console.log('📏 Transaction size:', txSize, 'bytes (limit: 1232)');
    if (txSize > 1232) {
      console.warn('⚠️ Transaction exceeds 1232 byte limit!');
    }

    // Step 4: Get address lookup tables for decompilation
    const addressLookupTableAccounts: AddressLookupTableAccount[] = [];
    
    if (originalTx.message.addressTableLookups.length > 0) {
      console.log('📋 Fetching', originalTx.message.addressTableLookups.length, 'lookup tables...');
      const lookupTableAddresses = originalTx.message.addressTableLookups.map(
        lookup => lookup.accountKey
      );
      
      const lookupTableAccounts = await Promise.all(
        lookupTableAddresses.map(async (address) => {
          const account = await connection.getAddressLookupTable(address);
          return account.value;
        })
      );
      
      for (const account of lookupTableAccounts) {
        if (account) {
          addressLookupTableAccounts.push(account);
        }
      }
    }

    // Step 5: Decompile message
    const decompiledMessage = TransactionMessage.decompile(
      originalTx.message,
      { addressLookupTableAccounts }
    );

    // Step 6: PHANTOM CHECKLIST - Verify feePayer is user's wallet
    const currentFeePayer = decompiledMessage.payerKey.toString();
    const expectedFeePayer = userPublicKey.toString();
    
    console.log('👛 FeePayer check:', {
      current: currentFeePayer,
      expected: expectedFeePayer,
      match: currentFeePayer === expectedFeePayer,
    });

    // Step 7: PHANTOM CHECKLIST - Check compute budget is FIRST
    const computeBudgetProgramId = ComputeBudgetProgram.programId.toString();
    let instructions = [...decompiledMessage.instructions];
    
    const computeBudgetIndices = instructions
      .map((ix, i) => ix.programId.toString() === computeBudgetProgramId ? i : -1)
      .filter(i => i !== -1);
    
    console.log('🔧 Compute budget instruction indices:', computeBudgetIndices);
    
    // If compute budget exists but not at index 0, reorder
    if (computeBudgetIndices.length > 0 && computeBudgetIndices[0] !== 0) {
      console.log('🔄 Reordering: moving compute budget to front...');
      const computeBudgetIxs = computeBudgetIndices.map(i => instructions[i]);
      const otherIxs = instructions.filter((_, i) => !computeBudgetIndices.includes(i));
      instructions = [...computeBudgetIxs, ...otherIxs];
    } else if (computeBudgetIndices.length === 0) {
      console.log('➕ Adding compute budget instructions at front...');
      const computeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 });
      const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 });
      instructions = [computeUnitLimit, computeUnitPrice, ...instructions];
    } else {
      console.log('✅ Compute budget already at front');
    }

    // Step 8: Get fresh blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    console.log('🔗 Fresh blockhash:', blockhash.substring(0, 20) + '...');

    // Step 9: PHANTOM CHECKLIST - Rebuild with feePayer as user wallet (canonical order)
    const newMessage = new TransactionMessage({
      payerKey: userPublicKey, // EXPLICIT: feePayer is user's wallet
      recentBlockhash: blockhash,
      instructions: instructions,
    });

    // Step 10: Compile to V0 message with lookup tables
    const compiledMessage = newMessage.compileToV0Message(addressLookupTableAccounts);
    
    // Step 11: Create new versioned transaction
    const newTransaction = new VersionedTransaction(compiledMessage);

    // Step 12: Verify final transaction size
    const finalTxSize = newTransaction.serialize().length;
    console.log('📏 Final transaction size:', finalTxSize, 'bytes');

    // Step 13: PHANTOM CHECKLIST - Only wallet signs first
    console.log('✍️ Requesting wallet signature (wallet signs first)...');
    const signedTransaction = await signTransaction(newTransaction);

    // Step 14: Send raw transaction
    console.log('📤 Sending raw transaction...');
    const rawTransaction = signedTransaction.serialize();
    
    const txid = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });

    console.log('✅ Transaction sent:', txid);

    // Step 15: Confirm
    const confirmation = await connection.confirmTransaction({
      signature: txid,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log('✅ Swap confirmed!');
    return txid;

  } catch (error: any) {
    console.error("❌ Jupiter swap error:", error);
    
    if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
      throw new Error('User rejected the transaction');
    }
    
    throw error;
  }
}