import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Connection, PublicKey } from "@solana/web3.js";
import { TelegramBotService } from '@/lib/telegram-bot';
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import IDL from "@/lib/staking_program.json";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID!;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    if (!body.paymentTxSignature || typeof body.paymentTxSignature !== 'string') {
      return NextResponse.json({ error: "Missing or invalid payment transaction signature" }, { status: 400 });
    }
    
    if (!body.creatorWallet || typeof body.creatorWallet !== 'string') {
      return NextResponse.json({ error: "Missing or invalid creator wallet" }, { status: 400 });
    }
    
    if (!body.tokenMint || typeof body.tokenMint !== 'string') {
      return NextResponse.json({ error: "Missing or invalid token mint" }, { status: 400 });
    }
    
    try {
      new PublicKey(body.creatorWallet);
      new PublicKey(body.tokenMint);
    } catch {
      return NextResponse.json({ error: "Invalid wallet address or token mint format" }, { status: 400 });
    }
    
    console.log("📥 Creating user pool with data:", {
      symbol: body.symbol,
      creator: body.creatorWallet,
      paymentTx: body.paymentTxSignature,
    });
    
    const connection = new Connection(process.env.HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com");
    
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
    
    const existingPool = await prisma.pool.findFirst({
      where: {
        tokenMint: body.tokenMint,
        poolId: body.poolId || 0,
      }
    });

    if (existingPool) {
      return NextResponse.json({ error: `Pool #${body.poolId || 0} already exists for this token.` }, { status: 400 });
    }
    
    const transferTaxBps = body.transferTaxBps ? Math.min(10000, Math.max(0, parseInt(body.transferTaxBps))) : 0;
    
    let duration = body.duration || 365;
    let lockPeriod = body.lockPeriod ? parseInt(body.lockPeriod) : null;
    
    try {
      const wallet = new NodeWallet(new Uint8Array(32));
      const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
      const program = new Program(IDL as any, new PublicKey(PROGRAM_ID), provider);

      const [projectPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("project"), new PublicKey(body.tokenMint).toBuffer(), Buffer.from([body.poolId || 0])],
        program.programId
      );

      const projectAccount = await program.account.project.fetch(projectPDA);
      
      const poolDurationBn = (projectAccount as any).poolDuration;
      if (poolDurationBn) {
        duration = Math.floor(Number(poolDurationBn.toString()) / 86400);
      }
      
      const lockPeriodBn = (projectAccount as any).lockPeriod;
      if (lockPeriodBn) {
        lockPeriod = Math.floor(Number(lockPeriodBn.toString()) / 86400);
      }
      
    } catch (fetchError) {
      console.error("⚠️ Error fetching on-chain pool data:", fetchError);
      return NextResponse.json({ error: "Pool not found on-chain. Please create the pool on-chain first." }, { status: 400 });
    }
    
    const hasReferrer = body.referrerWallet && body.referrerWallet.length > 30;
    const referralSplitPercent = hasReferrer && body.referrerSplitBps ? body.referrerSplitBps / 100 : null;
    
    const pool = await prisma.pool.create({
      data: {
        tokenMint: body.tokenMint,
        poolId: body.poolId || 0,
        name: body.name || "Unknown Token",
        symbol: body.symbol || "UNKNOWN",
        apr: body.apr ? parseFloat(body.apr) : null,
        apy: body.apy ? parseFloat(body.apy) : null,
        type: body.type || "unlocked",
        lockPeriod: lockPeriod,
        duration: duration,
        rewards: body.rewards || "To be deposited",
        logo: body.logo || null,
        pairAddress: body.pairAddress || null,
        hasSelfReflections: body.hasSelfReflections || false,
        hasExternalReflections: body.hasExternalReflections || false,
        externalReflectionMint: body.externalReflectionMint || null,
        reflectionTokenAccount: body.reflectionTokenAccount || null,
        reflectionVaultAddress: body.reflectionVaultAddress || null,
        reflectionTokenSymbol: body.reflectionTokenSymbol || null,
        isInitialized: body.isInitialized || false,
        isPaused: body.isPaused !== undefined ? body.isPaused : true,
        poolAddress: body.projectPda || null,
        transferTaxBps: transferTaxBps,
        featured: false,
        hidden: false,
        referralEnabled: hasReferrer,
        referralWallet: hasReferrer ? body.referrerWallet : null,
        referralSplitPercent: referralSplitPercent,
      },
    });
    
    console.log("✅ User pool created:", pool.id);
    
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
    }
    
    return NextResponse.json({
      success: true,
      pool,
      message: "Pool created successfully!",
    });
    
  } catch (err: any) {
    console.error("❌ Error creating user pool:", err);
    
    if (err.code === 'P2002') {
      return NextResponse.json({ error: "A pool with this token already exists" }, { status: 400 });
    }
    
    return NextResponse.json({ error: err.message || "Failed to create pool" }, { status: 500 });
  }
}
