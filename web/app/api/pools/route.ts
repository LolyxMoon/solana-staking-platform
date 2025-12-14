// app/api/pools/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Connection, PublicKey } from '@solana/web3.js'
import { getReadOnlyProgram, getPDAs } from '@/lib/anchor-program'

// Add these to prevent static generation
export const dynamic = 'force-dynamic'
export const revalidate = 0

const SECONDS_PER_YEAR = 31_536_000;

// Cache for rates to avoid hammering RPC
const rateCache = new Map<string, { rate: number; rateType: string; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

// Get connection
function getConnection() {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

// Fetch and calculate live rate from blockchain using Anchor
async function getLiveRate(
  connection: Connection,
  tokenMint: string,
  poolId: number
): Promise<{ rate: number; rateType: 'apr' | 'apy' } | null> {
  const cacheKey = `${tokenMint}:${poolId}`;
  
  // Check cache first
  const cached = rateCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return { rate: cached.rate, rateType: cached.rateType as 'apr' | 'apy' };
  }

  try {
    const program = getReadOnlyProgram(connection);
    const tokenMintPubkey = new PublicKey(tokenMint);
    const [projectPDA] = getPDAs.project(tokenMintPubkey, poolId);
    
    // Fetch project account using Anchor's typed fetch
    const project = await program.account.project.fetch(projectPDA, 'confirmed');
    
    if (!project) {
      console.log(`⚠️ No project account found for ${tokenMint}:${poolId}`);
      return null;
    }

    const rateMode = project.rateMode;
    const rateBpsPerYear = project.rateBpsPerYear?.toNumber ? project.rateBpsPerYear.toNumber() : Number(project.rateBpsPerYear);
    
    // Use BigInt for large numbers to avoid precision loss
    const rewardRatePerSecondBN = project.rewardRatePerSecond;
    const totalStakedBN = project.totalStaked;

    console.log(`📊 Pool ${tokenMint.slice(0,8)}...:${poolId} blockchain data:`, {
      rateMode,
      rateBpsPerYear,
      rewardRatePerSecond: rewardRatePerSecondBN?.toString(),
      totalStaked: totalStakedBN?.toString(),
    });

    let rate: number;
    let rateType: 'apr' | 'apy';

    if (rateMode === 0) {
      // Locked pool - static APY from rate_bps_per_year
      rate = rateBpsPerYear / 100;
      rateType = 'apy';
    } else {
      // Variable pool - dynamic APR using BigInt for large numbers
      const totalStaked = BigInt(totalStakedBN?.toString() || '0');
      const rewardRatePerSecond = BigInt(rewardRatePerSecondBN?.toString() || '0');
      
      if (totalStaked === 0n || rewardRatePerSecond === 0n) {
        rate = 0;
      } else {
        // APR = (reward_rate_per_second * seconds_per_year * 100) / total_staked
        const annualRewards = rewardRatePerSecond * BigInt(SECONDS_PER_YEAR);
        rate = Number((annualRewards * 10000n) / totalStaked) / 100;
      }
      rateType = 'apr';
    }

    // Cache the result
    rateCache.set(cacheKey, { rate, rateType, timestamp: Date.now() });
    
    console.log(`✅ Pool ${tokenMint.slice(0,8)}...:${poolId} live rate: ${rate.toFixed(2)}% ${rateType.toUpperCase()}`);
    
    return { rate, rateType };
  } catch (error: any) {
    console.error(`❌ Error fetching live rate for ${tokenMint}:${poolId}:`, error.message);
    return null;
  }
}

// ✅ GET: Fetch all pools with live rates
export async function GET() {
  try {
    console.log('🔍 Pools API called');
    
    const pools = await prisma.pool.findMany({
      where: {
        hidden: false,
        isPaused: false
      },
      orderBy: [
        { featured: 'desc' },
        { tokenMint: 'asc' },
        { poolId: 'asc' }
      ],
      select: {
        id: true,
        poolId: true,
        tokenMint: true,
        name: true,
        symbol: true,
        apr: true,
        apy: true,
        type: true,
        lockPeriod: true,
        totalStaked: true,
        rewards: true,
        logo: true,
        pairAddress: true,
        hidden: true,
        featured: true,
        views: true,
        createdAt: true,
        hasSelfReflections: true,
        hasExternalReflections: true,
        externalReflectionMint: true,
        reflectionTokenAccount: true,
        reflectionTokenSymbol: true,
        reflectionTokenDecimals: true,
        isInitialized: true,
        poolAddress: true,
        isPaused: true,
        isEmergencyUnlocked: true,
        featuredOrder: true,
        platformFeePercent: true,
        flatSolFee: true,
        referralEnabled: true,
        referralWallet: true,
        referralSplitPercent: true,
        transferTaxBps: true,
      }
    });
    
    console.log('✅ Found pools:', pools.length);

    // Fetch live rates from blockchain
    const connection = getConnection();
    
    const poolsWithLiveRates = await Promise.all(
      pools.map(async (pool) => {
        // Only fetch live rate for initialized pools
        if (pool.isInitialized && pool.tokenMint) {
          try {
            const liveRate = await getLiveRate(connection, pool.tokenMint, pool.poolId || 0);
            
            if (liveRate) {
              return {
                ...pool,
                // Override with live rates
                apr: liveRate.rateType === 'apr' ? liveRate.rate : pool.apr,
                apy: liveRate.rateType === 'apy' ? liveRate.rate : pool.apy,
                liveRate: liveRate.rate,
                liveRateType: liveRate.rateType,
              };
            }
          } catch (error) {
            console.error(`⚠️ Failed to get live rate for pool ${pool.symbol}:`, error);
          }
        }
        
        return {
          ...pool,
          liveRate: pool.apy || pool.apr || 0,
          liveRateType: pool.apy ? 'apy' : 'apr',
        };
      })
    );

    // Log pools with transfer tax for debugging
    const poolsWithTax = poolsWithLiveRates.filter(p => p.transferTaxBps > 0);
    if (poolsWithTax.length > 0) {
      console.log(`⚠️ ${poolsWithTax.length} pool(s) have transfer tax:`, 
        poolsWithTax.map(p => ({ 
          symbol: p.symbol, 
          taxBps: p.transferTaxBps,
          taxPercent: `${p.transferTaxBps / 100}%`
        }))
      );
    }

    return NextResponse.json(poolsWithLiveRates);
  } catch (error: any) {
    console.error('❌ Database error:', error);
    console.error('❌ Error message:', error.message);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch pools', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}

// ✅ POST: Create new pool
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      tokenMint,
      poolId = 0,
      name,
      symbol,
      type,
      apy,
      apr,
      lockPeriod,
      logo,
      pairAddress,
      featured = false,
      hidden = false,
      transferTaxBps = 0,
      ...rest
    } = body
    
    if (!tokenMint) {
      return NextResponse.json(
        { error: 'tokenMint is required' },
        { status: 400 }
      )
    }
    
    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }
    
    if (!type || !['locked', 'unlocked'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be "locked" or "unlocked"' },
        { status: 400 }
      )
    }
    
    const validatedTaxBps = Math.min(10000, Math.max(0, parseInt(String(transferTaxBps)))) || 0
    
    if (validatedTaxBps > 0) {
      console.log(`⚠️ Pool ${symbol} has ${validatedTaxBps / 100}% transfer tax`)
    }
    
    console.log('🆕 Creating pool:', { tokenMint, poolId, name, type, transferTaxBps: validatedTaxBps })
    
    const pool = await prisma.pool.create({
      data: {
        tokenMint,
        poolId,
        name,
        symbol: symbol || name.toUpperCase(),
        type,
        apy,
        apr,
        lockPeriod,
        logo,
        pairAddress,
        featured,
        hidden,
        transferTaxBps: validatedTaxBps,
        ...rest
      }
    })
    
    console.log('✅ Pool created:', pool.id)
    
    return NextResponse.json(pool, { status: 201 })
  } catch (error: any) {
    console.error('❌ Database error:', error)
    
    if (error.code === 'P2002') {
      const fields = error.meta?.target || ['tokenMint', 'poolId']
      return NextResponse.json(
        { 
          error: 'Pool already exists',
          details: `A pool with this ${fields.join(' and ')} already exists`
        },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create pool', details: error.message },
      { status: 500 }
    )
  }
}

