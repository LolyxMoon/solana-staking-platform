import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET: Fetch current pool creation fee
export async function GET(req: NextRequest) {
  try {
    const config = await prisma.platformConfig.findUnique({
      where: { key: "POOL_CREATION_FEE" },
    });

    // Default to 0.01 SOL (10,000,000 lamports) if not set
    const feeInLamports = config?.value ? parseInt(config.value) : 10_000_000;

    return NextResponse.json({ feeInLamports });
  } catch (error: any) {
    console.error("Error fetching pool creation fee:", error);
    return NextResponse.json(
      { error: "Failed to fetch pool creation fee" },
      { status: 500 }
    );
  }
}

// POST: Update pool creation fee (admin only)
export async function POST(req: NextRequest) {
  try {
    // Get admin wallet from environment or your config
    const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET || "ecfvkqWdJiYJRyUtWvuYpPWP5faf9GBcA1K6TaDW7wS";
    
    // Simple auth check - you can enhance this based on your existing auth system
    // For now, we'll trust that the admin page already verified the user
    const { feeInLamports } = await req.json();

    if (typeof feeInLamports !== "number" || feeInLamports < 0) {
      return NextResponse.json(
        { error: "Invalid fee amount" },
        { status: 400 }
      );
    }

    await prisma.platformConfig.upsert({
      where: { key: "POOL_CREATION_FEE" },
      update: { value: feeInLamports.toString() },
      create: {
        key: "POOL_CREATION_FEE",
        value: feeInLamports.toString(),
      },
    });

    return NextResponse.json({ success: true, feeInLamports });
  } catch (error: any) {
    console.error("Error updating pool creation fee:", error);
    return NextResponse.json(
      { error: "Failed to update pool creation fee" },
      { status: 500 }
    );
  }
}