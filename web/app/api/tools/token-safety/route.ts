import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const HELIUS_RPC = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_ENDPOINT!;

interface TokenSafetyResult {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: number;
  logoURI: string | null;
  mintAuthority: { status: "safe" | "warning" | "danger"; value: string | null; };
  freezeAuthority: { status: "safe" | "warning" | "danger"; value: string | null; };
  isToken2022: boolean;
  hasTransferTax: { status: "safe" | "warning"; taxBps: number | null; };
  metadataMutable: { status: "safe" | "warning"; mutable: boolean; };
  topHolders: { wallet: string; percentage: number; }[];
  top10Concentration: number;
  holderCount: number;
  lpInfo: { burned: number; locked: number; unlocked: number; } | null;
  createdAt: Date | null;
  ageInDays: number | null;
  overallScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export async function POST(req: Request) {
  try {
    const { mint } = await req.json();

    if (!mint) {
      return NextResponse.json({ error: "Mint address required" }, { status: 400 });
    }

    let mintPubkey: PublicKey;
    try {
      mintPubkey = new PublicKey(mint);
    } catch {
      return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
    }

    const connection = new Connection(HELIUS_RPC, "confirmed");

    // 1. Get mint account info
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
    
    if (!mintInfo.value?.data || typeof mintInfo.value.data !== "object") {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    const parsedData = (mintInfo.value.data as any).parsed?.info;
    if (!parsedData) {
      return NextResponse.json({ error: "Invalid token data" }, { status: 400 });
    }

    const decimals = parsedData.decimals;
    const totalSupply = Number(parsedData.supply) / Math.pow(10, decimals);
    const mintAuthority = parsedData.mintAuthority;
    const freezeAuthority = parsedData.freezeAuthority;
    
    // Check if Token-2022
    const isToken2022 = mintInfo.value.owner.toString() === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

    // 2. Get token metadata from DexScreener
    let name = "Unknown Token";
    let symbol = mint.slice(0, 4) + "..." + mint.slice(-4);
    let logoURI: string | null = null;
    let createdAt: Date | null = null;

    try {
      const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      if (dexRes.ok) {
        const dexData = await dexRes.json();
        const bestPair = dexData.pairs?.sort(
          (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];

        if (bestPair?.baseToken) {
          symbol = bestPair.baseToken.symbol || symbol;
          name = bestPair.baseToken.name || name;
          logoURI = bestPair.info?.imageUrl || null;
        }
        
        if (bestPair?.pairCreatedAt) {
          createdAt = new Date(bestPair.pairCreatedAt);
        }
      }
    } catch {
      // Silent fail
    }

    // 3. Get top holders using Helius
    let topHolders: { wallet: string; percentage: number; }[] = [];
    let holderCount = 0;
    let top10Concentration = 0;

    try {
      const holdersRes = await fetch(HELIUS_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "holders",
          method: "getTokenAccounts",
          params: {
            mint: mint,
            limit: 1000,
          },
        }),
      });

      if (holdersRes.ok) {
        const holdersData = await holdersRes.json();
        const accounts = holdersData.result?.token_accounts || [];
        
        // Aggregate by owner
        const holderMap = new Map<string, number>();
        for (const acc of accounts) {
          const owner = acc.owner;
          const amount = Number(acc.amount) / Math.pow(10, decimals);
          if (amount > 0) {
            holderMap.set(owner, (holderMap.get(owner) || 0) + amount);
          }
        }

        // Sort by balance
        const sortedHolders = Array.from(holderMap.entries())
          .map(([wallet, balance]) => ({ wallet, balance }))
          .sort((a, b) => b.balance - a.balance);

        holderCount = sortedHolders.length;
        const totalHeld = sortedHolders.reduce((sum, h) => sum + h.balance, 0);

        // Calculate percentages
        topHolders = sortedHolders.slice(0, 10).map(h => ({
          wallet: h.wallet,
          percentage: totalHeld > 0 ? (h.balance / totalHeld) * 100 : 0,
        }));

        top10Concentration = topHolders.reduce((sum, h) => sum + h.percentage, 0);
      }
    } catch (err) {
      console.error("Error fetching holders:", err);
    }

    // 4. Check for transfer tax (Token-2022 extension)
    let taxBps: number | null = null;
    if (isToken2022) {
      try {
        // Token-2022 extensions are in the account data
        // For simplicity, we'll check if there's a transfer fee config
        const extensions = (mintInfo.value.data as any).parsed?.info?.extensions;
        if (extensions) {
          const transferFee = extensions.find((e: any) => e.extension === "transferFeeConfig");
          if (transferFee) {
            taxBps = transferFee.state?.newerTransferFee?.transferFeeBasisPoints || 
                     transferFee.state?.olderTransferFee?.transferFeeBasisPoints || 0;
          }
        }
      } catch {
        // No transfer fee
      }
    }

    // 5. Check metadata mutability (Metaplex)
    let metadataMutable = true;
    try {
      const METADATA_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
      const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM.toBuffer(),
          mintPubkey.toBuffer(),
        ],
        METADATA_PROGRAM
      );

