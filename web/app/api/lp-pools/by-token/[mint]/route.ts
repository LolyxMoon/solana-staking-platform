import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { mint: string } }
) {
  try {
    const mint = params.mint;

    const pools = await prisma.pool.findMany({
      where: {
        tokenMint: mint,
        isLPPool: true,
      },
      orderBy: {
        poolId: 'asc',
      },
    });

    return NextResponse.json(pools);
  } catch (error: any) {
    console.error("Error fetching LP pools by token:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch LP pools" },
      { status: 500 }
    );
  }
}