import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const pools = await prisma.pool.findMany({
      where: {
        isLPPool: true,
        hidden: false,
        isPaused: false,
      },
      orderBy: [
        { featured: 'desc' },
        { symbol: 'asc' },
        { poolId: 'asc' }
      ]
    });

    return NextResponse.json(pools);
  } catch (error: any) {
    console.error("Error fetching LP pools:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch LP pools" },
      { status: 500 }
    );
  }
}