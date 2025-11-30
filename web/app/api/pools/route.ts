// app/api/pools/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Add these to prevent static generation
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ✅ GET: Fetch all pools
export async function GET() {
  try {
    console.log('🔍 Pools API called')
    console.log('📊 DATABASE_URL exists:', !!process.env.DATABASE_URL)
    
    const pools = await prisma.pool.findMany({
      where: {
        hidden: false,
        isPaused: false
      },
      orderBy: [
        { featured: 'desc' },  // Featured pools first
        { tokenMint: 'asc' },  // Then group by token
        { poolId: 'asc' }      // Then by pool number
      ],
      // ✅ NEW: Explicitly select fields including transferTaxBps
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
        platformFeePercent: true,
        flatSolFee: true,
        referralEnabled: true,
        referralWallet: true,
        referralSplitPercent: true,
        transferTaxBps: true, // ✅ NEW: Include transfer tax field
      }
    })
    
    console.log('✅ Found pools:', pools.length)
    
    // ✅ NEW: Log pools with transfer tax for debugging
    const poolsWithTax = pools.filter(p => p.transferTaxBps > 0)
    if (poolsWithTax.length > 0) {
      console.log(`⚠️ ${poolsWithTax.length} pool(s) have transfer tax:`, 
        poolsWithTax.map(p => ({ 
          symbol: p.symbol, 
          taxBps: p.transferTaxBps,
          taxPercent: `${p.transferTaxBps / 100}%`
        }))
      )
    }
    
    return NextResponse.json(pools)
  } catch (error: any) {
    console.error('❌ Database error:', error)
    console.error('❌ Error message:', error.message)
    
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
      poolId = 0,  // Default to pool 0
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
      transferTaxBps = 0, // ✅ NEW: Default to 0 (no tax)
      ...rest
    } = body
    
    // ✅ Validate required fields
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
    
    // ✅ NEW: Validate transfer tax (0-10000)
    const validatedTaxBps = Math.min(10000, Math.max(0, parseInt(String(transferTaxBps)))) || 0
    
    if (validatedTaxBps > 0) {
      console.log(`⚠️ Pool ${symbol} has ${validatedTaxBps / 100}% transfer tax`)
    }
    
    console.log('🆕 Creating pool:', { tokenMint, poolId, name, type, transferTaxBps: validatedTaxBps })
    
    // ✅ Create pool with composite key
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
        transferTaxBps: validatedTaxBps, // ✅ NEW: Include transfer tax
        ...rest
      }
    })
    
    console.log('✅ Pool created:', pool.id)
    
    return NextResponse.json(pool, { status: 201 })
  } catch (error: any) {
    console.error('❌ Database error:', error)
    
    // ✅ Handle duplicate pool error
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
    
    // ✅ Support both update methods:
    // 1. By internal ID (backwards compatible)
    // 2. By tokenMint + poolId (new composite key)
    
    if (!id && (!tokenMint || poolId === undefined)) {
      return NextResponse.json(
        { error: 'Either id OR (tokenMint + poolId) is required' },
        { status: 400 }
      )
    }
    
    // ✅ CRITICAL FIX: Auto-update type field based on lockPeriod
    if ('lockPeriod' in updateData) {
      const lockPeriod = updateData.lockPeriod
      updateData.type = (lockPeriod === null || lockPeriod === 0 || lockPeriod === '0') 
        ? 'unlocked' 
        : 'locked'
      console.log(`🔧 Auto-setting type to "${updateData.type}" based on lockPeriod:`, lockPeriod)
    }
    
    // ✅ NEW: Validate transfer tax if being updated
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
      // ✅ Update by internal ID (backwards compatible)
      pool = await prisma.pool.update({
        where: { id },
        data: updateData
      })
    } else {
      // ✅ Update by composite key (tokenMint + poolId)
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
    
    // ✅ Handle not found error
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

// ✅ DELETE: Remove pool (optional, but useful for admin)
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