import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/adminMiddleware";

// GET: Fetch current pool creation fee (public - needed for pool creation UI)
export async function GET(req: NextRequest) {
  try {
    const config = await prisma.platformConfig.findUnique({
      where: { key: "POOL_CREATION_FEE" },
    });

    // Default to 0.01 SOL (10,000,000 lamports) if not set
    const feeInLamports = config?.value ? parseInt(config.value) : 10_000_000;

    return NextResponse.json({ feeInLamports });
  } catch (error: any) {
    console.error("Error fetching pool creation fee:", error);
    return NextResponse.json(
      { error: "Failed to fetch pool creation fee" },
      { status: 500 }
    );
  }
}

// POST: Update pool creation fee (admin only)
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
    const { feeInLamports } = await req.json();

    if (typeof feeInLamports !== "number" || feeInLamports < 0) {
      return NextResponse.json(
        { error: "Invalid fee amount" },
        { status: 400 }
      );
    }

    await prisma.platformConfig.upsert({
      where: { key: "POOL_CREATION_FEE" },
      update: { value: feeInLamports.toString() },
      create: {
        key: "POOL_CREATION_FEE",
        value: feeInLamports.toString(),
      },
    });

    // 📝 Log admin action for audit trail
    console.log(`[ADMIN] Pool creation fee updated to ${feeInLamports} lamports by wallet: ${authResult.wallet}`);

    return NextResponse.json({ success: true, feeInLamports });
  } catch (error: any) {
    console.error("Error updating pool creation fee:", error);
    return NextResponse.json(
      { error: "Failed to update pool creation fee" },
      { status: 500 }
    );
  }
}