import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Fetch token information from BirdEye API
 * GET /api/birdeye/token-info?address=TOKEN_MINT_ADDRESS
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Token address required" }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_BIRDEYE_API_KEY;
  
  if (!apiKey) {
    console.error("BirdEye API key not configured");
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    console.log(`Fetching token info for: ${address}`);
    
    const response = await fetch(
      `https://public-api.birdeye.so/defi/token_overview?address=${address}`,
      {
        headers: {
          "X-API-KEY": apiKey,
          "accept": "application/json",
          "x-chain": "solana"
        },
        next: { revalidate: 300 } // Cache for 5 minutes
      }
    );

    if (!response.ok) {
      console.error(`BirdEye API error: ${response.status} ${response.statusText}`);
      throw new Error(`BirdEye API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.data) {
      console.error("Token not found in BirdEye");
      return NextResponse.json({ 
        error: "Token not found",
        address,
        // Return minimal data so we can still display the token
        fallback: {
          address,
          symbol: "UNKNOWN",
          name: "Unknown Token",
          decimals: 9,
          logoURI: null,
        }
      }, { status: 404 });
    }

    // Return only the data we need
    const tokenInfo = {
      address: data.data.address,
      symbol: data.data.symbol || "UNKNOWN",
      name: data.data.name || "Unknown Token",
      decimals: data.data.decimals || 9,
      logoURI: data.data.logoURI || null,
      price: data.data.price || 0,
      liquidity: data.data.liquidity || 0,
      marketCap: data.data.marketCap || 0,
      priceChange24h: data.data.priceChange24hPercent || 0,
    };

    console.log(`✅ Token info fetched: ${tokenInfo.symbol}`);

    return NextResponse.json(tokenInfo);
    
  } catch (error: any) {
    console.error("BirdEye API error:", error);
    return NextResponse.json({ 
      error: error.message,
      // Return fallback data
      fallback: {
        address,
        symbol: "UNKNOWN",
        name: "Unknown Token",
        decimals: 9,
        logoURI: null,
      }
    }, { status: 500 });
  }
}


