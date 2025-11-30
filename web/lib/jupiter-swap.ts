// lib/jupiter-swap.ts - Updated for Jupiter Swap API v1 with Integrator Fees

import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

// Get referral config from environment
const REFERRAL_ACCOUNT = process.env.NEXT_PUBLIC_JUPITER_REFERRAL_ACCOUNT || "";
const REFERRAL_FEE_BPS = parseInt(process.env.NEXT_PUBLIC_JUPITER_REFERRAL_FEE || "50"); // 50 bps = 0.5%
const USE_JUPITER = process.env.NEXT_PUBLIC_USE_JUPITER !== "false"; // Can disable Jupiter if network issues

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

interface UltraOrderResponse {
  transaction: string; // base64 encoded transaction
  requestId: string;
  feeMint?: string; // Which token the fee will be collected in
  feeBps?: number; // Total fee in basis points
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

/**
 * Get quote from Jupiter Swap API v1
 * Uses Lite API for quotes, Ultra API for execution with referral fees
 */
export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 100,
  platformFeeBps?: number,
  treasuryWallet?: string
): Promise<JupiterQuoteResponse | null> {
  try {
    console.log('🪐 Jupiter Swap API v1 Quote Request:', {
      inputMint,
      outputMint,
      amount,
      slippageBps,
      referralFeeBps: REFERRAL_FEE_BPS,
    });

    // Step 1: Get quote from regular Jupiter API for output amount estimation
    const quoteParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
    });

    console.log('📊 Fetching quote from Jupiter Swap API v1...');
    
    // Try Lite API first (faster, free)
    let quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?${quoteParams.toString()}`;
    
    console.log('🔗 Trying Lite API:', quoteUrl);
    
    let quoteResponse = await fetch(quoteUrl, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // If Lite API fails, try Pro API
    if (!quoteResponse.ok) {
      console.log('⚠️ Lite API failed, trying Pro API...');
      quoteUrl = `https://api.jup.ag/swap/v1/quote?${quoteParams.toString()}`;
      
      quoteResponse = await fetch(quoteUrl, {
        method: 'GET',
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
    }

    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      console.error('❌ Quote API failed:', {
        status: quoteResponse.status,
        statusText: quoteResponse.statusText,
        url: quoteUrl,
        error: errorText,
      });
      
      // Check if it's a network error
      if (quoteResponse.status === 0 || !navigator.onLine) {
        console.error('🌐 Network error - check internet connection or try VPN');
      }
      
      return null;
    }

    const quoteData = await quoteResponse.json();
    
    console.log('✅ Quote received:', {
      inputAmount: quoteData.inAmount,
      outputAmount: quoteData.outAmount,
      priceImpact: quoteData.priceImpactPct,
    });

    // Add referral fee info if configured
    if (REFERRAL_ACCOUNT) {
      console.log('💰 Referral fees will be collected:', {
        referralAccount: REFERRAL_ACCOUNT,
        referralFeeBps: REFERRAL_FEE_BPS,
      });
    }

    return {
      inputMint: quoteData.inputMint,
      inAmount: quoteData.inAmount,
      outputMint: quoteData.outputMint,
      outAmount: quoteData.outAmount,
      otherAmountThreshold: quoteData.otherAmountThreshold,
      swapMode: quoteData.swapMode,
      slippageBps: quoteData.slippageBps,
      platformFee: REFERRAL_ACCOUNT ? {
        feeBps: REFERRAL_FEE_BPS,
        feeMint: inputMint, // Fees usually taken from input token
      } : null,
      priceImpactPct: quoteData.priceImpactPct,
      routePlan: quoteData.routePlan || [],
    };

  } catch (error) {
    console.error("❌ Jupiter quote error:", error);
    return null;
  }
}

/**
 * Execute swap using Jupiter Ultra API (supports referral fees)
 */
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
    console.log('🔄 Jupiter Ultra Swap Execution:', {
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
      taker: userPublicKey.toString(), // REQUIRED for Ultra
      slippageBps: slippageBps.toString(),
    });

    // Add referral parameters - THIS IS THE CORRECT WAY FOR ULTRA
    if (REFERRAL_ACCOUNT) {
      params.append('referralAccount', REFERRAL_ACCOUNT);
      params.append('referralFee', REFERRAL_FEE_BPS.toString());
      console.log('💰 Collecting fees via Ultra:', {
        referralAccount: REFERRAL_ACCOUNT,
        referralFeeBps: REFERRAL_FEE_BPS,
      });
    }

    const orderUrl = `https://lite-api.jup.ag/ultra/v1/order?${params.toString()}`;
    
    console.log('📡 Fetching Ultra order...');
    const orderResponse = await fetch(orderUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error('❌ Order failed:', orderResponse.status, errorText);
      throw new Error(`Failed to get Ultra order: ${errorText}`);
    }

    const orderData: any = await orderResponse.json();
    
    console.log('📦 Full Ultra order response:');
    console.log(JSON.stringify(orderData, null, 2));
    
    // Check for any error in the response (Jupiter returns errors in the response body)
    if (orderData.error) {
      const errorMsg = orderData.error;
      console.error('❌ Jupiter Ultra returned error:', errorMsg);
      
      // Check for gas/balance errors
      if (errorMsg.includes('Top up') || 
          errorMsg.includes('SOL for gas') || 
          errorMsg.includes('insufficient') ||
          errorMsg.includes('Insufficient')) {
        // Pass through the actual error message from Jupiter
        throw new Error(`Insufficient SOL: ${errorMsg}`);
      }
      
      // Throw the actual error from Jupiter
      throw new Error(`Jupiter: ${errorMsg}`);
    }
    
    console.log('✅ Order received:', {
      requestId: orderData.requestId,
      feeMint: orderData.feeMint,
      feeBps: orderData.feeBps,
      hasTransaction: !!orderData.transaction,
      transactionLength: orderData.transaction?.length || 0,
    });

    // Check if transaction was returned
    if (!orderData.transaction) {
      console.error('❌ No transaction in Ultra order response');
      throw new Error('Ultra API did not return a transaction. This may indicate an issue with the order or referral setup.');
    }

    // Check if fees are being collected
    if (REFERRAL_ACCOUNT) {
      if (orderData.feeBps === REFERRAL_FEE_BPS) {
        console.log('✅ Fees will be collected in', orderData.feeMint);
      } else {
        console.warn('⚠️ Fee collection may fail - token account not initialized for', orderData.feeMint);
      }
    }

    // Step 2: Deserialize and sign transaction
    console.log('✍️ Signing transaction...');
    const transactionBuf = Buffer.from(orderData.transaction, 'base64');
    const transaction = VersionedTransaction.deserialize(transactionBuf);

    const signedTransaction = await signTransaction(transaction);
    const signedTransactionBase64 = Buffer.from(signedTransaction.serialize()).toString('base64');

    // Step 3: Execute via Ultra API
    console.log('📤 Executing swap via Ultra...');
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
      console.error('❌ Execute failed:', executeResponse.status, errorText);
      throw new Error(`Failed to execute swap: ${errorText}`);
    }

    const executeData = await executeResponse.json();

    if (executeData.status === "Success" && executeData.signature) {
      console.log('✅ Swap executed successfully via Ultra!');
      console.log('🔗 Transaction:', executeData.signature);
      return executeData.signature;
    } else {
      console.error('❌ Swap failed:', executeData);
      throw new Error(executeData.error || 'Swap execution failed');
    }

  } catch (error: any) {
    console.error("❌ Jupiter Ultra swap error:", error);
    throw error;
  }
}