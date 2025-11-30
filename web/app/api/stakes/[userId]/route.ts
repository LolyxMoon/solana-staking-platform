import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Add these to prevent static generation
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET stakes for a user in a specific pool
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const poolId = searchParams.get("poolId");
    const userId = searchParams.get("userId");

    if (!poolId || !userId) {
      return NextResponse.json({ error: "Missing poolId or userId" }, { status: 400 });
    }

    const stakes = await prisma.stake.findMany({
      where: {
        poolId,
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(stakes);
  } catch (err) {
    console.error("Error fetching stakes:", err);
    return NextResponse.json({ error: "Failed to fetch stakes" }, { status: 500 });
  }
}