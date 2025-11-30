import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Fetch swap statistics with USD volumes
export async function GET(req: NextRequest) {
  try {
    // Get date range from query params
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    const whereClause = Object.keys(dateFilter).length > 0 
      ? { createdAt: dateFilter }
      : {};

    // Get overall statistics (USD volume)
    const stats = await prisma.swapStats.aggregate({
      where: whereClause,
      _count: { id: true },
      _sum: {
        volumeUsd: true,
      },
    });

    // Calculate time-based volumes (USD)
    const now = new Date();
    const day24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const day7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Last 24h volume (USD)
    const last24hStats = await prisma.swapStats.aggregate({
      where: {
        createdAt: {
          gte: day24Ago,
        },
      },
      _sum: {
        volumeUsd: true,
      },
    });

    // Last 7d volume (USD)
    const last7dStats = await prisma.swapStats.aggregate({
      where: {
        createdAt: {
          gte: day7Ago,
        },
      },
      _sum: {
        volumeUsd: true,
      },
    });

    // Get top trading pairs (by USD volume)
    const topPairsRaw = await prisma.swapStats.groupBy({
      where: whereClause,
      by: ["fromToken", "toToken"],
      _count: { id: true },
      _sum: { volumeUsd: true },
      orderBy: { _sum: { volumeUsd: "desc" } },
      take: 10,
    });

    // Format top pairs
    const topPairs = topPairsRaw.map((pair) => ({
      pair: `${pair.fromToken}/${pair.toToken}`,
      volumeUsd: pair._sum.volumeUsd || 0,
      swaps: pair._count.id,
    }));

    // ✅ Get top wallets by USD volume (LEADERBOARD)
    const topWalletsRaw = await prisma.swapStats.groupBy({
      where: whereClause,
      by: ["userAddress"],
      _count: { id: true },
      _sum: { volumeUsd: true },
      orderBy: { _sum: { volumeUsd: "desc" } },
      take: 100, // Top 100 wallets
    });

    // Format top wallets with rank
    const topWallets = topWalletsRaw.map((wallet, index) => ({
      rank: index + 1,
      address: wallet.userAddress,
      volumeUsd: wallet._sum.volumeUsd || 0,
      swaps: wallet._count.id,
    }));

    // Get platform fee from config
    const config = await prisma.swapConfig.findFirst();
    const platformFeeBps = config?.platformFeeBps || 100;
    
    const totalVolumeUsd = stats._sum.volumeUsd || 0;
    const totalFeesUsd = (totalVolumeUsd * platformFeeBps) / 10000;

    return NextResponse.json({
      totalSwaps: stats._count.id || 0,
      totalVolumeUsd: totalVolumeUsd,
      totalFeesUsd: totalFeesUsd,
      last24hVolumeUsd: last24hStats._sum.volumeUsd || 0,
      last7dVolumeUsd: last7dStats._sum.volumeUsd || 0,
      topPairs: topPairs,
      topWallets: topWallets,
      platformFeeBps: platformFeeBps,
      dateRange: {
        start: startDate || null,
        end: endDate || null,
      },
    });
  } catch (error) {
    console.error("Error fetching swap stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}

// POST - Record a new swap with USD value
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      fromToken, 
      toToken, 
      fromAmount, 
      toAmount, 
      userAddress, 
      volumeUsd,
      priceUsd 
    } = body;

    if (!fromToken || !toToken || !fromAmount || !toAmount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const swap = await prisma.swapStats.create({
      data: {
        fromToken,
        toToken,
        fromAmount,
        toAmount,
        userAddress: userAddress || "anonymous",
        volumeUsd: volumeUsd || 0,
        priceUsd: priceUsd || 0,
      },
    });

    return NextResponse.json({
      success: true,
      swap,
    });
  } catch (error) {
    console.error("Error recording swap:", error);
    return NextResponse.json(
      { error: "Failed to record swap" },
      { status: 500 }
    );
  }
}