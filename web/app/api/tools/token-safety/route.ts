import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const HELIUS_RPC = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_ENDPOINT!;

// Known burn addresses
const BURN_ADDRESSES = new Set([
  "1nc1nerator11111111111111111111111111111111",
  "11111111111111111111111111111111",
  "1111111111111111111111111111111111111111111",
  "deaddeaddeaddeaddeaddeaddeaddeaddead",
]);

// Known locker program IDs
const LOCKER_PROGRAMS = new Set([
  "LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn", // Streamflow
  "LockKXdYQVMbhhckwH3BxoYJ9FYatcZjwNGzuFwqHdP", // Jupiter Lock
  "2r5VekMNiWPzi1pWwvJczrdPaZnJG59u91unSrTunwJg", // Raydium Lock
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // Check specific accounts
]);

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

// Check if an address is a burn address
function isBurnAddress(address: string): boolean {
  if (BURN_ADDRESSES.has(address)) return true;
  // Check for addresses starting with "1111" or containing mostly 1s
  if (address.startsWith("1111111111")) return true;
  // Check for null-like addresses
  if (address === "11111111111111111111111111111111") return true;
  return false;
}

// Analyze LP token distribution
async function analyzeLPTokens(
  connection: Connection,
  lpMint: string,
  heliusRpc: string
): Promise<{ burned: number; locked: number; unlocked: number; totalSupply: number }> {
  try {
    // Get LP mint info
    const lpMintPubkey = new PublicKey(lpMint);
    const lpMintInfo = await connection.getParsedAccountInfo(lpMintPubkey);
    
    if (!lpMintInfo.value?.data || typeof lpMintInfo.value.data !== "object") {
      return { burned: 0, locked: 0, unlocked: 100, totalSupply: 0 };
    }

    const lpParsedData = (lpMintInfo.value.data as any).parsed?.info;
    const lpDecimals = lpParsedData?.decimals || 9;
    const lpTotalSupply = Number(lpParsedData?.supply || 0) / Math.pow(10, lpDecimals);

    if (lpTotalSupply === 0) {
      return { burned: 0, locked: 0, unlocked: 100, totalSupply: 0 };
    }

    // Get LP token holders
    const holdersRes = await fetch(heliusRpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "lp-holders",
        method: "getTokenAccounts",
        params: {
          mint: lpMint,
          limit: 100,
        },
      }),
    });

    if (!holdersRes.ok) {
      return { burned: 0, locked: 0, unlocked: 100, totalSupply: lpTotalSupply };
    }

    const holdersData = await holdersRes.json();
    const accounts = holdersData.result?.token_accounts || [];

    let burnedAmount = 0;
    let lockedAmount = 0;
    let unlockedAmount = 0;

    for (const acc of accounts) {
      const owner = acc.owner;
      const amount = Number(acc.amount) / Math.pow(10, lpDecimals);

      if (amount <= 0) continue;

      if (isBurnAddress(owner)) {
        burnedAmount += amount;
      } else if (LOCKER_PROGRAMS.has(owner)) {
        lockedAmount += amount;
      } else {
        // Check if owner is a PDA of a locker program
        // For now, classify as unlocked
        unlockedAmount += amount;
      }
    }

    const totalTracked = burnedAmount + lockedAmount + unlockedAmount;
    
    // Calculate percentages
    const burned = totalTracked > 0 ? (burnedAmount / totalTracked) * 100 : 0;
    const locked = totalTracked > 0 ? (lockedAmount / totalTracked) * 100 : 0;
    const unlocked = totalTracked > 0 ? (unlockedAmount / totalTracked) * 100 : 0;

    return { burned, locked, unlocked, totalSupply: lpTotalSupply };
  } catch (err) {
    console.error("LP analysis error:", err);
    return { burned: 0, locked: 0, unlocked: 100, totalSupply: 0 };
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

    // 2. Get token metadata from DexScreener
    let name = "Unknown Token";
    let symbol = mint.slice(0, 4) + "..." + mint.slice(-4);
    let logoURI: string | null = null;
    let createdAt: Date | null = null;
    let lpMint: string | null = null;

    try {
      const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      if (dexRes.ok) {
        const dexData = await dexRes.json();
        const pairs = dexData.pairs || [];
        
        // Sort by liquidity
        const bestPair = pairs.sort(
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

        // Get LP mint from pair address (for Raydium)
        if (bestPair?.pairAddress) {
          lpMint = bestPair.pairAddress;
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

    // 4. Analyze LP tokens (burned/locked/unlocked)
    let lpInfo: { burned: number; locked: number; unlocked: number; } | null = null;
    
    if (lpMint) {
      try {
        const lpAnalysis = await analyzeLPTokens(connection, lpMint, HELIUS_RPC);
        if (lpAnalysis.totalSupply > 0) {
          lpInfo = {
            burned: lpAnalysis.burned,
            locked: lpAnalysis.locked,
            unlocked: lpAnalysis.unlocked,
          };
        }
      } catch (err) {
        console.error("LP analysis failed:", err);
      }
    }

    // 5. Check for transfer tax (Token-2022 extension)
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

    // 6. Check metadata mutability (Metaplex)
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

    // 7. Calculate age
    let ageInDays: number | null = null;
    if (createdAt) {
      ageInDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    }

    // 8. Calculate safety score
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
        // High rug risk - most LP is unlocked
        score -= 20;
      } else if (lpInfo.unlocked > 50) {
        score -= 10;
      } else if (lpInfo.burned > 90 || lpInfo.locked > 90) {
        // Bonus for burned/locked LP
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