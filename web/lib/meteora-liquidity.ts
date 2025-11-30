import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';

export interface MeteoraLiquidityParams {
  connection: Connection;
  wallet: any;
  poolAddress: string;
  baseTokenMint: string;
  quoteTokenMint: string;
  baseAmount?: number;
  quoteAmount?: number;
  lpAmount?: number;
  slippageTolerance?: number;
}

/**
 * Add liquidity to Meteora pool (DLMM or AMM)
 */
export async function addMeteoraLiquidity(params: MeteoraLiquidityParams): Promise<string> {
  const {
    connection,
    wallet,
    poolAddress,
    baseTokenMint,
    quoteTokenMint,
    baseAmount = 0,
    quoteAmount = 0,
    slippageTolerance = 1,
  } = params;

  console.log('🌊 Adding liquidity to Meteora pool:', poolAddress);

  try {
    // Determine pool type (DLMM vs AMM)
    const poolType = await getMeteoraPoolType(poolAddress);

    if (poolType === 'dlmm') {
      return await addDLMMLiquidity(params);
    } else if (poolType === 'amm') {
      return await addAMMLiquidity(params);
    } else {
      throw new Error('Unknown Meteora pool type');
    }

  } catch (error) {
    console.error('❌ Meteora add liquidity error:', error);
    throw error;
  }
}

/**
 * Remove liquidity from Meteora pool
 */
export async function removeMeteoraLiquidity(params: MeteoraLiquidityParams): Promise<string> {
  const {
    connection,
    wallet,
    poolAddress,
    lpAmount = 0,
  } = params;

  console.log('🌊 Removing liquidity from Meteora pool:', poolAddress);

  try {
    const poolType = await getMeteoraPoolType(poolAddress);

    if (poolType === 'dlmm') {
      return await removeDLMMLiquidity(params);
    } else if (poolType === 'amm') {
      return await removeAMMLiquidity(params);
    } else {
      throw new Error('Unknown Meteora pool type');
    }

  } catch (error) {
    console.error('❌ Meteora remove liquidity error:', error);
    throw error;
  }
}

/**
 * Determine if pool is DLMM or AMM
 */
async function getMeteoraPoolType(poolAddress: string): Promise<'dlmm' | 'amm' | null> {
  try {
    // Check DLMM
    const dlmmResponse = await fetch(`https://dlmm-api.meteora.ag/pair/${poolAddress}`);
    if (dlmmResponse.ok) {
      return 'dlmm';
    }

    // Check AMM
    const ammResponse = await fetch('https://amm-v2.meteora.ag/pools');
    if (ammResponse.ok) {
      const pools = await ammResponse.json();
      const isAMM = pools.some((p: any) => p.pool_address === poolAddress);
      if (isAMM) return 'amm';
    }

    return null;
  } catch (error) {
    console.error('Error detecting Meteora pool type:', error);
    return null;
  }
}

/**
 * Add liquidity to DLMM pool
 */
async function addDLMMLiquidity(params: MeteoraLiquidityParams): Promise<string> {
  const {
    connection,
    wallet,
    poolAddress,
    baseTokenMint,
    quoteTokenMint,
    baseAmount = 0,
    quoteAmount = 0,
    slippageTolerance = 1,
  } = params;

  // Fetch DLMM pool data
  const poolResponse = await fetch(`https://dlmm-api.meteora.ag/pair/${poolAddress}`);
  const poolData = await poolResponse.json();

  const userPublicKey = wallet.publicKey;
  const poolPubkey = new PublicKey(poolAddress);
  const baseTokenPubkey = new PublicKey(baseTokenMint);
  const quoteTokenPubkey = new PublicKey(quoteTokenMint);

  // Get user token accounts
  const userBaseATA = await getAssociatedTokenAddress(baseTokenPubkey, userPublicKey);
  const userQuoteATA = await getAssociatedTokenAddress(quoteTokenPubkey, userPublicKey);

  // Get LP token mint
  const lpMint = new PublicKey(poolData.lp_mint);
  const userLPATA = await getAssociatedTokenAddress(lpMint, userPublicKey);

  const transaction = new Transaction();

  // Create LP token account if needed
  const lpAccountInfo = await connection.getAccountInfo(userLPATA);
  if (!lpAccountInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        userPublicKey,
        userLPATA,
        userPublicKey,
        lpMint
      )
    );
  }

  // DLMM uses a different instruction structure than standard AMM
  // For now, we'll throw an error directing users to use Meteora UI
  throw new Error(
    'DLMM pools require specialized handling. Please use Meteora\'s UI at https://app.meteora.ag for DLMM pools.'
  );

  // Note: Full DLMM implementation would require:
  // 1. @meteora-ag/dlmm SDK installation
  // 2. Position management (bins, price ranges)
  // 3. Different instruction building
  // This is complex and beyond basic liquidity add/remove
}

/**
 * Add liquidity to AMM pool (Classic Meteora)
 */
