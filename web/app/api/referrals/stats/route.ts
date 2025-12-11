import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

/**
 * GET /api/referrals/stats?wallet=WALLET_ADDRESS
 * Returns referral stats for a wallet
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }

    // Count pools where this wallet is the referrer
    const totalReferrals = await prisma.pool.count({
      where: {
        referralWallet: wallet,
        referralEnabled: true,
      }
    });

    // Get list of referred pools (optional, for displaying details)
    const referredPools = await prisma.pool.findMany({
      where: {
        referralWallet: wallet,
        referralEnabled: true,
      },
      select: {
        id: true,
        name: true,
        symbol: true,
        logo: true,
        createdAt: true,
        referralSplitPercent: true,
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10 // Last 10 referrals
    });

    return NextResponse.json({
      totalReferrals,
      referredPools,
    });

  } catch (err: any) {
    console.error("Error fetching referral stats:", err);
    return NextResponse.json({ 
      error: err.message || "Failed to fetch referral stats" 
    }, { status: 500 });
  }
}