// lib/jupiter-swap.ts - Ultra API with minimal modification

import { 
  Connection, 
  PublicKey, 
  VersionedTransaction,
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

    // Step 2: Deserialize Jupiter's transaction - DO NOT MODIFY
    const transactionBuf = Buffer.from(orderData.transaction, 'base64');
    const transaction = VersionedTransaction.deserialize(transactionBuf);

    console.log('✍️ Requesting signature (using Jupiter transaction as-is)...');
    
    // Step 3: Sign the original transaction without modification
    const signedTransaction = await signTransaction(transaction);
    const signedTransactionBase64 = Buffer.from(signedTransaction.serialize()).toString('base64');

    // Step 4: Execute via Ultra API
    console.log('📤 Executing via Ultra...');
    const executeResponse = await fetch('https://lite-api.jup.ag/ultra/v1/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        signedTransaction: signedTransactionBase64,
        requestId: orderData.requestId,
      }),
    });

    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();
      console.error('❌ Ultra execute failed:', errorText);
      
      // Fallback: Send directly to RPC
      console.log('🔄 Trying direct RPC submission...');
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      const rawTransaction = signedTransaction.serialize();
      
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      console.log('✅ Transaction sent via RPC:', txid);
      
      await connection.confirmTransaction({
        signature: txid,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      return txid;
    }

    const executeData = await executeResponse.json();

    if (executeData.status === "Success" && executeData.signature) {
      console.log('✅ Swap successful:', executeData.signature);
      return executeData.signature;
    } else if (executeData.signature) {
      console.log('⚠️ Swap completed with signature:', executeData.signature);
      return executeData.signature;
    } else {
      console.error('❌ Swap failed:', executeData);
      throw new Error(executeData.error || 'Swap execution failed');
    }

  } catch (error: any) {
    console.error("❌ Jupiter swap error:", error);
    
    if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
      throw new Error('User rejected the transaction');
    }
    
    throw error;
  }
}