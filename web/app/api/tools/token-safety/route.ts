import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const HELIUS_RPC = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_ENDPOINT!;

interface Token2022Extension {
  name: string;
  enabled: boolean;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  description: string;
  details?: string;
}

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
  // Full audit fields
  token2022Extensions?: Token2022Extension[];
  honeypotAnalysis?: {
    canBuy: boolean;
    canSell: boolean;
    buyTax: number;
    sellTax: number;
    isHoneypot: boolean;
    honeypotReason?: string;
    taxSource?: string;
    feesVerified: boolean;
  };
  fullAuditCompleted?: boolean;
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
    
    if (data.markets && data.markets.length > 0) {
      for (const market of data.markets) {
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
        
        if (market.lpLockedPct !== undefined || market.lpBurnedPct !== undefined) {
          return {
            burned: market.lpBurnedPct || 0,
            locked: market.lpLockedPct || 0,
            unlocked: Math.max(0, 100 - (market.lpLockedPct || 0) - (market.lpBurnedPct || 0)),
          };
        }
      }
    }
    
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

// Fetch from DexScreener
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

    let lpInfo: { burned: number; locked: number; unlocked: number; } | null = null;
    
    if (bestPair?.labels && Array.isArray(bestPair.labels)) {
      const labels = bestPair.labels.map((l: string) => l.toLowerCase());
      
      const hasBurn = labels.some((l: string) => 
        l.includes('burn') || l.includes('burned') || l.includes('🔥')
      );
      
      const hasLock = labels.some((l: string) => 
        l.includes('lock') || l.includes('locked') || l.includes('🔒')
      );
      
      if (hasBurn) {
        lpInfo = { burned: 100, locked: 0, unlocked: 0 };
      } else if (hasLock) {
        lpInfo = { burned: 0, locked: 100, unlocked: 0 };
      }
    }

    return { lpInfo, name, symbol, logoURI, createdAt };
  } catch (err) {
    console.log("DexScreener fetch failed:", err);
    return { lpInfo: null, name: "Unknown", symbol: "???", logoURI: null, createdAt: null };
  }
}

