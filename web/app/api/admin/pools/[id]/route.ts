import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/adminMiddleware";

// Add these to prevent static generation
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ====================================================================
// 🔓 PUBLIC ENDPOINT - No authentication required
// Anyone can view pool details (needed for frontend display)
// ====================================================================
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const pool = await prisma.pool.findUnique({ where: { id: params.id } });
    if (!pool) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(pool);
  } catch (err) {
    console.error("Error fetching pool:", err);
    return NextResponse.json({ error: "Failed to fetch pool" }, { status: 500 });
  }
}

// ====================================================================
// 🔒 PROTECTED ENDPOINT - Admin authentication required
// Update pool data (edit / hide / feature / pause operations)
// ====================================================================
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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

    // ✅ Proceed with pool update (admin verified)
    const updated = await prisma.pool.update({
      where: { id: params.id },
      data: {
        name: body.name,
        symbol: body.symbol,
        apr: body.apr !== undefined ? Number(body.apr) : undefined,
        apy: body.apy !== undefined ? Number(body.apy) : undefined,
        type: body.type,
        lockPeriod: body.lockPeriod !== undefined ? Number(body.lockPeriod) : undefined,
        rewards: body.rewards,
        logo: body.logo,
        tokenMint: body.tokenMint || body.mintAddress, // Accept both tokenMint and mintAddress
        pairAddress: body.pairAddress,
        poolId: body.poolId !== undefined ? Number(body.poolId) : undefined,
        hidden: body.hidden,
        featured: body.featured,
        isPaused: body.isPaused !== undefined ? body.isPaused : undefined,
        isInitialized: body.isInitialized !== undefined ? body.isInitialized : undefined,
        depositsPaused: body.depositsPaused !== undefined ? body.depositsPaused : undefined,
        withdrawalsPaused: body.withdrawalsPaused !== undefined ? body.withdrawalsPaused : undefined,
        claimsPaused: body.claimsPaused !== undefined ? body.claimsPaused : undefined,
        // Reflection fields
        hasSelfReflections: body.hasSelfReflections !== undefined ? body.hasSelfReflections : undefined,
        hasExternalReflections: body.hasExternalReflections !== undefined ? body.hasExternalReflections : undefined,
        externalReflectionMint: body.externalReflectionMint !== undefined ? body.externalReflectionMint : undefined,
        reflectionTokenAccount: body.reflectionTokenAccount !== undefined ? body.reflectionTokenAccount : undefined,
        reflectionTokenSymbol: body.reflectionTokenSymbol !== undefined ? body.reflectionTokenSymbol : undefined,
      },
    });

    // 📝 Log admin action for audit trail
    console.log(`[ADMIN] Pool ${params.id} updated by wallet: ${authResult.wallet}`);

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Error updating pool:", err);
    return NextResponse.json({ error: "Failed to update pool" }, { status: 500 });
  }
}

// ====================================================================
// 🔒 PROTECTED ENDPOINT - Admin authentication required
// Delete pool from database (destructive operation)
// ====================================================================
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  // 🛡️ SECURITY CHECK: Verify JWT token and admin status
  const authResult = await verifyAdminToken(req);
  if (!authResult.isValid) {
    return NextResponse.json(
      { error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // ✅ Proceed with pool deletion (admin verified)
    await prisma.pool.delete({ where: { id: params.id } });

    // 📝 Log admin action for audit trail
    console.log(`[ADMIN] Pool ${params.id} deleted by wallet: ${authResult.wallet}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting pool:", err);
    return NextResponse.json({ error: "Failed to delete pool" }, { status: 500 });
  }
}