import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { Liquidity, LiquidityPoolKeys, TokenAmount, Token, Percent, Currency } from '@raydium-io/raydium-sdk';
import BN from 'bn.js';

/**
 * Calculate expected LP tokens to receive when adding liquidity
 */
export function calculateLPTokensToReceive(
  baseAmount: number,
  quoteAmount: number,
  baseReserve: number,
  quoteReserve: number,
  lpSupply: number
): number {
  if (lpSupply === 0) {
    // Initial liquidity
    return Math.sqrt(baseAmount * quoteAmount);
  }

  // Proportional liquidity
  const baseRatio = baseAmount / baseReserve;
  const quoteRatio = quoteAmount / quoteReserve;
  
  // Use the smaller ratio to calculate LP tokens
  const ratio = Math.min(baseRatio, quoteRatio);
  
  return lpSupply * ratio;
}

/**
 * Calculate expected tokens to receive when removing liquidity
 */
export function calculateTokensFromLP(
  lpAmount: number,
  baseReserve: number,
  quoteReserve: number,
  lpSupply: number
): { baseAmount: number; quoteAmount: number } {
  const ratio = lpAmount / lpSupply;
  
  return {
    baseAmount: baseReserve * ratio,
    quoteAmount: quoteReserve * ratio,
  };
}

/**
 * Build LiquidityPoolKeys from pool info
 */
function buildPoolKeys(poolInfo: any): LiquidityPoolKeys {
  return {
    id: new PublicKey(poolInfo.id),
    baseMint: new PublicKey(poolInfo.baseMint),
    quoteMint: new PublicKey(poolInfo.quoteMint),
    lpMint: new PublicKey(poolInfo.lpMint),
    baseDecimals: poolInfo.baseDecimals,
    quoteDecimals: poolInfo.quoteDecimals,
    lpDecimals: poolInfo.lpDecimals,
    version: poolInfo.version,
    programId: new PublicKey(poolInfo.programId),
    authority: new PublicKey(poolInfo.authority),
    openOrders: new PublicKey(poolInfo.openOrders),
    targetOrders: new PublicKey(poolInfo.targetOrders),
    baseVault: new PublicKey(poolInfo.baseVault),
    quoteVault: new PublicKey(poolInfo.quoteVault),
    withdrawQueue: new PublicKey(poolInfo.withdrawQueue),
    lpVault: new PublicKey(poolInfo.lpVault),
    marketVersion: poolInfo.marketVersion,
    marketProgramId: new PublicKey(poolInfo.marketProgramId),
    marketId: new PublicKey(poolInfo.marketId),
    marketAuthority: new PublicKey(poolInfo.marketAuthority),
    marketBaseVault: new PublicKey(poolInfo.marketBaseVault),
    marketQuoteVault: new PublicKey(poolInfo.marketQuoteVault),
    marketBids: new PublicKey(poolInfo.marketBids),
    marketAsks: new PublicKey(poolInfo.marketAsks),
    marketEventQueue: new PublicKey(poolInfo.marketEventQueue),
    lookupTableAccount: poolInfo.lookupTableAccount ? new PublicKey(poolInfo.lookupTableAccount) : PublicKey.default,
  };
}

/**
 * Add liquidity to a Raydium pool
 */
export async function addLiquidityToPool(
  connection: Connection,
  walletPubkey: PublicKey,
  poolAddress: string,
  poolInfo: any,
  baseAmount: number,
  quoteAmount: number,
  slippageBps: number,
  signTransaction: any
): Promise<string> {
  try {
    console.log('💦 Starting add liquidity transaction...', {
      pool: poolAddress,
      baseAmount,
      quoteAmount,
      slippage: slippageBps,
    });

    const poolKeys = buildPoolKeys(poolInfo);

    // Create Token instances
    const baseToken = new Token(TOKEN_PROGRAM_ID, poolKeys.baseMint, poolKeys.baseDecimals);
    const quoteToken = new Token(TOKEN_PROGRAM_ID, poolKeys.quoteMint, poolKeys.quoteDecimals);

    // Convert amounts to BN with proper decimals
    const baseAmountBN = new BN(baseAmount * Math.pow(10, poolKeys.baseDecimals));
    const quoteAmountBN = new BN(quoteAmount * Math.pow(10, poolKeys.quoteDecimals));

    // Get user's token accounts
    const userBaseAccount = await getAssociatedTokenAddress(poolKeys.baseMint, walletPubkey);
    const userQuoteAccount = await getAssociatedTokenAddress(poolKeys.quoteMint, walletPubkey);
    const userLpAccount = await getAssociatedTokenAddress(poolKeys.lpMint, walletPubkey);

    // Check if LP account exists, create if not
    const transaction = new Transaction();
    const lpAccountInfo = await connection.getAccountInfo(userLpAccount);

    if (!lpAccountInfo) {
      console.log('Creating LP token account...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          walletPubkey,
          userLpAccount,
          walletPubkey,
          poolKeys.lpMint
        )
      );
    }

    // Create add liquidity instruction
    const { innerTransactions } = await Liquidity.makeAddLiquidityInstructionSimple({
      connection,
      poolKeys,
      userKeys: {
        owner: walletPubkey,
        baseTokenAccount: userBaseAccount,
        quoteTokenAccount: userQuoteAccount,
        lpTokenAccount: userLpAccount,
      },
      amountInA: new TokenAmount(baseToken, baseAmountBN),
      amountInB: new TokenAmount(quoteToken, quoteAmountBN),
      fixedSide: 'a',
      config: {
        bypassAssociatedCheck: false,
      },
    });

    // Add instructions to transaction
    innerTransactions.forEach((innerTx) => {
      innerTx.instructions.forEach((instruction) => {
        transaction.add(instruction);
      });
    });

    // Send transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPubkey;

    console.log('Signing transaction...');
    const signedTx = await signTransaction(transaction);
    
    console.log('Sending transaction...');
    const txSignature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    console.log('Confirming transaction...');
    await connection.confirmTransaction(txSignature, 'confirmed');

    console.log('✅ Add liquidity successful! TX:', txSignature);
    return txSignature;

  } catch (error: any) {
    console.error('❌ Add liquidity error:', error);
    throw new Error(error.message || 'Failed to add liquidity');
  }
}

