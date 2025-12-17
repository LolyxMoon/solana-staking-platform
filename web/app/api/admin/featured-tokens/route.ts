import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyAdminToken } from "@/lib/adminMiddleware";

const prisma = new PrismaClient();

interface FeaturedToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  order: number;
  enabled: boolean;
}

// Default featured tokens (SOL, USDC, USDT)
const DEFAULT_FEATURED_TOKENS: FeaturedToken[] = [
  {
    address: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Wrapped SOL",
    decimals: 9,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    order: 0,
    enabled: true,
  },
  {
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    order: 1,
    enabled: true,
  },
  {
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "USDT",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
    order: 2,
    enabled: true,
  },
];

// ====================================================================
// 🔓 PUBLIC ENDPOINT - No authentication required
// Anyone can view featured tokens (needed for frontend token selector)
// ====================================================================
export async function GET() {
  try {
    const config = await prisma.swapConfig.findFirst({
      select: { featuredTokens: true },
    });

    if (config && config.featuredTokens) {
      const featuredTokens = JSON.parse(config.featuredTokens as string);
      return NextResponse.json({ featuredTokens });
    }

    return NextResponse.json({ featuredTokens: DEFAULT_FEATURED_TOKENS });
  } catch (error) {
    console.error("Failed to read featured tokens:", error);
    return NextResponse.json({ featuredTokens: DEFAULT_FEATURED_TOKENS });
  }
}

// ====================================================================
// 🔒 PROTECTED ENDPOINT - Admin authentication required
// Save/update featured tokens configuration
// ====================================================================
export async function POST(request: NextRequest) {
  const authResult = await verifyAdminToken(request);
  if (!authResult.isValid) {
    return NextResponse.json(
      { error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { featuredTokens } = body;

    if (!Array.isArray(featuredTokens)) {
      return NextResponse.json(
        { error: "Invalid featured tokens data" },
        { status: 400 }
      );
    }

    const existingConfig = await prisma.swapConfig.findFirst();
    
    if (existingConfig) {
      await prisma.swapConfig.update({
        where: { id: existingConfig.id },
        data: {
          featuredTokens: JSON.stringify(featuredTokens),
        },
      });
    } else {
      await prisma.swapConfig.create({
        data: {
          platformFeeBps: 100,
          maxSlippageBps: 5000,
          treasuryWallet: process.env.NEXT_PUBLIC_ADMIN_WALLET_1 || "",
          enabled: true,
          featuredTokens: JSON.stringify(featuredTokens),
        },
      });
    }

    console.log(`[ADMIN] Featured tokens updated by wallet: ${authResult.wallet}`);
    console.log(`[ADMIN] New token count: ${featuredTokens.length}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to save featured tokens:", error);
    console.error("Error details:", error.message, error.stack);
    return NextResponse.json(
      { error: "Failed to save featured tokens: " + error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
