import { Connection, PublicKey } from '@solana/web3.js';

export type DexType = 'raydium' | 'meteora' | 'orca';

export interface DexPoolInfo {
  dexType: DexType;
  poolAddress: string;
  poolData: any;
  liquidity?: number;
}

/**
 * Auto-detect which DEX(s) have pools for a given LP token
 * Returns all found pools sorted by liquidity (highest first)
 */
export async function detectLPTokenDex(lpTokenMint: string): Promise<DexPoolInfo[]> {
  console.log('🔍 Auto-detecting DEX for LP token:', lpTokenMint);

  const foundPools: DexPoolInfo[] = [];

  // Check Raydium
  try {
    const raydiumPool = await detectRaydiumPool(lpTokenMint);
    if (raydiumPool) {
      foundPools.push(raydiumPool);
      console.log('✅ Found Raydium pool:', raydiumPool.poolAddress);
    }
  } catch (error) {
    console.log('⚠️ Raydium check failed:', error);
  }

  // Check Meteora
  try {
    const meteoraPool = await detectMeteoraPool(lpTokenMint);
    if (meteoraPool) {
      foundPools.push(meteoraPool);
      console.log('✅ Found Meteora pool:', meteoraPool.poolAddress);
    }
  } catch (error) {
    console.log('⚠️ Meteora check failed:', error);
  }

  // Check Orca
  try {
    const orcaPool = await detectOrcaPool(lpTokenMint);
    if (orcaPool) {
      foundPools.push(orcaPool);
      console.log('✅ Found Orca pool:', orcaPool.poolAddress);
    }
  } catch (error) {
    console.log('⚠️ Orca check failed:', error);
  }

  // Sort by liquidity (highest first)
  foundPools.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));

  console.log(`🎯 Found ${foundPools.length} total pool(s)`);

  return foundPools;
}

/**
 * Detect Raydium pool
 */
async function detectRaydiumPool(lpTokenMint: string): Promise<DexPoolInfo | null> {
  try {
    const response = await fetch('https://api.raydium.io/v2/sdk/liquidity/mainnet.json');
    
    if (!response.ok) {
      throw new Error(`Raydium API error: ${response.status}`);
    }

    const data = await response.json();
    const pools = data.official || [];

    const matchingPools = pools.filter((pool: any) => 
      pool.lpMint.toLowerCase() === lpTokenMint.toLowerCase()
    );

    if (matchingPools.length === 0) {
      return null;
    }

    // Get pool with highest liquidity
    let selectedPool = matchingPools[0];
    
    if (matchingPools.length > 1) {
      const poolsWithLiquidity = await Promise.all(
        matchingPools.map(async (pool: any) => {
          try {
            const infoResponse = await fetch(`https://api.raydium.io/v2/ammV3/ammPools?pool_id=${pool.id}`);
            const infoData = await infoResponse.json();
            const liquidity = infoData.data?.[0]?.tvl || 0;
            return { ...pool, liquidity };
          } catch (error) {
            return { ...pool, liquidity: 0 };
          }
        })
      );

      poolsWithLiquidity.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
      selectedPool = poolsWithLiquidity[0];
    }

    return {
      dexType: 'raydium',
      poolAddress: selectedPool.id,
      poolData: selectedPool,
      liquidity: selectedPool.liquidity,
    };

  } catch (error) {
    console.error('Raydium detection error:', error);
    return null;
  }
}

/**
 * Detect Meteora pool
 */
async function detectMeteoraPool(lpTokenMint: string): Promise<DexPoolInfo | null> {
  try {
    // Meteora has multiple pool types: DLMM (Dynamic), Classic AMM, Multi-token
    
    // Try DLMM pools first
    const dlmmResponse = await fetch('https://dlmm-api.meteora.ag/pair/all');
    
    if (dlmmResponse.ok) {
      const dlmmData = await dlmmResponse.json();
      
      for (const pool of dlmmData.groups || []) {
        for (const pair of pool.pairs || []) {
          if (pair.lp_mint && pair.lp_mint.toLowerCase() === lpTokenMint.toLowerCase()) {
            return {
              dexType: 'meteora',
              poolAddress: pair.address,
              poolData: pair,
              liquidity: parseFloat(pair.liquidity || 0),
            };
          }
        }
      }
    }

    // Try Classic AMM pools
    const ammResponse = await fetch('https://amm-v2.meteora.ag/pools');
    
    if (ammResponse.ok) {
      const ammData = await ammResponse.json();
      
      for (const pool of ammData || []) {
        if (pool.lp_mint && pool.lp_mint.toLowerCase() === lpTokenMint.toLowerCase()) {
          return {
            dexType: 'meteora',
            poolAddress: pool.pool_address,
            poolData: pool,
            liquidity: parseFloat(pool.pool_tvl || 0),
          };
        }
      }
    }

    return null;

  } catch (error) {
    console.error('Meteora detection error:', error);
    return null;
  }
}

