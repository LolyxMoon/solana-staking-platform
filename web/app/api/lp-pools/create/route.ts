import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Connection, PublicKey } from "@solana/web3.js";
import { TelegramBotService } from '@/lib/telegram-bot';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.paymentTxSignature || typeof body.paymentTxSignature !== 'string') {
      return NextResponse.json({ error: "Missing or invalid payment transaction signature" }, { status: 400 });
    }
    
    if (!body.creatorWallet || typeof body.creatorWallet !== 'string') {
      return NextResponse.json({ error: "Missing or invalid creator wallet" }, { status: 400 });
    }
    
    if (!body.tokenMint || typeof body.tokenMint !== 'string') {
      return NextResponse.json({ error: "Missing or invalid token mint" }, { status: 400 });
    }
    
    if (!body.name || !body.symbol || body.poolId === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Validate addresses
    try {
      new PublicKey(body.creatorWallet);
      new PublicKey(body.tokenMint);
    } catch {
      return NextResponse.json({ error: "Invalid wallet address or token mint format" }, { status: 400 });
    }
    
    console.log("📥 Creating LP pool with data:", {
      symbol: body.symbol,
      creator: body.creatorWallet,
      paymentTx: body.paymentTxSignature,
    });
    
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com");
    
    // Verify payment transaction
    try {
      const tx = await connection.getTransaction(body.paymentTxSignature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      });
      
      if (!tx) {
        return NextResponse.json({ error: "Payment transaction not found. Please wait a moment and try again." }, { status: 400 });
      }

      if (tx.meta?.err) {
        return NextResponse.json({ error: "Payment transaction failed on-chain" }, { status: 400 });
      }
      
      const signers = tx.transaction.message.staticAccountKeys.map(k => k.toBase58());
      if (!signers.includes(body.creatorWallet)) {
        return NextResponse.json({ error: "Payment transaction was not signed by the creator wallet" }, { status: 400 });
      }

      console.log("✅ Payment transaction verified on-chain");
      
    } catch (txError) {
      console.error("Error verifying payment transaction:", txError);
      return NextResponse.json({ error: "Could not verify payment transaction. Please try again." }, { status: 400 });
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
      return NextResponse.json({ error: "LP pool already exists for this token and poolId" }, { status: 409 });
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

    console.log("✅ LP Pool created:", pool.id);

    // Send Telegram alert
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
      pool,
      message: "LP Pool created successfully!",
    });
    
  } catch (error: any) {
    console.error("❌ Error creating LP pool:", error);
    
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "An LP pool with this token already exists" }, { status: 400 });
    }
    
    return NextResponse.json({ error: error.message || "Failed to create LP pool" }, { status: 500 });
  }
}
