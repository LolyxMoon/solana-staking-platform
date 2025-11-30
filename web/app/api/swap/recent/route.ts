// app/api/swap/recent/route.ts
// GET recent swaps for debugging USD tracking

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    const swaps = await prisma.swapStats.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.min(limit, 100), // Max 100
      select: {
        id: true,
        fromToken: true,
        toToken: true,
        fromAmount: true,
        toAmount: true,
        volumeUsd: true,
        priceUsd: true,
        userAddress: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      swaps,
      count: swaps.length,
    });
  } catch (error) {
    console.error("Error fetching recent swaps:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent swaps" },
      { status: 500 }
    );
  }
}