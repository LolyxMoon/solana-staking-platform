import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { Transaction, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, transaction, message } = body;

    console.log('🔍 Auth request received:');
    console.log('  Wallet:', wallet);
    console.log('  Message:', message);

    // 1️⃣ Validate request body
    if (!wallet || !transaction || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 2️⃣ Check admin authorization
    const adminWallets = process.env.ADMIN_WALLETS?.split(",").map((w) => w.trim());
    
    if (!adminWallets || !adminWallets.includes(wallet)) {
      console.warn(`⚠️ Unauthorized: ${wallet}`);
      return NextResponse.json(
        { error: "Wallet not authorized" },
        { status: 403 }
      );
    }

    console.log('✅ Wallet authorized');

    // 3️⃣ Verify the transaction signature
    try {
      console.log('🔍 Verifying transaction signature...');
      
      // Deserialize the transaction
      const txBuffer = bs58.decode(transaction);
      const tx = Transaction.from(txBuffer);
      
      // Verify the transaction is signed by the correct wallet
      const publicKey = new PublicKey(wallet);
      
      // Check if transaction has signatures
      if (!tx.signatures || tx.signatures.length === 0) {
        console.log('❌ No signatures found in transaction');
        return NextResponse.json(
          { error: "Transaction not signed" },
          { status: 401 }
        );
      }

      // Verify the signature
      const isValid = tx.verifySignatures();
      
      if (!isValid) {
        console.log('❌ Transaction signature verification failed');
        return NextResponse.json(
          { error: "Invalid transaction signature" },
          { status: 401 }
        );
      }

      // Verify the transaction is signed by the admin wallet
      const signerPublicKey = tx.signatures[0].publicKey;
      if (!signerPublicKey.equals(publicKey)) {
        console.log('❌ Transaction not signed by admin wallet');
        return NextResponse.json(
          { error: "Transaction not signed by authorized wallet" },
          { status: 401 }
        );
      }

      console.log('✅ Transaction signature verified');
    } catch (error) {
      console.error("❌ Signature verification error:", error);
      return NextResponse.json(
        { error: "Signature verification failed" },
        { status: 401 }
      );
    }

    // 4️⃣ Get JWT secret
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // 5️⃣ Generate JWT token
    const token = jwt.sign(
      { wallet },
      jwtSecret,
      { expiresIn: "24h" }
    );

    console.log(`✅ Admin authenticated: ${wallet}`);

    return NextResponse.json({
      success: true,
      token,
      wallet,
      expiresIn: "24h",
    });
  } catch (error) {
    console.error("❌ Authentication error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { valid: false, error: "No token provided" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return NextResponse.json(
        { valid: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    try {
      const payload = jwt.verify(token, jwtSecret) as { wallet: string };
      return NextResponse.json({
        valid: true,
        wallet: payload.wallet,
      });
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        return NextResponse.json(
          { valid: false, error: "Token expired" },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { valid: false, error: "Invalid token" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("❌ Token verification error:", error);
    return NextResponse.json(
      { valid: false, error: "Verification failed" },
      { status: 500 }
    );
  }
}