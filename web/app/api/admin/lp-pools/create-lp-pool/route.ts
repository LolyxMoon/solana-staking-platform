import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("📥 Received LP pool creation request:", {
      name: body.name,
      symbol: body.symbol,
      tokenMint: body.tokenMint,
      rewardTokenMint: body.rewardTokenMint,
      poolId: body.poolId,
    });

    // Validate required fields
    if (!body.name || !body.symbol || !body.tokenMint || !body.poolId === undefined) {
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
        // Multi-DEX support
        dexType: body.dexType || null,
        dexPoolAddress: body.dexPoolAddress || null,
         
        // LP-specific fields
        isLPPool: true,
        rewardTokenMint: body.rewardTokenMint || null,
        rewardTokenSymbol: body.rewardTokenSymbol || null,
        
        // Reflection fields (disabled for LP pools)
        hasSelfReflections: false,
        hasExternalReflections: false,
        externalReflectionMint: null,
        reflectionTokenSymbol: null,
        reflectionVaultAddress: null,
        
        // Pool state
        isInitialized: body.isInitialized ?? true,
        isPaused: body.isPaused ?? false,
        hidden: false,
        featured: false,
        
        // Pool address (optional)
        poolAddress: body.poolAddress || null,
        
        // Initial values
        totalStaked: 0,
    },
    });

    console.log("✅ LP Pool created successfully:", pool.id);

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