async function addAMMLiquidity(params: MeteoraLiquidityParams): Promise<string> {
  const {
    connection,
    wallet,
    poolAddress,
    baseTokenMint,
    quoteTokenMint,
    baseAmount = 0,
    quoteAmount = 0,
    slippageTolerance = 1,
  } = params;

  const userPublicKey = wallet.publicKey;
  const poolPubkey = new PublicKey(poolAddress);
  const baseTokenPubkey = new PublicKey(baseTokenMint);
  const quoteTokenPubkey = new PublicKey(quoteTokenMint);

  // Get pool data
  const poolsResponse = await fetch('https://amm-v2.meteora.ag/pools');
  const pools = await poolsResponse.json();
  const poolData = pools.find((p: any) => p.pool_address === poolAddress);

  if (!poolData) {
    throw new Error('Pool not found');
  }

  // Get user token accounts
  const userBaseATA = await getAssociatedTokenAddress(baseTokenPubkey, userPublicKey);
  const userQuoteATA = await getAssociatedTokenAddress(quoteTokenPubkey, userPublicKey);

  // Get LP token mint
  const lpMint = new PublicKey(poolData.lp_mint);
  const userLPATA = await getAssociatedTokenAddress(lpMint, userPublicKey);

  const transaction = new Transaction();

  // Create LP token account if needed
  const lpAccountInfo = await connection.getAccountInfo(userLPATA);
  if (!lpAccountInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        userPublicKey,
        userLPATA,
        userPublicKey,
        lpMint
      )
    );
  }

  // Note: Meteora AMM requires the Meteora SDK for proper instruction building
  // For production, install: npm install @mercurial-finance/stable-swap-sdk
  throw new Error(
    'Meteora AMM pools require the @mercurial-finance/stable-swap-sdk. Please use Meteora\'s UI at https://app.meteora.ag'
  );

  // Placeholder for actual implementation:
  // const addLiquidityIx = await buildMeteoraAddLiquidityInstruction({...});
  // transaction.add(addLiquidityIx);
}

/**
 * Remove liquidity from DLMM pool
 */
async function removeDLMMLiquidity(params: MeteoraLiquidityParams): Promise<string> {
  throw new Error(
    'DLMM pools require specialized handling. Please use Meteora\'s UI at https://app.meteora.ag for DLMM pools.'
  );
}

/**
 * Remove liquidity from AMM pool
 */
async function removeAMMLiquidity(params: MeteoraLiquidityParams): Promise<string> {
  throw new Error(
    'Meteora AMM pools require the @mercurial-finance/stable-swap-sdk. Please use Meteora\'s UI at https://app.meteora.ag'
  );
}

/**
 * Calculate expected LP tokens for AMM pool
 */
export async function calculateMeteoraLPTokens(
  poolAddress: string,
  baseAmount: number,
  quoteAmount: number
): Promise<number> {
  try {
    const poolsResponse = await fetch('https://amm-v2.meteora.ag/pools');
    const pools = await poolsResponse.json();
    const poolData = pools.find((p: any) => p.pool_address === poolAddress);

    if (!poolData) {
      throw new Error('Pool not found');
    }

    // Basic calculation (simplified)
    const baseReserve = parseFloat(poolData.token_a_amount || 0);
    const quoteReserve = parseFloat(poolData.token_b_amount || 0);
    const lpSupply = parseFloat(poolData.lp_supply || 0);

    if (lpSupply === 0) {
      return Math.sqrt(baseAmount * quoteAmount);
    }

    const baseLPAmount = (baseAmount / baseReserve) * lpSupply;
    const quoteLPAmount = (quoteAmount / quoteReserve) * lpSupply;

    return Math.min(baseLPAmount, quoteLPAmount);

  } catch (error) {
    console.error('Error calculating Meteora LP tokens:', error);
    return 0;
  }
}

/**
 * Calculate expected tokens from LP amount for AMM pool
 */
export async function calculateMeteoraTokensFromLP(
  poolAddress: string,
  lpAmount: number
): Promise<{ baseAmount: number; quoteAmount: number }> {
  try {
    const poolsResponse = await fetch('https://amm-v2.meteora.ag/pools');
    const pools = await poolsResponse.json();
    const poolData = pools.find((p: any) => p.pool_address === poolAddress);

    if (!poolData) {
      throw new Error('Pool not found');
    }

    const baseReserve = parseFloat(poolData.token_a_amount || 0);
    const quoteReserve = parseFloat(poolData.token_b_amount || 0);
    const lpSupply = parseFloat(poolData.lp_supply || 0);

    const shareRatio = lpAmount / lpSupply;

    return {
      baseAmount: baseReserve * shareRatio,
      quoteAmount: quoteReserve * shareRatio,
    };

  } catch (error) {
    console.error('Error calculating tokens from Meteora LP:', error);
    return { baseAmount: 0, quoteAmount: 0 };
  }
}

/**
 * Get Meteora pool reserves
 */
export async function getMeteoraPoolReserves(poolAddress: string): Promise<{
  baseReserve: number;
  quoteReserve: number;
  lpSupply: number;
  ratio: number;
}> {
  try {
    const poolType = await getMeteoraPoolType(poolAddress);

    if (poolType === 'dlmm') {
      const response = await fetch(`https://dlmm-api.meteora.ag/pair/${poolAddress}`);
      const poolData = await response.json();

      const baseReserve = parseFloat(poolData.reserve_x || 0);
      const quoteReserve = parseFloat(poolData.reserve_y || 0);
      const lpSupply = parseFloat(poolData.supply || 0);

      return {
        baseReserve,
        quoteReserve,
        lpSupply,
        ratio: baseReserve / quoteReserve,
      };
    } else {
      const response = await fetch('https://amm-v2.meteora.ag/pools');
      const pools = await response.json();
      const poolData = pools.find((p: any) => p.pool_address === poolAddress);

      if (!poolData) {
        throw new Error('Pool not found');
      }

      const baseReserve = parseFloat(poolData.token_a_amount || 0);
      const quoteReserve = parseFloat(poolData.token_b_amount || 0);
      const lpSupply = parseFloat(poolData.lp_supply || 0);

      return {
        baseReserve,
        quoteReserve,
        lpSupply,
        ratio: baseReserve / quoteReserve,
      };
    }

  } catch (error) {
    console.error('Error getting Meteora pool reserves:', error);
    return {
      baseReserve: 0,
      quoteReserve: 0,
      lpSupply: 0,
      ratio: 0,
    };
  }
}