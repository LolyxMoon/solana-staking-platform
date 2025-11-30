import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ✅ GET: Fetch single pool by tokenMint + poolId
export async function GET(
  req: NextRequest,
  { params }: { params: { tokenMint: string; poolId: string } }
) {
  try {
    console.log('🔍 Fetching pool:', params.tokenMint, 'poolId:', params.poolId)
    
    const pool = await prisma.pool.findUnique({
      where: {
        tokenMint_poolId: {
          tokenMint: params.tokenMint,
          poolId: parseInt(params.poolId)
        }
      },
      include: {
        stakes: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        Activity: {
          orderBy: { timestamp: 'desc' },
          take: 20
        }
      }
    })
    
    if (!pool) {
      return NextResponse.json(
        { error: 'Pool not found' },
        { status: 404 }
      )
    }
    
    console.log('✅ Pool found:', pool.name)
    
    return NextResponse.json(pool)
  } catch (error: any) {
    console.error('❌ Error fetching pool:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pool', details: error.message },
      { status: 500 }
    )
  }
}

// ✅ PATCH: Update single pool by tokenMint + poolId
export async function PATCH(
  req: NextRequest,
  { params }: { params: { tokenMint: string; poolId: string } }
) {
  try {
    const body = await req.json()
    
    console.log('🔄 Updating pool:', params.tokenMint, 'poolId:', params.poolId)
    
    const pool = await prisma.pool.update({
      where: {
        tokenMint_poolId: {
          tokenMint: params.tokenMint,
          poolId: parseInt(params.poolId)
        }
      },
      data: body
    })
    
    console.log('✅ Pool updated')
    
    return NextResponse.json(pool)
  } catch (error: any) {
    console.error('❌ Error updating pool:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Pool not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update pool', details: error.message },
      { status: 500 }
    )
  }
}

// ✅ DELETE: Remove single pool
export async function DELETE(
  req: NextRequest,
  { params }: { params: { tokenMint: string; poolId: string } }
) {
  try {
    console.log('🗑️ Deleting pool:', params.tokenMint, 'poolId:', params.poolId)
    
    const pool = await prisma.pool.delete({
      where: {
        tokenMint_poolId: {
          tokenMint: params.tokenMint,
          poolId: parseInt(params.poolId)
        }
      }
    })
    
    console.log('✅ Pool deleted')
    
    return NextResponse.json({ success: true, pool })
  } catch (error: any) {
    console.error('❌ Error deleting pool:', error)
    
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