/**
 * Detect Orca pool (Whirlpools)
 */
async function detectOrcaPool(lpTokenMint: string): Promise<DexPoolInfo | null> {
  try {
    // Orca uses Whirlpools - fetch from their API
    const response = await fetch('https://api.mainnet.orca.so/v1/whirlpool/list');
    
    if (!response.ok) {
      throw new Error(`Orca API error: ${response.status}`);
    }

    const data = await response.json();
    const whirlpools = data.whirlpools || [];

    for (const pool of whirlpools) {
      // Orca doesn't directly expose LP mint in the same way
      // We need to check if this is a match based on token pair
      // This is a simplified check - may need adjustment
      if (pool.address && pool.tokenA && pool.tokenB) {
        // You might need to derive the LP mint or use a different matching strategy
        // For now, we'll return null and handle Orca separately
        // TODO: Implement proper Orca LP token matching
      }
    }

    return null;

  } catch (error) {
    console.error('Orca detection error:', error);
    return null;
  }
}

/**
 * Validate a pool address for a specific DEX
 */
export async function validateDexPoolAddress(
  poolAddress: string,
  dexType: DexType
): Promise<boolean> {
  try {
    new PublicKey(poolAddress); // Validate it's a valid Solana address

    switch (dexType) {
      case 'raydium':
        return await validateRaydiumPool(poolAddress);
      case 'meteora':
        return await validateMeteoraPool(poolAddress);
      case 'orca':
        return await validateOrcaPool(poolAddress);
      default:
        return false;
    }
  } catch (error) {
    return false;
  }
}

async function validateRaydiumPool(poolAddress: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.raydium.io/v2/sdk/liquidity/mainnet.json');
    if (!response.ok) return false;
    
    const data = await response.json();
    const pools = data.official || [];
    
    return pools.some((p: any) => p.id === poolAddress);
  } catch (error) {
    return false;
  }
}

async function validateMeteoraPool(poolAddress: string): Promise<boolean> {
  try {
    // Check DLMM
    const dlmmResponse = await fetch(`https://dlmm-api.meteora.ag/pair/${poolAddress}`);
    if (dlmmResponse.ok) return true;

    // Check AMM
    const ammResponse = await fetch('https://amm-v2.meteora.ag/pools');
    if (ammResponse.ok) {
      const pools = await ammResponse.json();
      return pools.some((p: any) => p.pool_address === poolAddress);
    }

    return false;
  } catch (error) {
    return false;
  }
}

async function validateOrcaPool(poolAddress: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.mainnet.orca.so/v1/whirlpool/list');
    if (!response.ok) return false;
    
    const data = await response.json();
    const whirlpools = data.whirlpools || [];
    
    return whirlpools.some((p: any) => p.address === poolAddress);
  } catch (error) {
    return false;
  }
}

/**
 * Get pool info for a specific DEX pool
 */
export async function getDexPoolInfo(
  poolAddress: string,
  dexType: DexType
): Promise<any> {
  switch (dexType) {
    case 'raydium':
      return await getRaydiumPoolInfo(poolAddress);
    case 'meteora':
      return await getMeteoraPoolInfo(poolAddress);
    case 'orca':
      return await getOrcaPoolInfo(poolAddress);
    default:
      throw new Error(`Unsupported DEX type: ${dexType}`);
  }
}

async function getRaydiumPoolInfo(poolAddress: string): Promise<any> {
  const response = await fetch('https://api.raydium.io/v2/sdk/liquidity/mainnet.json');
  const data = await response.json();
  const pools = data.official || [];
  return pools.find((p: any) => p.id === poolAddress);
}

async function getMeteoraPoolInfo(poolAddress: string): Promise<any> {
  // Try DLMM first
  try {
    const dlmmResponse = await fetch(`https://dlmm-api.meteora.ag/pair/${poolAddress}`);
    if (dlmmResponse.ok) {
      return await dlmmResponse.json();
    }
  } catch (error) {
    // Continue to AMM check
  }

  // Try AMM
  const ammResponse = await fetch('https://amm-v2.meteora.ag/pools');
  const pools = await ammResponse.json();
  return pools.find((p: any) => p.pool_address === poolAddress);
}

async function getOrcaPoolInfo(poolAddress: string): Promise<any> {
  const response = await fetch('https://api.mainnet.orca.so/v1/whirlpool/list');
  const data = await response.json();
  const whirlpools = data.whirlpools || [];
  return whirlpools.find((p: any) => p.address === poolAddress);
}