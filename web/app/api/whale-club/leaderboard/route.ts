import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "10");

    const leaderboard = await prisma.whaleClubUser.findMany({
      where: {
        totalPoints: { gt: 0 },
      },
      orderBy: {
        totalPoints: "desc",
      },
      take: Math.min(limit, 100),
      select: {
        walletAddress: true,
        twitterUsername: true,
        totalPoints: true,
        likesCount: true,
        retweetsCount: true,
        quotesCount: true,
      },
    });

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}