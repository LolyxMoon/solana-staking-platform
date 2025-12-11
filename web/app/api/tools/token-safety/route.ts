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

// Try RugCheck API for LP data
async function fetchRugCheckLP(mint: string): Promise<{ burned: number; locked: number; unlocked: number; } | null> {
  try {
    const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    
    if (!res.ok) return null;

    const data = await res.json();
    
    // Try to extract LP info from various possible locations
    if (data.markets && data.markets.length > 0) {
      for (const market of data.markets) {
        // Check for lp object
        if (market.lp) {
          const lpLockedPct = market.lp.lpLockedPct ?? market.lp.lockedPct ?? 0;
          const lpBurnedPct = market.lp.lpBurnedPct ?? market.lp.burnedPct ?? 0;
          if (lpLockedPct > 0 || lpBurnedPct > 0) {
            return {
              burned: lpBurnedPct,
              locked: lpLockedPct,
              unlocked: Math.max(0, 100 - lpLockedPct - lpBurnedPct),
            };
          }
        }
        
        // Check for direct fields
        if (market.lpLockedPct !== undefined || market.lpBurnedPct !== undefined) {
          return {
            burned: market.lpBurnedPct || 0,
            locked: market.lpLockedPct || 0,
            unlocked: Math.max(0, 100 - (market.lpLockedPct || 0) - (market.lpBurnedPct || 0)),
          };
        }
      }
    }
    
    // Check top-level
    if (data.lpLockedPct !== undefined || data.lpBurnedPct !== undefined) {
      return {
        burned: data.lpBurnedPct || 0,
        locked: data.lpLockedPct || 0,
        unlocked: Math.max(0, 100 - (data.lpLockedPct || 0) - (data.lpBurnedPct || 0)),
      };
    }

    return null;
  } catch (err) {
    console.log("RugCheck fetch failed:", err);
    return null;
  }
}

// Fetch from DexScreener - get labels and metadata
async function fetchDexScreenerData(mint: string): Promise<{
  lpInfo: { burned: number; locked: number; unlocked: number; } | null;
  name: string;
  symbol: string;
  logoURI: string | null;
  createdAt: Date | null;
}> {
  try {
    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!dexRes.ok) {
      return { lpInfo: null, name: "Unknown", symbol: "???", logoURI: null, createdAt: null };
    }

    const dexData = await dexRes.json();
    const pairs = dexData.pairs || [];
    
    // Sort by liquidity
    const bestPair = pairs.sort(
      (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    )[0];

    let name = "Unknown Token";
    let symbol = mint.slice(0, 4) + "..." + mint.slice(-4);
    let logoURI: string | null = null;
    let createdAt: Date | null = null;

    if (bestPair?.baseToken) {
      symbol = bestPair.baseToken.symbol || symbol;
      name = bestPair.baseToken.name || name;
      logoURI = bestPair.info?.imageUrl || null;
    }
    
    if (bestPair?.pairCreatedAt) {
      createdAt = new Date(bestPair.pairCreatedAt);
    }

    // Check labels for LP info (DexScreener shows these in UI)
    let lpInfo: { burned: number; locked: number; unlocked: number; } | null = null;
    
    if (bestPair?.labels && Array.isArray(bestPair.labels)) {
      const labels = bestPair.labels.map((l: string) => l.toLowerCase());
      
      // Check for burn indicators
      const hasBurn = labels.some((l: string) => 
        l.includes('burn') || l.includes('burned') || l.includes('🔥')
      );
      
      // Check for lock indicators  
      const hasLock = labels.some((l: string) => 
        l.includes('lock') || l.includes('locked') || l.includes('🔒')
      );
      
      if (hasBurn) {
        lpInfo = { burned: 100, locked: 0, unlocked: 0 };
      } else if (hasLock) {
        lpInfo = { burned: 0, locked: 100, unlocked: 0 };
      }
    }

    // Also check info object for additional data
    if (!lpInfo && bestPair?.info) {
      const info = bestPair.info;
      // Some pairs have socials/websites that might indicate LP status
      // This is a fallback check
    }

    return { lpInfo, name, symbol, logoURI, createdAt };
  } catch (err) {
    console.log("DexScreener fetch failed:", err);
    return { lpInfo: null, name: "Unknown", symbol: "???", logoURI: null, createdAt: null };
  }
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

    // 2. Fetch data from multiple sources in parallel
    const [dexScreenerData, rugCheckLP] = await Promise.all([
      fetchDexScreenerData(mint),
      fetchRugCheckLP(mint),
    ]);

    let name = dexScreenerData.name;
    let symbol = dexScreenerData.symbol;
    let logoURI = dexScreenerData.logoURI;
    let createdAt = dexScreenerData.createdAt;
    
    // Use RugCheck LP data if available, otherwise DexScreener labels
    let lpInfo = rugCheckLP || dexScreenerData.lpInfo;
    
    console.log("LP Info sources - RugCheck:", rugCheckLP, "DexScreener:", dexScreenerData.lpInfo);
    console.log("Final lpInfo:", lpInfo);

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
        const data = metadataAccount.data;
        metadataMutable = data.length > 0;
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

    // Mint authority (-30 if active)
    if (mintAuthority) {
      score -= 30;
    }

    // Freeze authority (-20 if active)
    if (freezeAuthority) {
      score -= 20;
    }

    // Transfer tax (-10 if exists)
    if (taxBps && taxBps > 0) {
      score -= 10;
      if (taxBps > 500) score -= 10;
    }

    // Top holder concentration
    if (top10Concentration > 50) {
      score -= 20;
    } else if (top10Concentration > 30) {
      score -= 10;
    }

    // Low holder count
    if (holderCount < 100) {
      score -= 10;
    }

    // New token
    if (ageInDays !== null && ageInDays < 7) {
      score -= 10;
    }

    // LP risk assessment
    if (lpInfo) {
      if (lpInfo.unlocked > 80) {
        score -= 20;
      } else if (lpInfo.unlocked > 50) {
        score -= 10;
      } else if (lpInfo.burned > 90 || lpInfo.locked > 90) {
        score += 5;
      }
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
      lpInfo,
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