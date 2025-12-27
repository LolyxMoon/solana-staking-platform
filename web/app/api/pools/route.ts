// app/api/pools/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Connection, PublicKey } from '@solana/web3.js'
import { getReadOnlyProgram, getPDAs } from '@/lib/anchor-program'
import { verifyAdminToken } from '@/lib/adminMiddleware'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SECONDS_PER_YEAR = 31_536_000;

// Cache for rates to avoid hammering RPC
const rateCache = new Map<string, { rate: number; rateType: string; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

function getConnection() {
  const rpcUrl = process.env.HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

// Calculate rate from project data
function calculateRate(project: any): { rate: number; rateType: 'apr' | 'apy' } {
  const rateMode = project.rateMode;
  const rateBpsPerYear = project.rateBpsPerYear?.toNumber ? project.rateBpsPerYear.toNumber() : Number(project.rateBpsPerYear);
  
  if (rateMode === 0) {
    return { rate: rateBpsPerYear / 100, rateType: 'apy' };
  } else {
    const totalStaked = BigInt(project.totalStaked?.toString() || '0');
    const rewardRatePerSecond = BigInt(project.rewardRatePerSecond?.toString() || '0');
    
    if (totalStaked === 0n || rewardRatePerSecond === 0n) {
      return { rate: 0, rateType: 'apr' };
    }
    
    const annualRewards = rewardRatePerSecond * BigInt(SECONDS_PER_YEAR);
    const rate = Number((annualRewards * 10000n) / totalStaked) / 100;
    return { rate, rateType: 'apr' };
  }
}

// Batch fetch all project accounts
async function batchFetchProjects(
  connection: Connection,
  pools: { tokenMint: string; poolId: number }[]
): Promise<Map<string, any>> {
  const program = getReadOnlyProgram(connection);
  const results = new Map<string, any>();
  
  // Check cache first, collect uncached
  const uncachedPools: { tokenMint: string; poolId: number; pda: PublicKey; cacheKey: string }[] = [];
  
  for (const pool of pools) {
    const cacheKey = `${pool.tokenMint}:${pool.poolId}`;
    const cached = rateCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      results.set(cacheKey, { rate: cached.rate, rateType: cached.rateType });
    } else {
      const [pda] = getPDAs.project(new PublicKey(pool.tokenMint), pool.poolId);
      uncachedPools.push({ ...pool, pda, cacheKey });
    }
  }
  
  if (uncachedPools.length === 0) {
    console.log('✅ All pools served from cache');
    return results;
  }
  
  console.log(`🔄 Fetching ${uncachedPools.length} project accounts in batch...`);
  
  try {
    // Batch fetch all accounts in ONE RPC call
    const pdas = uncachedPools.map(p => p.pda);
    const accounts = await connection.getMultipleAccountsInfo(pdas, 'confirmed');
    
    // Decode each account
    for (let i = 0; i < uncachedPools.length; i++) {
      const pool = uncachedPools[i];
      const accountInfo = accounts[i];
      
      if (!accountInfo) {
        console.log(`⚠️ No account found for ${pool.cacheKey}`);
        continue;
      }
      
      try {
        // Decode using Anchor's coder
        const project = program.coder.accounts.decode('project', accountInfo.data);
        
        const rateData = calculateRate(project);
        
        console.log(`📊 Pool ${pool.tokenMint.slice(0,8)}...:${pool.poolId} blockchain data:`, {
          rateMode: project.rateMode,
          rateBpsPerYear: project.rateBpsPerYear?.toString(),
          rewardRatePerSecond: project.rewardRatePerSecond?.toString(),
          totalStaked: project.totalStaked?.toString(),
        });
        
        console.log(`✅ Pool ${pool.tokenMint.slice(0,8)}...:${pool.poolId} live rate: ${rateData.rate.toFixed(2)}% ${rateData.rateType.toUpperCase()}`);
        
        // Cache the result
        rateCache.set(pool.cacheKey, { 
          rate: rateData.rate, 
          rateType: rateData.rateType, 
          timestamp: Date.now() 
        });
        
        results.set(pool.cacheKey, rateData);
      } catch (decodeError: any) {
        console.error(`❌ Failed to decode account for ${pool.cacheKey}:`, decodeError.message);
      }
    }
  } catch (error: any) {
    console.error('❌ Batch fetch error:', error.message);
  }
  
  return results;
}

// ✅ GET: Fetch all pools with live rates (PUBLIC - no auth needed)
export async function GET() {
  try {
    console.log('🔍 Pools API called');
    
    const pools = await prisma.pool.findMany({
      where: {
        hidden: false,
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

    // Get connection
    const connection = getConnection();
    
    // Collect pools that need live rates
    const poolsToFetch = pools
      .filter(p => p.isInitialized && p.tokenMint)
      .map(p => ({ tokenMint: p.tokenMint, poolId: p.poolId || 0 }));
    
    // Batch fetch all project accounts in ONE RPC call
    const rateResults = await batchFetchProjects(connection, poolsToFetch);
    
    // Apply rates to pools
    const poolsWithLiveRates = pools.map(pool => {
      const cacheKey = `${pool.tokenMint}:${pool.poolId || 0}`;
      const rateData = rateResults.get(cacheKey);
      
      if (rateData) {
        return {
          ...pool,
          apr: rateData.rateType === 'apr' ? rateData.rate : pool.apr,
          apy: rateData.rateType === 'apy' ? rateData.rate : pool.apy,
          liveRate: rateData.rate,
          liveRateType: rateData.rateType,
        };
      }
      
      return {
        ...pool,
        liveRate: pool.apy || pool.apr || 0,
        liveRateType: pool.apy ? 'apy' : 'apr',
      };
    });

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

// ✅ POST: Create new pool - ADMIN ONLY
export async function POST(request: Request) {
  const authResult = await verifyAdminToken(request);
  if (!authResult.isValid) {
    return NextResponse.json(
      { error: authResult.error || 'Unauthorized' },
      { status: 401 }
    );
  }

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
      return NextResponse.json({ error: 'tokenMint is required' }, { status: 400 })
    }
    
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    
    if (!type || !['locked', 'unlocked'].includes(type)) {
      return NextResponse.json({ error: 'type must be "locked" or "unlocked"' }, { status: 400 })
    }
    
    const validatedTaxBps = Math.min(10000, Math.max(0, parseInt(String(transferTaxBps)))) || 0
    
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
    
    console.log(`✅ Pool created by admin ${authResult.wallet}:`, pool.id)
    
    return NextResponse.json(pool, { status: 201 })
  } catch (error: any) {
    console.error('❌ Database error:', error)
    
    if (error.code === 'P2002') {
      const fields = error.meta?.target || ['tokenMint', 'poolId']
      return NextResponse.json(
        { error: 'Pool already exists', details: `A pool with this ${fields.join(' and ')} already exists` },
        { status: 409 }
      )
    }
    
    return NextResponse.json({ error: 'Failed to create pool', details: error.message }, { status: 500 })
  }
}

// ✅ PATCH: Update existing pool - ADMIN ONLY
export async function PATCH(request: Request) {
  const authResult = await verifyAdminToken(request);
  if (!authResult.isValid) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json()
    const { id, tokenMint, poolId, ...updateData } = body
    
    if (!id && (!tokenMint || poolId === undefined)) {
      return NextResponse.json({ error: 'Either id OR (tokenMint + poolId) is required' }, { status: 400 })
    }
    
    if ('lockPeriod' in updateData) {
      const lockPeriod = updateData.lockPeriod
      updateData.type = (lockPeriod === null || lockPeriod === 0 || lockPeriod === '0') ? 'unlocked' : 'locked'
    }
    
    if ('transferTaxBps' in updateData) {
      updateData.transferTaxBps = Math.min(10000, Math.max(0, parseInt(String(updateData.transferTaxBps)))) || 0
    }
    
    console.log('🔄 Updating pool:', id || `${tokenMint}:${poolId}`)
    
    let pool
    if (id) {
      pool = await prisma.pool.update({ where: { id }, data: updateData })
    } else {
      pool = await prisma.pool.update({
        where: { tokenMint_poolId: { tokenMint, poolId: parseInt(poolId as any) } },
        data: updateData
      })
    }
    
    console.log(`✅ Pool updated by admin ${authResult.wallet}`)
    return NextResponse.json(pool)
  } catch (error: any) {
    console.error('❌ Database update error:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update pool', details: error.message }, { status: 500 })
  }
}

// ✅ DELETE: Remove pool - ADMIN ONLY
export async function DELETE(request: Request) {
  const authResult = await verifyAdminToken(request);
  if (!authResult.isValid) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const tokenMint = searchParams.get('tokenMint')
    const poolId = searchParams.get('poolId')
    
    if (!id && (!tokenMint || !poolId)) {
      return NextResponse.json({ error: 'Either id OR (tokenMint + poolId) is required' }, { status: 400 })
    }
    
    console.log('🗑️ Deleting pool:', id || `${tokenMint}:${poolId}`)
    
    let pool
    if (id) {
      pool = await prisma.pool.delete({ where: { id } })
    } else {
      pool = await prisma.pool.delete({
        where: { tokenMint_poolId: { tokenMint: tokenMint!, poolId: parseInt(poolId!) } }
      })
    }
    
    console.log(`✅ Pool deleted by admin ${authResult.wallet}`)
    return NextResponse.json({ success: true, pool })
  } catch (error: any) {
    console.error('❌ Database delete error:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to delete pool', details: error.message }, { status: 500 })
  }
}
