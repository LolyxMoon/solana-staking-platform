import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Known tokens that might not be on BirdEye
const KNOWN_TOKENS: Record<string, { symbol: string; name: string; decimals: number; logoURI?: string }> = {
  "6uUU2z5GBasaxnkcqiQVHa2SXL68mAXDsq1zYN5Qxrm7": {
    symbol: "SPT",
    name: "StakePoint",
    decimals: 9,
    logoURI: "https://your-logo-url.com/spt.png", // Add your logo URL
  },
};

async function fetchJupiterTokenInfo(address: string) {
  try {
    const response = await fetch(`https://tokens.jup.ag/token/${address}`);
    if (response.ok) {
      const data = await response.json();
      return {
        address: data.address,
        symbol: data.symbol || "UNKNOWN",
        name: data.name || "Unknown Token",
        decimals: data.decimals || 9,
        logoURI: data.logoURI || null,
      };
    }
  } catch (error) {
    console.log("Jupiter token lookup failed:", error);
  }
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Token address required" }, { status: 400 });
  }

  // Check known tokens first
  if (KNOWN_TOKENS[address]) {
    console.log(`✅ Using known token data for: ${address}`);
    return NextResponse.json({
      address,
      ...KNOWN_TOKENS[address],
      price: 0,
      liquidity: 0,
      marketCap: 0,
    });
  }

  const apiKey = process.env.NEXT_PUBLIC_BIRDEYE_API_KEY;
  
  if (!apiKey) {
    console.error("BirdEye API key not configured");
    // Try Jupiter as fallback
    const jupiterData = await fetchJupiterTokenInfo(address);
    if (jupiterData) {
      return NextResponse.json(jupiterData);
    }
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
        next: { revalidate: 300 }
      }
    );

    if (!response.ok || response.status === 404) {
      // Try Jupiter as fallback
      console.log("BirdEye failed, trying Jupiter...");
      const jupiterData = await fetchJupiterTokenInfo(address);
      if (jupiterData) {
        console.log(`✅ Found token on Jupiter: ${jupiterData.symbol}`);
        return NextResponse.json(jupiterData);
      }
      
      console.error(`Token not found: ${address}`);
      return NextResponse.json({ 
        error: "Token not found",
        address,
        fallback: {
          address,
          symbol: "UNKNOWN",
          name: "Unknown Token",
          decimals: 9,
          logoURI: null,
        }
      }, { status: 404 });
    }

    const data = await response.json();
    
    if (!data.success || !data.data) {
      // Try Jupiter as fallback
      const jupiterData = await fetchJupiterTokenInfo(address);
      if (jupiterData) {
        return NextResponse.json(jupiterData);
      }
      
      return NextResponse.json({ 
        error: "Token not found",
        address,
        fallback: {
          address,
          symbol: "UNKNOWN",
          name: "Unknown Token",
          decimals: 9,
          logoURI: null,
        }
      }, { status: 404 });
    }

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
    
    // Try Jupiter as fallback
    const jupiterData = await fetchJupiterTokenInfo(address);
    if (jupiterData) {
      return NextResponse.json(jupiterData);
    }
    
    return NextResponse.json({ 
      error: error.message,
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