// ✅ PATCH: Update existing pool
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, tokenMint, poolId, ...updateData } = body
    
    if (!id && (!tokenMint || poolId === undefined)) {
      return NextResponse.json(
        { error: 'Either id OR (tokenMint + poolId) is required' },
        { status: 400 }
      )
    }
    
    // Auto-update type field based on lockPeriod
    if ('lockPeriod' in updateData) {
      const lockPeriod = updateData.lockPeriod
      updateData.type = (lockPeriod === null || lockPeriod === 0 || lockPeriod === '0') 
        ? 'unlocked' 
        : 'locked'
      console.log(`🔧 Auto-setting type to "${updateData.type}" based on lockPeriod:`, lockPeriod)
    }
    
    // Validate transfer tax if being updated
    if ('transferTaxBps' in updateData) {
      const validatedTaxBps = Math.min(10000, Math.max(0, parseInt(String(updateData.transferTaxBps)))) || 0
      updateData.transferTaxBps = validatedTaxBps
      
      if (validatedTaxBps > 0) {
        console.log(`⚠️ Updating pool to have ${validatedTaxBps / 100}% transfer tax`)
      }
    }
    
    console.log('🔄 Updating pool:', id || `${tokenMint}:${poolId}`)
    console.log('📝 Update data:', updateData)
    
    let pool
    
    if (id) {
      pool = await prisma.pool.update({
        where: { id },
        data: updateData
      })
    } else {
      pool = await prisma.pool.update({
        where: {
          tokenMint_poolId: {
            tokenMint,
            poolId: parseInt(poolId as any)
          }
        },
        data: updateData
      })
    }
    
    console.log('✅ Pool updated successfully')
    
    return NextResponse.json(pool)
  } catch (error: any) {
    console.error('❌ Database update error:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Pool not found', details: error.message },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update pool', details: error.message },
      { status: 500 }
    )
  }
}

// ✅ DELETE: Remove pool
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const tokenMint = searchParams.get('tokenMint')
    const poolId = searchParams.get('poolId')
    
    if (!id && (!tokenMint || !poolId)) {
      return NextResponse.json(
        { error: 'Either id OR (tokenMint + poolId) is required' },
        { status: 400 }
      )
    }
    
    console.log('🗑️ Deleting pool:', id || `${tokenMint}:${poolId}`)
    
    let pool
    
    if (id) {
      pool = await prisma.pool.delete({
        where: { id }
      })
    } else {
      pool = await prisma.pool.delete({
        where: {
          tokenMint_poolId: {
            tokenMint: tokenMint!,
            poolId: parseInt(poolId!)
          }
        }
      })
    }
    
    console.log('✅ Pool deleted successfully')
    
    return NextResponse.json({ success: true, pool })
  } catch (error: any) {
    console.error('❌ Database delete error:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Pool not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to delete pool', details: error.message },
      { status: 500 }
    )
  }
}