import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ✅ GET: Fetch all pools for a specific token
export async function GET(
  req: NextRequest,
  { params }: { params: { tokenMint: string } }
) {
  try {
    console.log('🔍 Fetching all pools for token:', params.tokenMint)
    
    const pools = await prisma.pool.findMany({
      where: { 
        tokenMint: params.tokenMint,
        hidden: false 
      },
      orderBy: { poolId: 'asc' }
    })
    
    console.log('✅ Found pools:', pools.length)
    
    return NextResponse.json(pools)
  } catch (error: any) {
    console.error('❌ Error fetching pools:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pools', details: error.message },
      { status: 500 }
    )
  }
}