import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Add this to prevent static generation
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    // Skip during build when DATABASE_URL is not available
    if (!process.env.DATABASE_URL) {
      return NextResponse.json([]);
    }

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit");

    const activities = await prisma.activity.findMany({
      where: { userId: params.userId },
      orderBy: { timestamp: "desc" },
      // If limit is specified, use it; otherwise return all
      ...(limit && { take: parseInt(limit) }),
      include: { 
        pool: {
          select: {
            name: true,
            symbol: true,
            logo: true,
          }
        }
      },
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error("Activity API error:", error);
    return NextResponse.json([]);
  }
}