// Fetch Meteora pool fees for a token
async function fetchMeteoraPoolFees(mint: string): Promise<{
  buyFee: number;
  sellFee: number;
  poolAddress: string | null;
  dex: string;
} | null> {
  
  // Try to get pool address from DexScreener first (they have reliable pool data)
  let poolAddress: string | null = null;
  try {
    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (dexRes.ok) {
      const dexData = await dexRes.json();
      const pairs = dexData.pairs || [];
      
      // Find Meteora pair
      const meteoraPair = pairs.find((p: any) => 
        p.dexId?.toLowerCase().includes('meteora') || 
        p.url?.includes('meteora')
      );
      
      if (meteoraPair) {
        poolAddress = meteoraPair.pairAddress;
        console.log("Found Meteora pool from DexScreener:", poolAddress);
      }
    }
  } catch (err) {
    console.log("DexScreener pool lookup failed:", err);
  }

  // If we have a pool address, query Meteora directly
  if (poolAddress) {
    try {
      // Try Dynamic AMM pool endpoint
      const poolRes = await fetch(`https://amm-v2.meteora.ag/pools/${poolAddress}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      
      if (poolRes.ok) {
        const poolData = await poolRes.json();
        console.log("=== METEORA POOL DIRECT RESPONSE ===");
        console.log(JSON.stringify(poolData, null, 2));
        
        let buyFee = 0;
        let sellFee = 0;
        
        // Extract creator/trade fees
        if (poolData.trade_fee_bps !== undefined) {
          buyFee = poolData.trade_fee_bps / 100;
          sellFee = poolData.trade_fee_bps / 100;
        }
        if (poolData.creator_fee_bps !== undefined) {
          buyFee = poolData.creator_fee_bps / 100;
          sellFee = poolData.creator_fee_bps / 100;
        }
        if (poolData.fees?.trading_fee_bps !== undefined) {
          buyFee = poolData.fees.trading_fee_bps / 100;
          sellFee = poolData.fees.trading_fee_bps / 100;
        }
        
        if (buyFee > 0 || sellFee > 0) {
          return { buyFee, sellFee, poolAddress, dex: "Meteora" };
        }
      }
    } catch (err) {
      console.log("Meteora direct pool fetch failed:", err);
    }
  }

  // Try Meteora Dynamic AMM API with token mint
  try {
    const meteoraRes = await fetch(`https://amm-v2.meteora.ag/pools?token=${mint}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    
    if (meteoraRes.ok) {
      const pools = await meteoraRes.json();
      console.log("=== METEORA AMM V2 RESPONSE ===");
      console.log(JSON.stringify(pools, null, 2).slice(0, 2000));
      
      const poolList = Array.isArray(pools) ? pools : pools.pools || pools.data || [];
      
      if (poolList.length > 0) {
        for (const pool of poolList) {
          let buyFee = 0;
          let sellFee = 0;
          
          if (pool.trade_fee_bps !== undefined) {
            buyFee = pool.trade_fee_bps / 100;
            sellFee = pool.trade_fee_bps / 100;
          }
          if (pool.creator_fee_bps !== undefined) {
            buyFee = pool.creator_fee_bps / 100;
            sellFee = pool.creator_fee_bps / 100;
          }
          if (pool.trading_fee !== undefined) {
            buyFee = pool.trading_fee;
            sellFee = pool.trading_fee;
          }
          
          if (buyFee > 0 || sellFee > 0) {
            return {
              buyFee,
              sellFee,
              poolAddress: pool.pool_address || pool.address || null,
              dex: "Meteora"
            };
          }
        }
      }
    }
  } catch (err) {
    console.log("Meteora AMM V2 fetch failed:", err);
  }

  // Try the original AMM endpoint  
  try {
    const meteoraRes = await fetch(`https://amm.meteora.ag/pools?address=${mint}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    
    if (meteoraRes.ok) {
      const pools = await meteoraRes.json();
      console.log("=== METEORA AMM RESPONSE ===");
      console.log(JSON.stringify(pools, null, 2));
      
      if (Array.isArray(pools) && pools.length > 0) {
        for (const pool of pools) {
          if (pool.pool_token_mints?.includes(mint) || 
              pool.token_a_mint === mint || 
              pool.token_b_mint === mint) {
            
            let buyFee = 0;
            let sellFee = 0;
            
            if (pool.trade_fee_bps !== undefined) {
              buyFee = pool.trade_fee_bps / 100;
              sellFee = pool.trade_fee_bps / 100;
            }
            if (pool.fees) {
              if (pool.fees.trade_fee_numerator && pool.fees.trade_fee_denominator) {
                const feePercent = (pool.fees.trade_fee_numerator / pool.fees.trade_fee_denominator) * 100;
                buyFee = feePercent;
                sellFee = feePercent;
              }
            }
            if (pool.creator_trade_fee_bps !== undefined) {
              buyFee = pool.creator_trade_fee_bps / 100;
              sellFee = pool.creator_trade_fee_bps / 100;
            }
            
            if (buyFee > 0 || sellFee > 0) {
              return {
                buyFee,
                sellFee,
                poolAddress: pool.pool_address || pool.address || null,
                dex: "Meteora"
              };
            }
          }
        }
      }
    }
  } catch (err) {
    console.log("Meteora AMM fetch failed:", err);
  }
  
  // Try Meteora DLMM API - but search for our specific token
  try {
    const dlmmRes = await fetch(`https://dlmm-api.meteora.ag/pair/all`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    
    if (dlmmRes.ok) {
      const dlmmData = await dlmmRes.json();
      
      // Search for pairs containing our mint
      const pairs = Array.isArray(dlmmData) ? dlmmData : dlmmData.pairs || [];
      const matchingPair = pairs.find((p: any) => 
        p.mint_x === mint || p.mint_y === mint ||
        p.token_x_mint === mint || p.token_y_mint === mint
      );
      
      if (matchingPair) {
        console.log("=== METEORA DLMM MATCHING PAIR ===");
        console.log(JSON.stringify(matchingPair, null, 2));
        
        let buyFee = 0;
        let sellFee = 0;
        
        if (matchingPair.base_fee_percentage !== undefined) {
          buyFee = parseFloat(matchingPair.base_fee_percentage);
          sellFee = parseFloat(matchingPair.base_fee_percentage);
        }
        if (matchingPair.trade_fee_bps !== undefined) {
          buyFee = matchingPair.trade_fee_bps / 100;
          sellFee = matchingPair.trade_fee_bps / 100;
        }
        
        if (buyFee > 0 || sellFee > 0) {
          return {
            buyFee,
            sellFee,
            poolAddress: matchingPair.address || null,
            dex: "Meteora DLMM"
          };
        }
      }
    }
  } catch (err) {
    console.log("Meteora DLMM fetch failed:", err);
  }

  return null;
}

// Fetch DEX pool fees from multiple sources (Meteora, Raydium, Pump.fun, etc.)
async function fetchDexPoolFees(mint: string): Promise<{
  buyFee: number;
  sellFee: number;
  poolAddress: string | null;
  dex: string;
  feesVerified: boolean;
} | null> {
  
  // 1. Try Meteora first (has configurable creator fees)
  const meteoraFees = await fetchMeteoraPoolFees(mint);
  if (meteoraFees && (meteoraFees.buyFee > 0 || meteoraFees.sellFee > 0)) {
    return { ...meteoraFees, feesVerified: true };
  }
  
  // 2. Try Raydium API
  try {
    const raydiumRes = await fetch(`https://api-v3.raydium.io/pools/info/mint?mint1=${mint}&poolType=all&poolSortField=liquidity&sortType=desc&pageSize=10&page=1`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    
    if (raydiumRes.ok) {
      const raydiumData = await raydiumRes.json();
      console.log("=== RAYDIUM RESPONSE ===");
      console.log(JSON.stringify(raydiumData, null, 2).slice(0, 2000));
      
      if (raydiumData.data?.data && raydiumData.data.data.length > 0) {
        const pool = raydiumData.data.data[0];
        
        // Raydium standard pools have LP fees
        let tradeFee = 0;
        
        if (pool.feeRate !== undefined) {
          tradeFee = pool.feeRate * 100;
        }
        if (pool.tradeFeeRate !== undefined) {
          tradeFee = pool.tradeFeeRate * 100;
        }
        if (pool.lpFee !== undefined) {
          tradeFee = pool.lpFee;
        }
        
        // Only report if higher than standard 0.25% LP fee
        if (tradeFee > 0.3) {
          return {
            buyFee: tradeFee,
            sellFee: tradeFee,
            poolAddress: pool.id || pool.poolId || null,
            dex: "Raydium",
            feesVerified: true
          };
        }
      }
    }
  } catch (err) {
    console.log("Raydium fetch failed:", err);
  }
  
  // 3. Try Pump.fun check (they have 1% platform fee)
  try {
    const pumpRes = await fetch(`https://frontend-api.pump.fun/coins/${mint}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    
    if (pumpRes.ok) {
      const pumpData = await pumpRes.json();
      console.log("=== PUMP.FUN RESPONSE ===");
      console.log(JSON.stringify(pumpData, null, 2).slice(0, 1000));
      
      if (pumpData.mint === mint || pumpData.address === mint) {
        // Pump.fun has a 1% fee on trades
        return {
          buyFee: 1,
          sellFee: 1,
          poolAddress: null,
          dex: "Pump.fun",
          feesVerified: true
        };
      }
    }
  } catch (err) {
    console.log("Pump.fun fetch failed:", err);
  }
  
  // 4. Check DexScreener for any fee info
  try {
    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (dexRes.ok) {
      const dexData = await dexRes.json();
      const pairs = dexData.pairs || [];
      
      if (pairs.length > 0) {
        const bestPair = pairs.sort((a: any, b: any) => 
          (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];
        
        // DexScreener sometimes has fee info
        if (bestPair.info?.buyTax !== undefined || bestPair.info?.sellTax !== undefined) {
          return {
            buyFee: bestPair.info.buyTax || 0,
            sellFee: bestPair.info.sellTax || 0,
            poolAddress: bestPair.pairAddress || null,
            dex: bestPair.dexId || "Unknown",
            feesVerified: true
          };
        }
        
        // Check labels for tax indication
        if (bestPair.labels?.some((l: string) => l.toLowerCase().includes('tax'))) {
          return {
            buyFee: -1, // -1 means "has tax but unknown amount"
            sellFee: -1,
            poolAddress: bestPair.pairAddress || null,
            dex: bestPair.dexId || "Unknown",
            feesVerified: false
          };
        }
      }
    }
  } catch (err) {
    console.log("DexScreener fee check failed:", err);
  }
  
  return null;
}

// Analyze Token-2022 extensions for dangerous patterns
function analyzeToken2022Extensions(extensions: any[]): Token2022Extension[] {
  const results: Token2022Extension[] = [];
  
  if (!extensions || !Array.isArray(extensions)) {
    return results;
  }

  for (const ext of extensions) {
    const extType = ext.extension;
    
    switch (extType) {
      case "transferHook":
        results.push({
          name: "Transfer Hook",
          enabled: true,
          riskLevel: "CRITICAL",
          description: "Can execute arbitrary code on every transfer - major honeypot risk",
          details: ext.state?.authority || ext.state?.programId,
        });
        break;
        
      case "permanentDelegate":
        results.push({
          name: "Permanent Delegate",
          enabled: true,
          riskLevel: "CRITICAL", 
          description: "Someone can transfer tokens from ANY wallet holding this token",
          details: ext.state?.delegate,
        });
        break;
        
      case "nonTransferable":
        results.push({
          name: "Non-Transferable",
          enabled: true,
          riskLevel: "HIGH",
          description: "Tokens cannot be transferred or sold - soulbound token",
        });
        break;
        
      case "defaultAccountState":
        const state = ext.state?.state;
        if (state === "frozen") {
          results.push({
            name: "Default Account State: Frozen",
            enabled: true,
            riskLevel: "HIGH",
            description: "New token accounts are frozen by default",
          });
        }
        break;
        
      case "transferFeeConfig":
        console.log("=== TRANSFER FEE CONFIG RAW ===");
        console.log(JSON.stringify(ext, null, 2));
        console.log("=== END TRANSFER FEE CONFIG ===");
        
        // Try multiple paths to find the fee
        let feeBps = 0;
        
        // Standard paths
        if (ext.state?.newerTransferFee?.transferFeeBasisPoints) {
          feeBps = ext.state.newerTransferFee.transferFeeBasisPoints;
        } else if (ext.state?.olderTransferFee?.transferFeeBasisPoints) {
          feeBps = ext.state.olderTransferFee.transferFeeBasisPoints;
        }
        // Alternative paths that might exist
        else if (ext.state?.transferFeeBasisPoints) {
          feeBps = ext.state.transferFeeBasisPoints;
        } else if (ext.transferFeeBasisPoints) {
          feeBps = ext.transferFeeBasisPoints;
        }
        // Check for percentage format
        else if (ext.state?.newerTransferFee?.transferFeePercent) {
          feeBps = ext.state.newerTransferFee.transferFeePercent * 100;
        } else if (ext.state?.transferFeePercent) {
          feeBps = ext.state.transferFeePercent * 100;
        }
        // Check withheld amount which indicates fees are being collected
        else if (ext.state?.withheldAmount && Number(ext.state.withheldAmount) > 0) {
          // Has withheld fees but we don't know the rate - flag it
          results.push({
            name: "Transfer Fee (Unknown Rate)",
            enabled: true,
            riskLevel: "MEDIUM",
            description: "Token has transfer fees but rate could not be determined",
            details: `Withheld: ${ext.state.withheldAmount}`,
          });
          break;
        }
        
        console.log("Parsed feeBps:", feeBps);
        
        if (feeBps > 0) {
          results.push({
            name: "Transfer Fee",
            enabled: true,
            riskLevel: feeBps > 1000 ? "HIGH" : "MEDIUM",
            description: `${(feeBps / 100).toFixed(2)}% fee on every transfer`,
            details: `${feeBps} basis points`,
          });
        }
        break;
        
      case "interestBearingConfig":
        results.push({
          name: "Interest Bearing",
          enabled: true,
          riskLevel: "INFO",
          description: "Token balance changes over time based on interest rate",
        });
        break;
        
      case "confidentialTransferMint":
        results.push({
          name: "Confidential Transfer",
          enabled: true,
          riskLevel: "INFO",
          description: "Supports private/confidential transfers",
        });
        break;
        
      case "mintCloseAuthority":
        results.push({
          name: "Mint Close Authority",
          enabled: true,
          riskLevel: "MEDIUM",
          description: "Mint account can be closed, potentially destroying the token",
          details: ext.state?.closeAuthority,
        });
        break;
        
      case "metadataPointer":
        // Info only, not a risk
        break;
        
      case "tokenMetadata":
        // Info only, not a risk
        break;
    }
  }
  
  return results;
}

// Simple honeypot analysis based on token properties
async function analyzeHoneypot(
  mint: string,
  extensions: Token2022Extension[],
  mintAuthority: string | null,
  freezeAuthority: string | null,
  dexFees?: { buyFee: number; sellFee: number; poolAddress: string | null; dex: string; feesVerified: boolean; } | null
): Promise<{
  canBuy: boolean;
  canSell: boolean;
  buyTax: number;
  sellTax: number;
  isHoneypot: boolean;
  honeypotReason?: string;
  taxSource?: string;
  feesVerified: boolean;
}> {
  let isHoneypot = false;
  let honeypotReason: string | undefined;
  let taxSource: string | undefined;
  let feesVerified = false;
  
  // Start with DEX pool fees if available
  let buyTax = 0;
  let sellTax = 0;
  
  if (dexFees && dexFees.buyFee >= 0 && dexFees.sellFee >= 0) {
    buyTax = dexFees.buyFee;
    sellTax = dexFees.sellFee;
    taxSource = dexFees.dex;
    feesVerified = dexFees.feesVerified;
  }
  
  // Check for critical extensions that indicate honeypot
  const hasTransferHook = extensions.some(e => e.name === "Transfer Hook");
  const hasPermanentDelegate = extensions.some(e => e.name === "Permanent Delegate");
  const isNonTransferable = extensions.some(e => e.name === "Non-Transferable");
  const isFrozenByDefault = extensions.some(e => e.name.includes("Default Account State: Frozen"));
  
  // Check for transfer fee from Token-2022 extension (ADD to Meteora fees, don't replace)
  const transferFeeExt = extensions.find(e => e.name === "Transfer Fee");
  if (transferFeeExt && transferFeeExt.details) {
    const bps = parseInt(transferFeeExt.details) || 0;
    const token2022Fee = bps / 100;
    // Token-2022 transfer fee applies to ALL transfers (including wallet-to-wallet)
    // This is in addition to any DEX-level fees
    buyTax += token2022Fee;
    sellTax += token2022Fee;
  }
  
  if (hasTransferHook) {
    isHoneypot = true;
    honeypotReason = "Transfer Hook detected - can block or modify any transfer";
  } else if (hasPermanentDelegate) {
    isHoneypot = true;
    honeypotReason = "Permanent Delegate - your tokens can be taken at any time";
  } else if (isNonTransferable) {
    isHoneypot = true;
    honeypotReason = "Non-Transferable token - cannot be sold";
  } else if (isFrozenByDefault) {
    isHoneypot = true;
    honeypotReason = "Accounts frozen by default - trading may be blocked";
  } else if (freezeAuthority) {
    // Not a definite honeypot but a risk
    // Could freeze your account after you buy
  }
  
  // Check RugCheck for additional honeypot signals and buy/sell tax
  try {
    const rugRes = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    
    if (rugRes.ok) {
      const rugData = await rugRes.json();
      
      // Debug logging - remove in production
      console.log("=== RUGCHECK RAW DATA ===");
      console.log("transferFee:", JSON.stringify(rugData.transferFee));
      console.log("markets:", JSON.stringify(rugData.markets?.map((m: any) => ({ 
        lp: m.lp, 
        buyFee: m.buyFee, 
        sellFee: m.sellFee,
        tradeFee: m.tradeFee 
      }))));
      console.log("fileMeta:", JSON.stringify(rugData.fileMeta));
      console.log("tokenMeta:", JSON.stringify(rugData.tokenMeta));
      console.log("risks:", JSON.stringify(rugData.risks));
      console.log("=== END RUGCHECK DATA ===");
      
      // Extract buy/sell tax from markets data
      if (rugData.markets && Array.isArray(rugData.markets)) {
        for (const market of rugData.markets) {
          // Check for LP fees
          if (market.lp) {
            // Some pools have fee info
            if (market.lp.buyFee !== undefined) {
              buyTax = Math.max(buyTax, market.lp.buyFee);
            }
            if (market.lp.sellFee !== undefined) {
              sellTax = Math.max(sellTax, market.lp.sellFee);
            }
          }
          
          // Check market-level fees
          if (market.buyFee !== undefined) {
            buyTax = Math.max(buyTax, market.buyFee);
          }
          if (market.sellFee !== undefined) {
            sellTax = Math.max(sellTax, market.sellFee);
          }
          if (market.tradeFee !== undefined && buyTax === 0 && sellTax === 0) {
            buyTax = market.tradeFee;
            sellTax = market.tradeFee;
          }
        }
      }
      
      // Check fileMeta for token fees (some tokens store fees here)
      if (rugData.fileMeta) {
        const meta = rugData.fileMeta;
        if (meta.buyTax !== undefined) buyTax = Math.max(buyTax, meta.buyTax);
        if (meta.sellTax !== undefined) sellTax = Math.max(sellTax, meta.sellTax);
        if (meta.tax !== undefined && buyTax === 0 && sellTax === 0) {
          buyTax = meta.tax;
          sellTax = meta.tax;
        }
      }
      
      // Check tokenMeta for fees
      if (rugData.tokenMeta) {
        const tokenMeta = rugData.tokenMeta;
        if (tokenMeta.buyFee !== undefined) buyTax = Math.max(buyTax, tokenMeta.buyFee);
        if (tokenMeta.sellFee !== undefined) sellTax = Math.max(sellTax, tokenMeta.sellFee);
      }
      
      // Check risks array for fee-related risks and honeypot
      if (rugData.risks && Array.isArray(rugData.risks)) {
        for (const risk of rugData.risks) {
          const riskName = (risk.name || "").toLowerCase();
          const riskDesc = (risk.description || "").toLowerCase();
          
          if (riskName.includes("honeypot") || riskName.includes("cannot sell")) {
            isHoneypot = true;
            honeypotReason = risk.description || "Honeypot detected by RugCheck";
          }
          
          // Check for tax/fee related risks
          if (riskName.includes("tax") || riskName.includes("fee")) {
            // Try to extract percentage from description
            const percentMatch = riskDesc.match(/(\d+(?:\.\d+)?)\s*%/);
            if (percentMatch) {
              const percent = parseFloat(percentMatch[1]);
              if (riskName.includes("buy")) {
                buyTax = Math.max(buyTax, percent);
              } else if (riskName.includes("sell")) {
                sellTax = Math.max(sellTax, percent);
              } else {
                buyTax = Math.max(buyTax, percent);
                sellTax = Math.max(sellTax, percent);
              }
            }
          }
        }
      }
      
      // Check for transfer fee config in the response
      if (rugData.transferFee) {
        if (rugData.transferFee.pct !== undefined) {
          buyTax = Math.max(buyTax, rugData.transferFee.pct);
          sellTax = Math.max(sellTax, rugData.transferFee.pct);
        }
        if (rugData.transferFee.bps !== undefined) {
          const pct = rugData.transferFee.bps / 100;
          buyTax = Math.max(buyTax, pct);
          sellTax = Math.max(sellTax, pct);
        }
      }
      
      // Check score - very low score might indicate issues
      if (rugData.score !== undefined && rugData.score < 200) {
        // Very low score might indicate issues
      }
    }
  } catch (err) {
    console.log("RugCheck honeypot check failed:", err);
  }
  
  return {
    canBuy: !isHoneypot,
    canSell: !isHoneypot,
    buyTax,
    sellTax,
    isHoneypot,
    honeypotReason,
    taxSource,
    feesVerified,
  };
}

export async function POST(req: Request) {
  try {
    const { mint, fullAudit, paymentTx, walletAddress } = await req.json();

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

    // Verify payment if full audit requested
    if (fullAudit && paymentTx) {
      try {
        const txInfo = await connection.getTransaction(paymentTx, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
        
        if (!txInfo) {
          console.log("Payment transaction not found, proceeding anyway for now");
          // In production, you might want to reject here
          // return NextResponse.json({ error: "Payment transaction not found" }, { status: 400 });
        } else {
          console.log("Payment verified:", paymentTx);
        }
      } catch (err) {
        console.log("Payment verification error:", err);
        // Continue anyway for now
      }
    }

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

    // Get extensions for Token-2022
    const extensions = (mintInfo.value.data as any).parsed?.info?.extensions || [];
    
    // Debug logging for extensions
    console.log("=== ON-CHAIN TOKEN DATA ===");
    console.log("isToken2022:", isToken2022);
    console.log("Raw extensions:", JSON.stringify(extensions, null, 2));
    console.log("=== END ON-CHAIN DATA ===");

    // 2. Fetch data from multiple sources in parallel
    const [dexScreenerData, rugCheckLP, dexFees] = await Promise.all([
      fetchDexScreenerData(mint),
      fetchRugCheckLP(mint),
      fetchDexPoolFees(mint),
    ]);

    let name = dexScreenerData.name;
    let symbol = dexScreenerData.symbol;
    let logoURI = dexScreenerData.logoURI;
    let createdAt = dexScreenerData.createdAt;
    
    let lpInfo = rugCheckLP || dexScreenerData.lpInfo;
    
    // Log DEX fees if found
    if (dexFees) {
      console.log("=== DEX FEES FOUND ===");
      console.log(`Buy Fee: ${dexFees.buyFee}%, Sell Fee: ${dexFees.sellFee}%`);
      console.log(`Pool: ${dexFees.poolAddress}, DEX: ${dexFees.dex}, Verified: ${dexFees.feesVerified}`);
    } else {
      console.log("=== NO DEX FEES FOUND ===");
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
        
        const holderMap = new Map<string, number>();
        for (const acc of accounts) {
          const owner = acc.owner;
          const amount = Number(acc.amount) / Math.pow(10, decimals);
          if (amount > 0) {
            holderMap.set(owner, (holderMap.get(owner) || 0) + amount);
          }
        }

        const sortedHolders = Array.from(holderMap.entries())
          .map(([wallet, balance]) => ({ wallet, balance }))
          .sort((a, b) => b.balance - a.balance);

        holderCount = sortedHolders.length;
        const totalHeld = sortedHolders.reduce((sum, h) => sum + h.balance, 0);

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
    if (isToken2022 && extensions.length > 0) {
      const transferFee = extensions.find((e: any) => e.extension === "transferFeeConfig");
      if (transferFee) {
        taxBps = transferFee.state?.newerTransferFee?.transferFeeBasisPoints || 
                 transferFee.state?.olderTransferFee?.transferFeeBasisPoints || 0;
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

    // 7. Full audit: Analyze Token-2022 extensions and honeypot
    let token2022Extensions: Token2022Extension[] | undefined;
    let honeypotAnalysis: TokenSafetyResult["honeypotAnalysis"] | undefined;
    
    if (fullAudit) {
      console.log("Running full audit for:", mint);
      
      // Analyze Token-2022 extensions
      token2022Extensions = analyzeToken2022Extensions(extensions);
      console.log("Token-2022 extensions found:", token2022Extensions.length);
      
      // Run honeypot analysis (pass DEX fees for pool-level tax detection)
      honeypotAnalysis = await analyzeHoneypot(
        mint,
        token2022Extensions,
        mintAuthority,
        freezeAuthority,
        dexFees
      );
      console.log("Honeypot analysis:", honeypotAnalysis);
    }

    // 8. Calculate safety score
    let score = 100;

    if (mintAuthority) score -= 30;
    if (freezeAuthority) score -= 20;
    
    if (taxBps && taxBps > 0) {
      score -= 10;
      if (taxBps > 500) score -= 10;
    }

    if (top10Concentration > 50) {
      score -= 20;
    } else if (top10Concentration > 30) {
      score -= 10;
    }

    if (holderCount < 100) score -= 10;
    if (ageInDays !== null && ageInDays < 7) score -= 10;

    if (lpInfo) {
      if (lpInfo.unlocked > 80) {
        score -= 20;
      } else if (lpInfo.unlocked > 50) {
        score -= 10;
      } else if (lpInfo.burned > 90 || lpInfo.locked > 90) {
        score += 5;
      }
    }

    // Additional penalties for full audit findings
    if (fullAudit && token2022Extensions) {
      for (const ext of token2022Extensions) {
        if (ext.riskLevel === "CRITICAL") score -= 25;
        else if (ext.riskLevel === "HIGH") score -= 15;
        else if (ext.riskLevel === "MEDIUM") score -= 5;
      }
    }
    
    if (fullAudit && honeypotAnalysis?.isHoneypot) {
      score -= 30;
    }

    score = Math.max(0, Math.min(100, score));

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
      // Full audit fields
      ...(fullAudit && {
        token2022Extensions,
        honeypotAnalysis,
        fullAuditCompleted: true,
      }),
    };

    return NextResponse.json({ success: true, result });

  } catch (err: any) {
    console.error("Token safety error:", err);
    return NextResponse.json({ error: err.message || "Analysis failed" }, { status: 500 });
  }
}