      const metadataAccount = await connection.getAccountInfo(metadataPDA);
      if (metadataAccount) {
        // Byte 0 is key, byte 1 is update authority present flag
        // Byte at position ~1 + 32 + 32 + ... contains isMutable flag
        // For simplicity, check if update authority exists
        const data = metadataAccount.data;
        // isMutable is typically at a specific offset in v1 metadata
        // This is a simplified check - in production use @metaplex-foundation/js
        metadataMutable = data.length > 0; // Simplified - assume mutable if metadata exists
      }
    } catch {
      // Default to mutable if can't determine
    }

    // 6. Calculate age
    let ageInDays: number | null = null;
    if (createdAt) {
      ageInDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    }

    // 7. Calculate safety score
    let score = 100;
    const issues: string[] = [];

    // Mint authority (-30 if active)
    if (mintAuthority) {
      score -= 30;
      issues.push("Mint authority active");
    }

    // Freeze authority (-20 if active)
    if (freezeAuthority) {
      score -= 20;
      issues.push("Freeze authority active");
    }

    // Transfer tax (-10 if exists)
    if (taxBps && taxBps > 0) {
      score -= 10;
      if (taxBps > 500) score -= 10; // Extra penalty for high tax
      issues.push("Has transfer tax");
    }

    // Top holder concentration
    if (top10Concentration > 50) {
      score -= 20;
      issues.push("High concentration");
    } else if (top10Concentration > 30) {
      score -= 10;
      issues.push("Moderate concentration");
    }

    // Low holder count
    if (holderCount < 100) {
      score -= 10;
      issues.push("Low holder count");
    }

    // New token
    if (ageInDays !== null && ageInDays < 7) {
      score -= 10;
      issues.push("New token");
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // Determine risk level
    let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    if (score >= 80) riskLevel = "LOW";
    else if (score >= 60) riskLevel = "MEDIUM";
    else if (score >= 40) riskLevel = "HIGH";
    else riskLevel = "CRITICAL";

    const result: TokenSafetyResult = {
      mint,
      name,
      symbol,
      decimals,
      totalSupply,
      logoURI,
      mintAuthority: {
        status: mintAuthority ? "danger" : "safe",
        value: mintAuthority,
      },
      freezeAuthority: {
        status: freezeAuthority ? "danger" : "safe",
        value: freezeAuthority,
      },
      isToken2022,
      hasTransferTax: {
        status: taxBps && taxBps > 0 ? "warning" : "safe",
        taxBps,
      },
      metadataMutable: {
        status: metadataMutable ? "warning" : "safe",
        mutable: metadataMutable,
      },
      topHolders,
      top10Concentration,
      holderCount,
      lpInfo: null, // Could add LP analysis later
      createdAt,
      ageInDays,
      overallScore: score,
      riskLevel,
    };

    return NextResponse.json({ success: true, result });

  } catch (err: any) {
    console.error("Token safety error:", err);
    return NextResponse.json({ error: err.message || "Analysis failed" }, { status: 500 });
  }
}