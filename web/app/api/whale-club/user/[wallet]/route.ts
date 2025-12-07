import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const { wallet } = params;

    const user = await prisma.whaleClubUser.findUnique({
      where: { walletAddress: wallet },
      select: {
        walletAddress: true,
        twitterUsername: true,
        twitterId: true,
        totalPoints: true,
        likesCount: true,
        retweetsCount: true,
        quotesCount: true,
        lastSyncedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("User fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}