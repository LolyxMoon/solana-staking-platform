import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Add these to prevent static generation
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// PATCH - Change wallet address for all stakes in a pool
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { poolId, oldWallet, newWallet } = body;

    if (!poolId || !oldWallet || !newWallet) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // TODO: Add Solana program call here to update on-chain records

    // Update all stakes for this user in this pool
    const result = await prisma.stake.updateMany({
      where: {
        poolId,
        userId: oldWallet,
      },
      data: {
        userId: newWallet,
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
    });
  } catch (err) {
    console.error("Error changing wallet:", err);
    return NextResponse.json(
      { error: "Failed to change wallet" },
      { status: 500 }
    );
  }
}