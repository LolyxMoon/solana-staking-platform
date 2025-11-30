import { NextResponse } from "next/server";

// Add these to prevent static generation
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: Request,
  { params }: { params: { pair: string } }
) {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/solana/${params.pair}`,
      {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      }
    );

    const data = await res.json();
    const priceUsd = data?.pairs?.[0]?.priceUsd ?? null;

    return NextResponse.json({ priceUsd });
  } catch (error) {
    console.error("Price fetch error:", error);
    return NextResponse.json({ priceUsd: null });
  }
}