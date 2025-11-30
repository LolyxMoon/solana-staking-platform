import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get all user stakes
    const stakes = await prisma.userStake.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('🔍 [DEBUG] DATABASE DIAGNOSTIC');
    console.log('🔍 [DEBUG] =====================');
    console.log('🔍 [DEBUG] Total records in UserStake table:', stakes.length);
    console.log('');

    if (stakes.length === 0) {
      console.log('⚠️ [DEBUG] No stakes found in database!');
      console.log('⚠️ [DEBUG] This means:');
      console.log('⚠️ [DEBUG] 1. No one has staked yet, OR');
      console.log('⚠️ [DEBUG] 2. The database sync is not working');
    } else {
      console.log('✅ [DEBUG] Stakes found:');
      stakes.forEach((stake, index) => {
        console.log(`\n✅ [DEBUG] Stake #${index + 1}:`);
        console.log('  User:', stake.userWallet);
        console.log('  Token:', stake.tokenMint);
        console.log('  Pool:', stake.poolId);
        console.log('  Amount:', stake.stakedAmount.toString());
        console.log('  PDA:', stake.stakePda);
        console.log('  Last Updated:', stake.updatedAt);
      });

      // Calculate totals
      let totalAmount = BigInt(0);
      const uniqueUsers = new Set<string>();

      stakes.forEach(stake => {
        totalAmount += stake.stakedAmount;
        uniqueUsers.add(stake.userWallet);
      });

      console.log('\n📊 [DEBUG] SUMMARY:');
      console.log('  Total Stakes:', stakes.length);
      console.log('  Unique Stakers:', uniqueUsers.size);
      console.log('  Total Amount (raw):', totalAmount.toString());
      console.log('  Total Amount (tokens, 9 decimals):', Number(totalAmount) / 1e9);
    }

    // Return full diagnostic data
    return NextResponse.json({
      success: true,
      totalRecords: stakes.length,
      stakes: stakes.map(s => ({
        ...s,
        stakedAmount: s.stakedAmount.toString(), // Convert BigInt to string for JSON
      })),
      summary: {
        uniqueStakers: new Set(stakes.map(s => s.userWallet)).size,
        totalAmount: stakes.reduce((sum, s) => sum + s.stakedAmount, BigInt(0)).toString(),
      },
    });
  } catch (error: any) {
    console.error('❌ [DEBUG] Diagnostic failed:', error);
    return NextResponse.json(
      { error: error.message || 'Diagnostic failed' },
      { status: 500 }
    );
  }
}