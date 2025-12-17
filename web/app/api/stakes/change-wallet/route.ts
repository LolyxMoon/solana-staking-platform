import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PATCH - Change wallet address for stakes
 * 
 * ⚠️ SECURITY: This is a highly sensitive operation.
 * Requires signature verification from BOTH old and new wallets.
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { 
      poolId, 
      oldWallet, 
      newWallet, 
      message,           // The message that was signed
      oldWalletSignature, // Signature from old wallet proving ownership
      newWalletSignature  // Signature from new wallet proving they accept
    } = body;

    // Validate required fields
    if (!poolId || !oldWallet || !newWallet || !message || !oldWalletSignature || !newWalletSignature) {
      return NextResponse.json(
        { error: "Missing required fields. Both wallets must sign the transfer request." },
        { status: 400 }
      );
    }

    // Validate public key formats
    try {
      new PublicKey(oldWallet);
      new PublicKey(newWallet);
    } catch {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 }
      );
    }

    // ✅ Verify the message contains expected data
    const expectedMessage = `Transfer stakes from ${oldWallet} to ${newWallet} for pool ${poolId}`;
    if (message !== expectedMessage) {
      return NextResponse.json(
        { error: "Invalid message format" },
        { status: 400 }
      );
    }

    // ✅ Verify OLD wallet signature (proves current owner approves transfer)
    try {
      const messageBytes = new TextEncoder().encode(message);
      const oldSignatureBytes = bs58.decode(oldWalletSignature);
      const oldPublicKeyBytes = bs58.decode(oldWallet);
      
      const oldValid = nacl.sign.detached.verify(messageBytes, oldSignatureBytes, oldPublicKeyBytes);
      if (!oldValid) {
        return NextResponse.json(
          { error: "Invalid signature from current wallet owner" },
          { status: 403 }
        );
      }
    } catch (err) {
      return NextResponse.json(
        { error: "Could not verify old wallet signature" },
        { status: 400 }
      );
    }

    // ✅ Verify NEW wallet signature (proves new owner accepts transfer)
    try {
      const messageBytes = new TextEncoder().encode(message);
      const newSignatureBytes = bs58.decode(newWalletSignature);
      const newPublicKeyBytes = bs58.decode(newWallet);
      
      const newValid = nacl.sign.detached.verify(messageBytes, newSignatureBytes, newPublicKeyBytes);
      if (!newValid) {
        return NextResponse.json(
          { error: "Invalid signature from new wallet" },
          { status: 403 }
        );
      }
    } catch (err) {
      return NextResponse.json(
        { error: "Could not verify new wallet signature" },
        { status: 400 }
      );
    }

    console.log('✅ [CHANGE-WALLET] Both signatures verified');

    // Check stakes exist for old wallet
    const existingStakes = await prisma.stake.findMany({
      where: {
        poolId,
        userId: oldWallet,
      },
    });

    if (existingStakes.length === 0) {
      return NextResponse.json(
        { error: "No stakes found for this wallet in this pool" },
        { status: 404 }
      );
    }

    // ⚠️ NOTE: This only updates the DATABASE record.
    // The actual on-chain stake ownership cannot be changed this way.
    // This should only be used if your smart contract supports authority transfer,
    // and this API should be called AFTER the on-chain transfer is complete.

    // Update all stakes for this user in this pool
    const result = await prisma.stake.updateMany({
      where: {
        poolId,
        userId: oldWallet,
      },
      data: {
        userId: newWallet,
      },
    });

    console.log('✅ [CHANGE-WALLET] Updated', result.count, 'stakes');

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
    });

  } catch (err) {
    console.error("Error changing wallet:", err);
    return NextResponse.json(
      { error: "Failed to change wallet" },
      { status: 500 }
    );
  }
}