import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TelegramBotService } from '@/lib/telegram-bot';
import { verifyAdminToken } from "@/lib/adminMiddleware";

export async function POST(req: NextRequest) {
  // 🛡️ SECURITY CHECK: Verify JWT token and admin status
  const authResult = await verifyAdminToken(req);
  if (!authResult.isValid) {
    return NextResponse.json(
      { error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    console.log("📥 Received LP pool creation request:", {
      name: body.name,
      symbol: body.symbol,
      tokenMint: body.tokenMint,
      rewardTokenMint: body.rewardTokenMint,
      poolId: body.poolId,
      adminWallet: authResult.wallet,
    });

    // Validate required fields
    if (!body.name || !body.symbol || !body.tokenMint || body.poolId === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if LP pool already exists
    const existingPool = await prisma.pool.findFirst({
      where: {
        tokenMint: body.tokenMint,
        poolId: parseInt(body.poolId),
        isLPPool: true,
      },
    });

    if (existingPool) {
      return NextResponse.json(
        { error: "LP pool already exists for this token and poolId" },
        { status: 409 }
      );
    }

    // Create LP pool
    const pool = await prisma.pool.create({
      data: {
        name: body.name,
        symbol: body.symbol,
        tokenMint: body.tokenMint,
        logo: body.logo || null,
        apr: body.apr ? parseFloat(body.apr) : 0,
        apy: body.apy ? parseFloat(body.apy) : 0,
        type: body.type || "locked",
        lockPeriod: body.lockPeriod ? parseInt(body.lockPeriod) : null,
        duration: body.duration ? parseInt(body.duration) : null,
        rewards: body.rewards || body.symbol,
        poolId: parseInt(body.poolId),
        transferTaxBps: body.transferTaxBps || 0,
        dexType: body.dexType || null,
        dexPoolAddress: body.dexPoolAddress || null,
        isLPPool: true,
        rewardTokenMint: body.rewardTokenMint || null,
        rewardTokenSymbol: body.rewardTokenSymbol || null,
        hasSelfReflections: false,
        hasExternalReflections: false,
        externalReflectionMint: null,
        reflectionTokenSymbol: null,
        reflectionVaultAddress: null,
        isInitialized: body.isInitialized ?? true,
        isPaused: body.isPaused ?? false,
        hidden: false,
        featured: false,
        poolAddress: body.poolAddress || null,
        totalStaked: 0,
      },
    });

    console.log(`✅ LP Pool created by admin ${authResult.wallet}:`, pool.id);

    // 📢 Send Telegram alert for farming pool
    try {
      const telegramBot = new TelegramBotService(prisma);
      await telegramBot.sendFarmingPoolCreatedAlert({
        poolName: pool.name,
        tokenSymbol: pool.symbol,
        apr: pool.apr || 0,
        lockPeriodDays: pool.lockPeriod || 0,
        tokenLogo: pool.logo || undefined,
      });
    } catch (telegramError) {
      console.error('⚠️ Telegram farming alert failed:', telegramError);
    }

    return NextResponse.json({ 
      success: true, 
      pool 
    });
  } catch (error: any) {
    console.error("❌ Error creating LP pool:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create LP pool" },
      { status: 500 }
    );
  }
}