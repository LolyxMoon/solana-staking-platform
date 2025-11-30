import { Connection } from '@solana/web3.js';
import { DexType } from './multi-dex-detector';

// Raydium imports
import {
  addLiquidityToPool as addRaydiumLiquidity,
  removeLiquidityFromPool as removeRaydiumLiquidity,
  calculateLPTokensToReceive as calculateRaydiumLPTokens,
  calculateTokensFromLP as calculateRaydiumTokensFromLP,
  getPoolReserves as getRaydiumPoolReserves,
} from './raydium-liquidity';

// Meteora imports
import {
  addMeteoraLiquidity,
  removeMeteoraLiquidity,
  calculateMeteoraLPTokens,
  calculateMeteoraTokensFromLP,
  getMeteoraPoolReserves,
} from './meteora-liquidity';

// Orca imports
import {
  addOrcaLiquidity,
  removeOrcaLiquidity,
  calculateOrcaLiquidity,
  calculateOrcaTokensFromLiquidity,
  getOrcaPoolReserves,
} from './orca-liquidity';

export interface LiquidityRouterParams {
  dexType: DexType;
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
 * Universal Add Liquidity Router
 * Routes to the correct DEX handler based on dexType
 */
export async function addLiquidity(params: LiquidityRouterParams): Promise<string> {
  const { dexType } = params;

  console.log(`🔀 Routing add liquidity to ${dexType.toUpperCase()}`);

  switch (dexType) {
    case 'raydium':
      return await addRaydiumLiquidity({
        connection: params.connection,
        wallet: params.wallet,
        poolId: params.poolAddress,
        baseTokenMint: params.baseTokenMint,
        quoteTokenMint: params.quoteTokenMint,
        baseAmount: params.baseAmount || 0,
        quoteAmount: params.quoteAmount || 0,
        slippageTolerance: params.slippageTolerance || 1,
      });

    case 'meteora':
      return await addMeteoraLiquidity({
        connection: params.connection,
        wallet: params.wallet,
        poolAddress: params.poolAddress,
        baseTokenMint: params.baseTokenMint,
        quoteTokenMint: params.quoteTokenMint,
        baseAmount: params.baseAmount || 0,
        quoteAmount: params.quoteAmount || 0,
        slippageTolerance: params.slippageTolerance || 1,
      });

    case 'orca':
      return await addOrcaLiquidity({
        connection: params.connection,
        wallet: params.wallet,
        poolAddress: params.poolAddress,
        baseTokenMint: params.baseTokenMint,
        quoteTokenMint: params.quoteTokenMint,
        baseAmount: params.baseAmount || 0,
        quoteAmount: params.quoteAmount || 0,
        slippageTolerance: params.slippageTolerance || 1,
      });

    default:
      throw new Error(`Unsupported DEX type: ${dexType}`);
  }
}

/**
 * Universal Remove Liquidity Router
 * Routes to the correct DEX handler based on dexType
 */
export async function removeLiquidity(params: LiquidityRouterParams): Promise<string> {
  const { dexType } = params;

  console.log(`🔀 Routing remove liquidity to ${dexType.toUpperCase()}`);

  switch (dexType) {
    case 'raydium':
      return await removeRaydiumLiquidity({
        connection: params.connection,
        wallet: params.wallet,
        poolId: params.poolAddress,
        lpAmount: params.lpAmount || 0,
        slippageTolerance: params.slippageTolerance || 1,
      });

    case 'meteora':
      return await removeMeteoraLiquidity({
        connection: params.connection,
        wallet: params.wallet,
        poolAddress: params.poolAddress,
        baseTokenMint: params.baseTokenMint,
        quoteTokenMint: params.quoteTokenMint,
        lpAmount: params.lpAmount || 0,
        slippageTolerance: params.slippageTolerance || 1,
      });

    case 'orca':
      return await removeOrcaLiquidity({
        connection: params.connection,
        wallet: params.wallet,
        poolAddress: params.poolAddress,
        baseTokenMint: params.baseTokenMint,
        quoteTokenMint: params.quoteTokenMint,
        lpAmount: params.lpAmount || 0,
        slippageTolerance: params.slippageTolerance || 1,
      });

    default:
      throw new Error(`Unsupported DEX type: ${dexType}`);
  }
}

/**
 * Universal LP Token Calculator
 * Calculates expected LP tokens based on DEX type
 */
export async function calculateExpectedLPTokens(
  dexType: DexType,
  poolAddress: string,
  baseAmount: number,
  quoteAmount: number,
  connection?: Connection
): Promise<number> {
  console.log(`🧮 Calculating LP tokens for ${dexType.toUpperCase()}`);

  switch (dexType) {
    case 'raydium':
      if (!connection) throw new Error('Connection required for Raydium');
      const raydiumReserves = await getRaydiumPoolReserves(connection, poolAddress);
      return calculateRaydiumLPTokens(
        baseAmount,
        quoteAmount,
        raydiumReserves.baseReserve,
        raydiumReserves.quoteReserve,
        raydiumReserves.lpSupply
      );

    case 'meteora':
      return await calculateMeteoraLPTokens(poolAddress, baseAmount, quoteAmount);

    case 'orca':
      // Orca uses liquidity, not LP tokens
      return await calculateOrcaLiquidity(poolAddress, baseAmount, quoteAmount);

    default:
      throw new Error(`Unsupported DEX type: ${dexType}`);
  }
}

/**
 * Universal Token Amount Calculator
 * Calculates expected token amounts from LP tokens based on DEX type
 */
export async function calculateExpectedTokens(
  dexType: DexType,
  poolAddress: string,
  lpAmount: number,
  connection?: Connection
): Promise<{ baseAmount: number; quoteAmount: number }> {
  console.log(`🧮 Calculating token amounts for ${dexType.toUpperCase()}`);

  switch (dexType) {
    case 'raydium':
      if (!connection) throw new Error('Connection required for Raydium');
      const raydiumReserves = await getRaydiumPoolReserves(connection, poolAddress);
      return calculateRaydiumTokensFromLP(
        lpAmount,
        raydiumReserves.baseReserve,
        raydiumReserves.quoteReserve,
        raydiumReserves.lpSupply
      );

    case 'meteora':
      return await calculateMeteoraTokensFromLP(poolAddress, lpAmount);

    case 'orca':
      // Orca uses liquidity positions
      return await calculateOrcaTokensFromLiquidity(poolAddress, lpAmount);

    default:
      throw new Error(`Unsupported DEX type: ${dexType}`);
  }
}

/**
 * Universal Pool Reserves Fetcher
 * Gets pool reserves based on DEX type
 */
export async function getPoolReserves(
  dexType: DexType,
  poolAddress: string,
  connection?: Connection
): Promise<{
  baseReserve: number;
  quoteReserve: number;
  lpSupply?: number;
  totalLiquidity?: number;
  ratio: number;
  currentPrice?: number;
}> {
  console.log(`📊 Fetching pool reserves for ${dexType.toUpperCase()}`);

  switch (dexType) {
    case 'raydium':
      if (!connection) throw new Error('Connection required for Raydium');
      const raydiumReserves = await getRaydiumPoolReserves(connection, poolAddress);
      return {
        baseReserve: raydiumReserves.baseReserve,
        quoteReserve: raydiumReserves.quoteReserve,
        lpSupply: raydiumReserves.lpSupply,
        ratio: raydiumReserves.ratio,
      };

    case 'meteora':
      const meteoraReserves = await getMeteoraPoolReserves(poolAddress);
      return {
        baseReserve: meteoraReserves.baseReserve,
        quoteReserve: meteoraReserves.quoteReserve,
        lpSupply: meteoraReserves.lpSupply,
        ratio: meteoraReserves.ratio,
      };

    case 'orca':
      const orcaReserves = await getOrcaPoolReserves(poolAddress);
      return {
        baseReserve: orcaReserves.baseReserve,
        quoteReserve: orcaReserves.quoteReserve,
        totalLiquidity: orcaReserves.totalLiquidity,
        ratio: orcaReserves.baseReserve / orcaReserves.quoteReserve || 0,
        currentPrice: orcaReserves.currentPrice,
      };

    default:
      throw new Error(`Unsupported DEX type: ${dexType}`);
  }
}

/**
 * Check if DEX supports direct liquidity management
 * Returns true if we can execute transactions, false if user should use DEX UI
 */
export function isDexSupported(dexType: DexType): {
  supported: boolean;
  canAdd: boolean;
  canRemove: boolean;
  message?: string;
  dexUrl?: string;
} {
  switch (dexType) {
    case 'raydium':
      return {
        supported: true,
        canAdd: true,
        canRemove: true,
      };

    case 'meteora':
      return {
        supported: false,
        canAdd: false,
        canRemove: false,
        message: 'Meteora pools require specialized SDKs. Please use Meteora\'s UI.',
        dexUrl: 'https://app.meteora.ag',
      };

    case 'orca':
      return {
        supported: false,
        canAdd: false,
        canRemove: false,
        message: 'Orca Whirlpools use concentrated liquidity positions. Please use Orca\'s UI.',
        dexUrl: 'https://www.orca.so',
      };

    default:
      return {
        supported: false,
        canAdd: false,
        canRemove: false,
        message: 'Unknown DEX type',
      };
  }
}

/**
 * Get DEX display information
 */
export function getDexInfo(dexType: DexType): {
  name: string;
  displayName: string;
  icon: string;
  color: string;
  url: string;
} {
  switch (dexType) {
    case 'raydium':
      return {
        name: 'raydium',
        displayName: 'Raydium',
        icon: '⚡',
        color: '#8c2df7',
        url: 'https://raydium.io',
      };

    case 'meteora':
      return {
        name: 'meteora',
        displayName: 'Meteora',
        icon: '☄️',
        color: '#9945FF',
        url: 'https://app.meteora.ag',
      };

    case 'orca':
      return {
        name: 'orca',
        displayName: 'Orca',
        icon: '🐋',
        color: '#FFD512',
        url: 'https://www.orca.so',
      };

    default:
      return {
        name: 'unknown',
        displayName: 'Unknown DEX',
        icon: '❓',
        color: '#888888',
        url: '#',
      };
  }
}

/**
 * Validate liquidity amounts based on DEX requirements
 */
export async function validateLiquidityAmounts(
  dexType: DexType,
  poolAddress: string,
  baseAmount: number,
  quoteAmount: number,
  connection?: Connection
): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    if (baseAmount <= 0 || quoteAmount <= 0) {
      return {
        valid: false,
        error: 'Both token amounts must be greater than 0',
      };
    }

    const reserves = await getPoolReserves(dexType, poolAddress, connection);
    const expectedRatio = reserves.ratio;
    const inputRatio = baseAmount / quoteAmount;

    // Allow 5% deviation from pool ratio
    const maxDeviation = 0.05;
    const ratioDeviation = Math.abs(inputRatio - expectedRatio) / expectedRatio;

    if (ratioDeviation > maxDeviation) {
      return {
        valid: false,
        error: `Token ratio deviates too much from pool ratio. Expected ~${expectedRatio.toFixed(4)}, got ${inputRatio.toFixed(4)}`,
      };
    }

    return { valid: true };

  } catch (error) {
    return {
      valid: false,
      error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}