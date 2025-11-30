import { Connection, PublicKey } from '@solana/web3.js';

interface RaydiumPool {
  id: string;
  baseMint: string;
  quoteMint: string;
  lpMint: string;
  baseDecimals: number;
  quoteDecimals: number;
  lpDecimals: number;
  version: number;
  programId: string;
  authority: string;
  openOrders: string;
  targetOrders: string;
  baseVault: string;
  quoteVault: string;
  withdrawQueue: string;
  lpVault: string;
  marketVersion: number;
  marketProgramId: string;
  marketId: string;
  marketAuthority: string;
  marketBaseVault: string;
  marketQuoteVault: string;
  marketBids: string;
  marketAsks: string;
  marketEventQueue: string;
  lookupTableAccount: string;
  liquidity?: number;
}

/**
 * Find Raydium pool by LP token mint address
 * Returns the pool with highest liquidity
 */
export async function findRaydiumPoolByLPToken(
  lpTokenMint: string
): Promise<{ poolAddress: string; poolInfo: RaydiumPool } | null> {
  try {
    console.log('🔍 Searching for Raydium pool with LP token:', lpTokenMint);

    // Query Raydium API for all pools
    const response = await fetch('https://api.raydium.io/v2/sdk/liquidity/mainnet.json');
    
    if (!response.ok) {
      throw new Error(`Raydium API error: ${response.status}`);
    }

    const data = await response.json();
    const pools = data.official || [];

    console.log(`📊 Found ${pools.length} total Raydium pools`);

    // Find all pools matching the LP token
    const matchingPools = pools.filter((pool: RaydiumPool) => 
      pool.lpMint.toLowerCase() === lpTokenMint.toLowerCase()
    );

    if (matchingPools.length === 0) {
      console.log('❌ No Raydium pool found for LP token:', lpTokenMint);
      return null;
    }

    console.log(`✅ Found ${matchingPools.length} matching pool(s)`);

    // If multiple pools, select the one with highest liquidity
    let selectedPool = matchingPools[0];
    
    if (matchingPools.length > 1) {
      // Fetch liquidity data for each pool
      const poolsWithLiquidity = await Promise.all(
        matchingPools.map(async (pool: RaydiumPool) => {
          try {
            const infoResponse = await fetch(`https://api.raydium.io/v2/ammV3/ammPools?pool_id=${pool.id}`);
            const infoData = await infoResponse.json();
            const liquidity = infoData.data?.[0]?.tvl || 0;
            return { ...pool, liquidity };
          } catch (error) {
            console.error(`Failed to fetch liquidity for pool ${pool.id}:`, error);
            return { ...pool, liquidity: 0 };
          }
        })
      );

      // Sort by liquidity (highest first)
      poolsWithLiquidity.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
      selectedPool = poolsWithLiquidity[0];

      console.log(`🏆 Selected pool with highest liquidity: $${selectedPool.liquidity?.toLocaleString()}`);
    }

    return {
      poolAddress: selectedPool.id,
      poolInfo: selectedPool,
    };

  } catch (error) {
    console.error('❌ Error finding Raydium pool:', error);
    return null;
  }
}

/**
 * Get detailed pool information from Raydium
 */
export async function getRaydiumPoolInfo(poolAddress: string): Promise<RaydiumPool | null> {
  try {
    console.log('🔍 Fetching Raydium pool info:', poolAddress);

    const response = await fetch('https://api.raydium.io/v2/sdk/liquidity/mainnet.json');
    
    if (!response.ok) {
      throw new Error(`Raydium API error: ${response.status}`);
    }

    const data = await response.json();
    const pools = data.official || [];

    const pool = pools.find((p: RaydiumPool) => p.id === poolAddress);

    if (!pool) {
      console.log('❌ Pool not found:', poolAddress);
      return null;
    }

    // Fetch additional info (TVL, volume, etc.)
    try {
      const infoResponse = await fetch(`https://api.raydium.io/v2/ammV3/ammPools?pool_id=${poolAddress}`);
      const infoData = await infoResponse.json();
      const additionalInfo = infoData.data?.[0];

      if (additionalInfo) {
        pool.liquidity = additionalInfo.tvl;
      }
    } catch (error) {
      console.warn('Failed to fetch additional pool info:', error);
    }

    console.log('✅ Pool info retrieved:', pool);
    return pool;

  } catch (error) {
    console.error('❌ Error fetching pool info:', error);
    return null;
  }
}

/**
 * Validate if a Raydium pool address is valid
 */
export async function validateRaydiumPoolAddress(poolAddress: string): Promise<boolean> {
  try {
    // Check if it's a valid Solana public key
    new PublicKey(poolAddress);

    // Check if pool exists in Raydium
    const poolInfo = await getRaydiumPoolInfo(poolAddress);
    
    return poolInfo !== null;
  } catch (error) {
    console.error('❌ Invalid pool address:', error);
    return false;
  }
}

/**
 * Get pool reserves and ratio
 */
export async function getPoolReserves(
  connection: Connection,
  poolAddress: string
): Promise<{
  baseReserve: number;
  quoteReserve: number;
  lpSupply: number;
  ratio: number;
} | null> {
  try {
    const poolInfo = await getRaydiumPoolInfo(poolAddress);
    if (!poolInfo) return null;

    // Fetch vault balances
    const baseVault = new PublicKey(poolInfo.baseVault);
    const quoteVault = new PublicKey(poolInfo.quoteVault);
    const lpVault = new PublicKey(poolInfo.lpVault);

    const [baseBalance, quoteBalance, lpSupplyInfo] = await Promise.all([
      connection.getTokenAccountBalance(baseVault),
      connection.getTokenAccountBalance(quoteVault),
      connection.getTokenSupply(new PublicKey(poolInfo.lpMint)),
    ]);

    const baseReserve = parseFloat(baseBalance.value.amount) / Math.pow(10, poolInfo.baseDecimals);
    const quoteReserve = parseFloat(quoteBalance.value.amount) / Math.pow(10, poolInfo.quoteDecimals);
    const lpSupply = parseFloat(lpSupplyInfo.value.amount) / Math.pow(10, poolInfo.lpDecimals);
    const ratio = baseReserve / quoteReserve;

    console.log('📊 Pool reserves:', {
      baseReserve: baseReserve.toLocaleString(),
      quoteReserve: quoteReserve.toLocaleString(),
      lpSupply: lpSupply.toLocaleString(),
      ratio: ratio.toFixed(6),
    });

    return {
      baseReserve,
      quoteReserve,
      lpSupply,
      ratio,
    };

  } catch (error) {
    console.error('❌ Error fetching pool reserves:', error);
    return null;
  }
}