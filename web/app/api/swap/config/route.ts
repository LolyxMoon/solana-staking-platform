import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyAdminToken } from "@/lib/adminMiddleware";

const prisma = new PrismaClient();

// GET - Fetch current swap configuration (PUBLIC)
export async function GET() {
  try {
    let config = await prisma.swapConfig.findFirst();

    // If no config exists, create default
    if (!config) {
      config = await prisma.swapConfig.create({
        data: {
          platformFeeBps: 50, // 0.5%
          treasuryWallet: "Hc1Wk7NDPNjxT5qaSaPEJzMEtUhE3ZqXe2yQB6TQpbFb",
          enabled: true,
        },
      });
    }

    // Return in the format the admin panel expects
    return NextResponse.json({
      swapEnabled: config.enabled,
      platformFeeBps: config.platformFeeBps,
      treasuryWallet: config.treasuryWallet,
      maxSlippageBps: config.maxSlippageBps || 100,
    });
  } catch (error) {
    console.error("Error fetching swap config:", error);
    return NextResponse.json(
      { error: "Failed to fetch configuration" },
      { status: 500 }
    );
  }
}

// POST - Update swap configuration - ADMIN ONLY
export async function POST(req: NextRequest) {
  // 🛡️ SECURITY: Verify admin token
  const authResult = await verifyAdminToken(req);
  if (!authResult.isValid) {
    return NextResponse.json(
      { error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { swapEnabled, platformFeeBps, treasuryWallet, maxSlippageBps } = body;

    // Validation
    if (platformFeeBps !== undefined && (platformFeeBps < 0 || platformFeeBps > 1000)) {
      return NextResponse.json(
        { error: "Platform fee must be between 0 and 1000 basis points" },
        { status: 400 }
      );
    }

    if (maxSlippageBps !== undefined && (maxSlippageBps < 0 || maxSlippageBps > 10000)) {
      return NextResponse.json(
        { error: "Max slippage must be between 0 and 10000 basis points" },
        { status: 400 }
      );
    }

    const config = await prisma.swapConfig.upsert({
      where: { id: 1 },
      update: {
        ...(swapEnabled !== undefined && { enabled: swapEnabled }),
        ...(platformFeeBps !== undefined && { platformFeeBps }),
        ...(treasuryWallet !== undefined && { treasuryWallet }),
        ...(maxSlippageBps !== undefined && { maxSlippageBps }),
      },
      create: {
        id: 1,
        platformFeeBps: platformFeeBps || 50,
        treasuryWallet: treasuryWallet || "Hc1Wk7NDPNjxT5qaSaPEJzMEtUhE3ZqXe2yQB6TQpbFb",
        enabled: swapEnabled !== undefined ? swapEnabled : true,
        maxSlippageBps: maxSlippageBps || 100,
      },
    });

    console.log(`✅ Swap config updated by admin ${authResult.wallet}`);

    return NextResponse.json({
      success: true,
      config: {
        swapEnabled: config.enabled,
        platformFeeBps: config.platformFeeBps,
        treasuryWallet: config.treasuryWallet,
        maxSlippageBps: config.maxSlippageBps || 100,
      },
    });
  } catch (error) {
    console.error("Error updating swap config:", error);
    return NextResponse.json(
      { error: "Failed to update configuration" },
      { status: 500 }
    );
  }
}