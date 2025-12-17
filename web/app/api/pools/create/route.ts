import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TelegramBotService } from '@/lib/telegram-bot';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_WALLET = process.env.ADMIN_WALLET || "ecfvkqWdJiYJRyUtWvuYpPWP5faf9GBcA1K6TaDW7wS";
const DEFAULT_MIN_FEE_LAMPORTS = 1_000_000; // 0.001 SOL fallback

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

    // Fetch current pool creation fee from database
    let minFeeLamports = DEFAULT_MIN_FEE_LAMPORTS;
    try {
      const settings = await prisma.adminSettings.findFirst();
      if (settings?.poolCreationFeeLamports) {
        minFeeLamports = settings.poolCreationFeeLamports;
      }
    } catch (e) {
      console.log("⚠️ Could not fetch fee settings, using default");
    }
    
    const connection = new Connection(process.env.HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com");
    
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

      // Parse instructions to find the actual transfer amount
      const accountKeys = tx.transaction.message.staticAccountKeys.map(k => k.toBase58());
      const adminIndex = accountKeys.indexOf(ADMIN_WALLET);

      if (adminIndex === -1) {
        console.log("❌ Admin wallet not in transaction");
        return NextResponse.json({ error: "Invalid payment - wrong recipient" }, { status: 400 });
      }

      let transferAmount = 0;
      const SYSTEM_PROGRAM = "11111111111111111111111111111111";

      // Check compiled instructions (versioned transactions)
      const compiledInstructions = (tx.transaction.message as any).compiledInstructions || [];
      for (const ix of compiledInstructions) {
        const programId = accountKeys[ix.programIdIndex];
        
        if (programId === SYSTEM_PROGRAM && ix.data && ix.data.length >= 12) {
          const data = Buffer.from(ix.data);
          const instructionType = data.readUInt32LE(0);
          
          if (instructionType === 2) { // Transfer instruction
            const lamports = data.readBigUInt64LE(4);
            const toIndex = ix.accountKeyIndexes[1];
            
            if (toIndex === adminIndex) {
              transferAmount = Number(lamports);
              console.log(`✅ Found compiled transfer to admin: ${transferAmount} lamports`);
              break;
            }
          }
        }
      }

      // Fallback: try legacy instruction format
      if (transferAmount === 0) {
        const legacyInstructions = (tx.transaction.message as any).instructions || [];
        for (const ix of legacyInstructions) {
          const programId = accountKeys[ix.programIdIndex];
          
          if (programId === SYSTEM_PROGRAM && ix.data) {
            const data = Buffer.from(ix.data, 'base64');
            if (data.length >= 12) {
              const instructionType = data.readUInt32LE(0);
              if (instructionType === 2) {
                const lamports = data.readBigUInt64LE(4);
                const toIndex = ix.accounts ? ix.accounts[1] : -1;
                
                if (toIndex === adminIndex) {
                  transferAmount = Number(lamports);
                  console.log(`✅ Found legacy transfer to admin: ${transferAmount} lamports`);
                  break;
                }
              }
            }
          }
        }
      }

      if (transferAmount < minFeeLamports) {
        console.log(`❌ Insufficient payment: ${transferAmount} lamports (need ${minFeeLamports})`);
        return NextResponse.json({ error: "Invalid payment - insufficient amount" }, { status: 400 });
      }

      console.log(`✅ Payment verified: ${transferAmount / LAMPORTS_PER_SOL} SOL to admin`);
      
    } catch (txError) {
      console.error("Error verifying payment transaction:", txError);
      return NextResponse.json({ error: "Could not verify payment transaction. Please try again." }, { status: 400 });
    }
    
    // Check if pool already exists in database
    const existingPool = await prisma.pool.findFirst({
      where: {
        tokenMint: body.tokenMint,
        poolId: body.poolId || 0,
      }
    });

    if (existingPool) {
      return NextResponse.json({ error: `Pool #${body.poolId || 0} already exists for this token.` }, { status: 400 });
    }
    
    // Check if this payment signature was already used
    const signatureUsed = await prisma.pool.findFirst({
      where: {
        pairAddress: body.paymentTxSignature,
      }
    });
    
    if (signatureUsed) {
      console.log("❌ Payment signature already used");
      return NextResponse.json({ error: "This payment has already been used" }, { status: 400 });
    }
    
    const transferTaxBps = body.transferTaxBps ? Math.min(10000, Math.max(0, parseInt(body.transferTaxBps))) : 0;
    
    const duration = body.duration ? parseInt(body.duration) : 365;
    const lockPeriod = body.lockPeriod ? parseInt(body.lockPeriod) : null;
    
    const hasReferrer = body.referrerWallet && body.referrerWallet.length > 30;
    const referralSplitPercent = hasReferrer && body.referrerSplitBps ? body.referrerSplitBps / 100 : null;
    
    const pool = await prisma.pool.create({
      data: {
        tokenMint: body.tokenMint,
        poolId: body.poolId || 0,
        name: body.name || "Unknown Token",
        symbol: body.symbol || "UNKNOWN",
        tokenDecimals: body.tokenDecimals ? parseInt(body.tokenDecimals) : null,
        apr: body.apr ? parseFloat(body.apr) : null,
        apy: body.apy ? parseFloat(body.apy) : null,
        type: body.type || "unlocked",
        lockPeriod: lockPeriod,
        duration: duration,
        rewards: body.rewards || "To be deposited",
        logo: body.logo || null,
        pairAddress: body.paymentTxSignature,
        hasSelfReflections: body.hasSelfReflections || false,
        hasExternalReflections: body.hasExternalReflections || false,
        externalReflectionMint: body.externalReflectionMint || null,
        reflectionTokenAccount: body.reflectionTokenAccount || null,
        reflectionVaultAddress: body.reflectionVaultAddress || null,
        reflectionTokenSymbol: body.reflectionTokenSymbol || null,
        isInitialized: body.isInitialized !== undefined ? body.isInitialized : true,
        isPaused: body.isPaused !== undefined ? body.isPaused : false,
        poolAddress: body.projectPda || body.poolAddress || null,
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