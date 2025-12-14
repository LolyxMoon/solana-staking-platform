import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/adminMiddleware";
import { TelegramBotService } from '@/lib/telegram-bot';

// Add these to prevent static generation
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ====================================================================
// 🔓 PUBLIC ENDPOINT - No authentication required
// Returns ALL pools including hidden ones (needed for admin panel display)
// If you want to hide certain pools from public, create a separate
// /api/pools endpoint that filters out hidden pools
// ====================================================================
export async function GET() {
  const pools = await prisma.pool.findMany({ 
    orderBy: { createdAt: "desc" } 
  });
  return NextResponse.json(pools);
}

// ====================================================================
// 🔒 PROTECTED ENDPOINT - Admin authentication required
// Create new pool in database
// ====================================================================
export async function POST(req: Request) {
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
    
    console.log("📥 Creating pool with data:", body);
    
    // ✅ Proceed with pool creation (admin verified)
    const pool = await prisma.pool.create({
      data: {
        // ✅ Use tokenMint instead of mintAddress
        tokenMint: body.mintAddress || body.tokenMint,
        poolId: body.poolId ? parseInt(body.poolId) : 0,
        name: body.name,
        symbol: body.symbol,
        apr: body.apr ? parseFloat(body.apr) : null,
        apy: body.apy ? parseFloat(body.apy) : null,
        type: body.type,
        lockPeriod: body.lockPeriod ? parseInt(body.lockPeriod) : null,
        rewards: body.rewards,
        logo: body.logo,
        pairAddress: body.pairAddress,
        hasSelfReflections: body.hasSelfReflections || false,
        hasExternalReflections: body.hasExternalReflections || false,
        externalReflectionMint: body.externalReflectionMint || null,
      },
    });
    
    // 📝 Log admin action for audit trail
    console.log(`✅ Pool created by admin wallet: ${authResult.wallet}`, pool);
    
    // 📢 Send Telegram alert
    try {
      const telegramBot = new TelegramBotService(prisma);
      await telegramBot.sendPoolCreatedAlert({
        poolName: pool.name,
        tokenSymbol: pool.symbol,
        aprType: pool.type,
        lockPeriodDays: pool.lockPeriod || 0,
        tokenLogo: pool.logo || undefined,
      });
    } catch (telegramError) {
      console.error('⚠️ Telegram alert failed:', telegramError);
      // Don't fail pool creation if Telegram fails
    }
    
    return NextResponse.json(pool);
  } catch (err: any) {
    console.error("❌ Error creating pool:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ====================================================================
// 🔒 PROTECTED ENDPOINT - Admin authentication required
// Full update of pool data (PUT for complete replacement)
// ====================================================================
export async function PUT(req: Request) {
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
    
    console.log("📥 Updating pool (PUT) with data:", body);
    
    // ✅ Proceed with pool update (admin verified)
    const pool = await prisma.pool.update({
      where: { id: body.id },
      data: {
        tokenMint: body.mintAddress || body.tokenMint,
        poolId: body.poolId ?? 0,
        name: body.name,
        symbol: body.symbol,
        apr: body.apr ? parseFloat(body.apr) : null,
        apy: body.apy ? parseFloat(body.apy) : null,
        type: body.type,
        lockPeriod: body.lockPeriod ? parseInt(body.lockPeriod) : null,
        rewards: body.rewards,
        logo: body.logo,
        pairAddress: body.pairAddress,
        hasSelfReflections: body.hasSelfReflections || false,
        hasExternalReflections: body.hasExternalReflections || false,
        externalReflectionMint: body.externalReflectionMint || null,
      },
    });
    
    // 📝 Log admin action for audit trail
    console.log(`✅ Pool updated (PUT) by admin wallet: ${authResult.wallet}`, pool);
    
    return NextResponse.json(pool);
  } catch (err: any) {
    console.error("❌ Error updating pool (PUT):", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ====================================================================
// 🔒 PROTECTED ENDPOINT - Admin authentication required
// Partial update of pool data (PATCH for selective field updates)
// ====================================================================
export async function PATCH(req: Request) {
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
    const { id, ...updateData } = body;
    
    if (!id) {
      return NextResponse.json({ error: "Pool ID is required" }, { status: 400 });
    }
    
    console.log("📥 Updating pool (PATCH):", id);
    console.log("📥 Update data:", updateData);
    
    // Convert string numbers to proper types if needed
    const processedData: any = {};
    
    for (const [key, value] of Object.entries(updateData)) {
      if (value === null || value === undefined) {
        processedData[key] = null;
      } 
      // ✅ Handle mintAddress → tokenMint mapping
      else if (key === 'mintAddress') {
        processedData['tokenMint'] = value;
      }
      // ✅ Handle poolId
      else if (key === 'poolId') {
        processedData[key] = parseInt(value as string);
      }
      else if (key === 'apy' || key === 'apr') {
        // Handle APY/APR - remove % sign if present and convert to number
        const numValue = typeof value === 'string' ? value.replace('%', '') : value;
        processedData[key] = numValue ? parseFloat(numValue as string) : null;
      } else if (key === 'lockPeriod' || key === 'poolDuration') {
        processedData[key] = value ? parseInt(value as string) : null;
      } else if (key === 'isInitialized' || key === 'isPaused' || key === 'hidden' || 
                 key === 'featured' || key === 'depositsPaused' || key === 'withdrawalsPaused' || 
                 key === 'claimsPaused' || key === 'isEmergencyUnlocked' ||
                 key === 'hasSelfReflections' || key === 'hasExternalReflections' ||
                 key === 'referralEnabled') {
        // Boolean fields
        processedData[key] = Boolean(value);
      } else if (key === 'platformFeePercent' || key === 'flatSolFee' || 
                 key === 'referralSplitPercent' || key === 'totalStaked' || key === 'views' ||
                 key === 'featured_order') {
        // Numeric fields
        processedData[key] = value ? parseFloat(value as string) : null;
      } else {
        // String fields (name, symbol, logo, tokenMint, etc.)
        processedData[key] = value;
      }
    }
    
    // ✅ CRITICAL FIX: Auto-update type field based on lockPeriod
    if ('lockPeriod' in processedData) {
      const lockPeriod = processedData.lockPeriod;
      processedData.type = (lockPeriod === null || lockPeriod === 0 || lockPeriod === '0') 
        ? 'unlocked' 
        : 'locked';
      console.log(`🔧 Auto-setting type to "${processedData.type}" based on lockPeriod:`, lockPeriod);
    }
    
    console.log("📤 Processed data for update:", processedData);
    
    // ✅ Proceed with pool update (admin verified)
    const pool = await prisma.pool.update({
      where: { id },
      data: processedData,
    });
    
    // 📝 Log admin action for audit trail
    console.log(`✅ Pool updated (PATCH) by admin wallet: ${authResult.wallet}`, pool);
    
    return NextResponse.json(pool);
  } catch (err: any) {
    console.error("❌ Error updating pool (PATCH):", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}