/**
 * Remove liquidity from a Raydium pool
 */
export async function removeLiquidityFromPool(
  connection: Connection,
  walletPubkey: PublicKey,
  poolAddress: string,
  poolInfo: any,
  lpAmount: number,
  slippageBps: number,
  signTransaction: any
): Promise<string> {
  try {
    console.log('💧 Starting remove liquidity transaction...', {
      pool: poolAddress,
      lpAmount,
      slippage: slippageBps,
    });

    const poolKeys = buildPoolKeys(poolInfo);

    // Create LP Token instance
    const lpToken = new Token(TOKEN_PROGRAM_ID, poolKeys.lpMint, poolKeys.lpDecimals);

    // Convert LP amount to BN with proper decimals
    const lpAmountBN = new BN(lpAmount * Math.pow(10, poolKeys.lpDecimals));

    // Get user's token accounts
    const userBaseAccount = await getAssociatedTokenAddress(poolKeys.baseMint, walletPubkey);
    const userQuoteAccount = await getAssociatedTokenAddress(poolKeys.quoteMint, walletPubkey);
    const userLpAccount = await getAssociatedTokenAddress(poolKeys.lpMint, walletPubkey);

    const transaction = new Transaction();

    // Check if base token account exists, create if not
    const baseAccountInfo = await connection.getAccountInfo(userBaseAccount);
    if (!baseAccountInfo) {
      console.log('Creating base token account...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          walletPubkey,
          userBaseAccount,
          walletPubkey,
          poolKeys.baseMint
        )
      );
    }

    // Check if quote token account exists, create if not
    const quoteAccountInfo = await connection.getAccountInfo(userQuoteAccount);
    if (!quoteAccountInfo) {
      console.log('Creating quote token account...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          walletPubkey,
          userQuoteAccount,
          walletPubkey,
          poolKeys.quoteMint
        )
      );
    }

    // Create remove liquidity instruction
    const { innerTransactions } = await Liquidity.makeRemoveLiquidityInstructionSimple({
      connection,
      poolKeys,
      userKeys: {
        owner: walletPubkey,
        baseTokenAccount: userBaseAccount,
        quoteTokenAccount: userQuoteAccount,
        lpTokenAccount: userLpAccount,
      },
      amountIn: new TokenAmount(lpToken, lpAmountBN),
      config: {
        bypassAssociatedCheck: false,
      },
    });

    // Add instructions to transaction
    innerTransactions.forEach((innerTx) => {
      innerTx.instructions.forEach((instruction) => {
        transaction.add(instruction);
      });
    });

    // Send transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletPubkey;

    console.log('Signing transaction...');
    const signedTx = await signTransaction(transaction);
    
    console.log('Sending transaction...');
    const txSignature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    console.log('Confirming transaction...');
    await connection.confirmTransaction(txSignature, 'confirmed');

    console.log('✅ Remove liquidity successful! TX:', txSignature);
    return txSignature;

  } catch (error: any) {
    console.error('❌ Remove liquidity error:', error);
    throw new Error(error.message || 'Failed to remove liquidity');
  }
}

/**
 * Get pool price impact for a given amount
 */
export function calculatePriceImpact(
  amountIn: number,
  reserveIn: number,
  reserveOut: number
): number {
  const constantProduct = reserveIn * reserveOut;
  const newReserveIn = reserveIn + amountIn;
  const newReserveOut = constantProduct / newReserveIn;
  
  const amountOut = reserveOut - newReserveOut;
  const effectivePrice = amountIn / amountOut;
  const currentPrice = reserveIn / reserveOut;
  
  const priceImpact = ((effectivePrice - currentPrice) / currentPrice) * 100;
  
  return Math.abs(priceImpact);
}

/**
 * Validate liquidity amounts against pool reserves
 */
export function validateLiquidityAmounts(
  baseAmount: number,
  quoteAmount: number,
  baseReserve: number,
  quoteReserve: number,
  slippageBps: number
): { valid: boolean; error?: string } {
  if (baseAmount <= 0 || quoteAmount <= 0) {
    return { valid: false, error: 'Amounts must be greater than 0' };
  }

  // Check ratio
  const expectedRatio = baseReserve / quoteReserve;
  const providedRatio = baseAmount / quoteAmount;
  
  const ratioDifference = Math.abs(expectedRatio - providedRatio) / expectedRatio;
  const maxRatioDifference = slippageBps / 10000;

  if (ratioDifference > maxRatioDifference) {
    return { 
      valid: false, 
      error: `Ratio mismatch. Expected ~${expectedRatio.toFixed(6)}, got ${providedRatio.toFixed(6)}` 
    };
  }

  return { valid: true };
}