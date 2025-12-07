import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nacl from "tweetnacl";
import bs58 from "bs58";

// Your admin wallet - only this wallet can trigger distribution
const ADMIN_WALLET = "ecfvkqWdJiYJRyUtWvuYpPWP5faf9GBcA1K6TaDW7wS";

export async function POST(request: NextRequest) {
  try {
    const { adminWallet, action, signature, message } = await request.json();

    // 1. Check wallet address matches
    if (adminWallet !== ADMIN_WALLET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify signature
    if (!signature || !message) {
      return NextResponse.json({ error: "Signature required" }, { status: 401 });
    }

    // Verify the signature is valid for this wallet
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(adminWallet);

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 3. Check message is recent (prevent replay attacks)
    // Message format: "WhaleClub Admin: {action} at {timestamp}"
    const timestampMatch = message.match(/at (\d+)/);
    if (timestampMatch) {
      const messageTime = parseInt(timestampMatch[1]);
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (now - messageTime > fiveMinutes) {
        return NextResponse.json({ error: "Signature expired" }, { status: 401 });
      }
    }

    // === AUTHORIZED - Process action ===

    if (action === "snapshot") {
      const standings = await prisma.whaleClubUser.findMany({
        where: { totalPoints: { gt: 0 } },
        orderBy: { totalPoints: "desc" },
        select: {
          walletAddress: true,
          twitterUsername: true,
          totalPoints: true,
          likesCount: true,
          retweetsCount: true,
          quotesCount: true,
        },
      });

      const totalPoints = standings.reduce((sum, user) => sum + user.totalPoints, 0);

      const distribution = standings.map((user) => ({
        ...user,
        sharePercent: totalPoints > 0 ? ((user.totalPoints / totalPoints) * 100).toFixed(2) : "0",
      }));

      return NextResponse.json({
        success: true,
        totalPoints,
        userCount: standings.length,
        distribution,
      });
    }

    if (action === "reset") {
      await prisma.whaleClubUser.updateMany({
        data: {
          totalPoints: 0,
          likesCount: 0,
          retweetsCount: 0,
          quotesCount: 0,
          lastSyncedAt: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: "All points have been reset to zero",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Admin action error:", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}