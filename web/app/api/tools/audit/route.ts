import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface SecurityCheck {
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  description: string;
}

interface InstructionAnalysis {
  name: string;
  accounts: { name: string; isMut: boolean; isSigner: boolean; constraints: string[] }[];
  hasSignerCheck: boolean;
  hasPdaValidation: boolean;
  hasOwnerCheck: boolean;
  risks: string[];
}

/**
 * POST /api/tools/audit
 * Analyzes a Solana program for security vulnerabilities
 */
export async function POST(req: Request) {
  try {
    const { programId, paymentTx, walletAddress } = await req.json();

    if (!programId || !paymentTx || !walletAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate program ID
    let programPubkey: PublicKey;
    try {
      programPubkey = new PublicKey(programId);
    } catch {
      return NextResponse.json({ error: "Invalid program ID" }, { status: 400 });
    }

    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com"
    );

    // 1. Verify payment transaction (burn tx)
    try {
      const tx = await connection.getTransaction(paymentTx, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });

      if (!tx) {
        return NextResponse.json({ error: "Payment transaction not found" }, { status: 400 });
      }

      if (tx.meta?.err) {
        return NextResponse.json({ error: "Payment transaction failed" }, { status: 400 });
      }

      // Check that it was a burn (look for Burn instruction)
      const logs = tx.meta?.logMessages || [];
      const hasBurn = logs.some(log => 
        log.includes("Burn") || log.includes("burn")
      );

      if (!hasBurn) {
        return NextResponse.json({ error: "Invalid payment - burn not detected" }, { status: 400 });
      }

      console.log("✅ Payment verified - burn detected");
    } catch (txErr) {
      console.error("Payment verification error:", txErr);
      return NextResponse.json({ error: "Failed to verify payment" }, { status: 400 });
    }

    // 2. Fetch program IDL
    let idl: any = null;
    let programName = "Unknown Program";

    // Try Anchor IDL account - Method 1: findProgramAddressSync
    try {
      const [idlAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("anchor:idl"), programPubkey.toBuffer()],
        programPubkey
      );

      console.log("Trying IDL address (method 1):", idlAddress.toBase58());
      const idlAccount = await connection.getAccountInfo(idlAddress);
      
      if (idlAccount) {
        console.log("Found IDL account, data length:", idlAccount.data.length);
        
        // Anchor IDL account layout:
        // - 8 bytes: discriminator
        // - 32 bytes: authority pubkey
        // - 4 bytes: data length (u32 LE)
        // - N bytes: zlib compressed IDL
        const dataLengthOffset = 40; // 8 + 32
        const dataLength = idlAccount.data.readUInt32LE(dataLengthOffset);
        console.log("Compressed IDL data length:", dataLength);
        
        const compressedData = idlAccount.data.slice(dataLengthOffset + 4, dataLengthOffset + 4 + dataLength);
        const inflated = await inflateIdl(compressedData);
        idl = JSON.parse(inflated);
        programName = idl.metadata?.name || idl.name || "Anchor Program";
        console.log("✅ Found on-chain IDL:", programName);
      }
    } catch (idlErr: any) {
      console.log("Method 1 IDL fetch failed:", idlErr.message);
    }

    // Try Method 2: createWithSeed (older Anchor versions)
    if (!idl) {
      try {
        const base = PublicKey.findProgramAddressSync([], programPubkey)[0];
        const idlAddressOld = await PublicKey.createWithSeed(base, "anchor:idl", programPubkey);
        
        console.log("Trying IDL address (method 2):", idlAddressOld.toBase58());
        const idlAccount = await connection.getAccountInfo(idlAddressOld);
        
        if (idlAccount) {
          console.log("Found IDL account (method 2), data length:", idlAccount.data.length);
          
          const dataLengthOffset = 40;
          const dataLength = idlAccount.data.readUInt32LE(dataLengthOffset);
          console.log("Compressed IDL data length:", dataLength);
          
          const compressedData = idlAccount.data.slice(dataLengthOffset + 4, dataLengthOffset + 4 + dataLength);
          const inflated = await inflateIdl(compressedData);
          idl = JSON.parse(inflated);
          programName = idl.metadata?.name || idl.name || "Anchor Program";
          console.log("✅ Found on-chain IDL (method 2):", programName);
        }
      } catch (idlErr: any) {
        console.log("Method 2 IDL fetch failed:", idlErr.message);
      }
    }

    // Try Anchor registry as fallback
    if (!idl) {
      try {
        console.log("Trying Anchor registry...");
        const registryRes = await fetch(
          `https://anchor.so/api/v0/program/${programId}/idl`
        );
        if (registryRes.ok) {
          idl = await registryRes.json();
          programName = idl.metadata?.name || idl.name || "Anchor Program";
          console.log("✅ Found IDL in registry:", programName);
        }
      } catch {
        console.log("No IDL in registry");
      }
    }

    if (!idl) {
      return NextResponse.json({ 
        error: "No IDL found. Program must have a verified IDL on-chain or in Anchor registry. Use 'anchor idl init' to publish your IDL." 
      }, { status: 400 });
    }

    // 3. Analyze the IDL
    const analysis = analyzeIdl(idl, programId);

    // 4. Return audit result
    return NextResponse.json({
      success: true,
      audit: {
        programId,
        programName,
        timestamp: new Date().toISOString(),
        ...analysis,
      },
    });

  } catch (err: any) {
    console.error("Audit error:", err);
    return NextResponse.json({ error: err.message || "Audit failed" }, { status: 500 });
  }
}

// Helper to inflate compressed IDL
async function inflateIdl(data: Buffer): Promise<string> {
  const pako = await import("pako");
  try {
    // Try zlib inflate first
    const inflated = pako.inflate(data);
    return new TextDecoder().decode(inflated);
  } catch (e1) {
    try {
      // Try raw inflate
      const inflated = pako.inflateRaw(data);
      return new TextDecoder().decode(inflated);
    } catch (e2) {
      // Maybe not compressed, try as-is
      return data.toString("utf8");
    }
  }
}

// Main analysis function
function analyzeIdl(idl: any, programId: string): {
  overallScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: string;
  instructions: InstructionAnalysis[];
  securityChecks: SecurityCheck[];
  recommendations: string[];
} {
  const instructions: InstructionAnalysis[] = [];
  const securityChecks: SecurityCheck[] = [];
  const recommendations: string[] = [];
  let issues = 0;
  let warnings = 0;

  // Analyze each instruction
  const ixs = idl.instructions || [];
  for (const ix of ixs) {
    const analysis = analyzeInstruction(ix, idl);
    instructions.push(analysis);
    
    issues += analysis.risks.filter(r => r.includes("CRITICAL") || r.includes("HIGH")).length;
    warnings += analysis.risks.filter(r => r.includes("MEDIUM") || r.includes("LOW")).length;
  }

  // Security checks
  securityChecks.push({
    name: "Signer Validation",
    status: instructions.every(ix => ix.hasSignerCheck) ? "PASS" : 
            instructions.some(ix => ix.hasSignerCheck) ? "WARN" : "FAIL",
    description: instructions.filter(ix => ix.hasSignerCheck).length + "/" + instructions.length + " instructions have signer checks",
  });

  securityChecks.push({
    name: "PDA Validation",
    status: instructions.every(ix => ix.hasPdaValidation || ix.accounts.length < 3) ? "PASS" :
            instructions.some(ix => ix.hasPdaValidation) ? "WARN" : "FAIL",
    description: "PDA seeds and bumps are validated",
  });

  // Owner checks - pass if most instructions with mutable accounts have owner checks
  const ixWithMutAccounts = instructions.filter(ix => ix.accounts.some(a => a.isMut));
  const ixWithOwnerChecks = ixWithMutAccounts.filter(ix => ix.hasOwnerCheck);
  const ownerCheckRatio = ixWithMutAccounts.length > 0 
    ? ixWithOwnerChecks.length / ixWithMutAccounts.length 
    : 1;
  
  securityChecks.push({
    name: "Owner Checks",
    status: ownerCheckRatio >= 0.8 ? "PASS" : ownerCheckRatio >= 0.5 ? "WARN" : "FAIL",
    description: `${ixWithOwnerChecks.length}/${ixWithMutAccounts.length} mutable instructions verify ownership`,
  });

  // Check for common patterns
  const hasInit = ixs.some((ix: any) => 
    ix.name.toLowerCase().includes("init") || ix.name.toLowerCase().includes("create")
  );
  
  securityChecks.push({
    name: "Initialization Guards",
    status: hasInit ? "PASS" : "WARN",
    description: hasInit ? "Has initialization instructions" : "No explicit initialization found",
  });

  // Check for admin/authority patterns - look in INSTRUCTION accounts, not IDL account structs
  const hasAdminPattern = ixs.some((ix: any) => {
    const accounts = ix.accounts || [];
    return accounts.some((acc: any) => {
      const name = (acc.name || "").toLowerCase();
      const isSigner = acc.isSigner || acc.signer;
      return (name.includes("admin") || name.includes("authority") || name.includes("owner")) && isSigner;
    });
  });
  
  // Also check account structs for admin fields
  const hasAdminInStructs = idl.types?.some((t: any) => {
    const fields = t.type?.fields || [];
    return fields.some((f: any) => {
      const name = (f.name || "").toLowerCase();
      return name.includes("admin") || name.includes("authority") || name.includes("owner");
    });
  }) || idl.accounts?.some((acc: any) => {
    const fields = acc.type?.fields || [];
    return fields.some((f: any) => {
      const name = (f.name || "").toLowerCase();
      return name.includes("admin") || name.includes("authority") || name.includes("owner");
    });
  });

  const hasAccessControl = hasAdminPattern || hasAdminInStructs;
  
  // Count admin-gated instructions
  const adminGatedIx = ixs.filter((ix: any) => {
    const accounts = ix.accounts || [];
    return accounts.some((acc: any) => {
      const name = (acc.name || "").toLowerCase();
      return (name.includes("admin") || name.includes("authority")) && (acc.isSigner || acc.signer);
    });
  });

  securityChecks.push({
    name: "Access Control",
    status: hasAccessControl ? "PASS" : "WARN",
    description: hasAccessControl 
      ? `${adminGatedIx.length} instructions require admin/authority` 
      : "No explicit authority pattern found",
  });

  // Check for pause mechanism
  const hasPause = ixs.some((ix: any) => 
    ix.name.toLowerCase().includes("pause")
  );

  securityChecks.push({
    name: "Emergency Pause",
    status: hasPause ? "PASS" : "WARN",
    description: hasPause ? "Has pause/unpause functionality" : "No pause mechanism detected",
  });

  // Check for error handling
  const errorCount = (idl.errors || []).length;
  securityChecks.push({
    name: "Error Handling",
    status: errorCount >= 10 ? "PASS" : errorCount >= 5 ? "WARN" : "FAIL",
    description: `${errorCount} custom error types defined`,
  });

  // Check for event logging
  const eventCount = (idl.events || []).length;
  securityChecks.push({
    name: "Event Logging",
    status: eventCount >= 5 ? "PASS" : eventCount > 0 ? "WARN" : "FAIL",
    description: `${eventCount} events for audit trails`,
  });

  // Generate recommendations
  if (!instructions.every(ix => ix.hasSignerCheck)) {
    recommendations.push("Add explicit signer checks to all state-modifying instructions");
  }

  if (!instructions.every(ix => ix.hasOwnerCheck)) {
    recommendations.push("Verify account ownership before performing mutations");
  }

  if (instructions.some(ix => ix.risks.length > 0)) {
    recommendations.push("Review flagged instructions for potential vulnerabilities");
  }

  if (!hasPause) {
    recommendations.push("Consider adding emergency pause functionality");
  }

  if (errorCount < 10) {
    recommendations.push("Add more descriptive custom errors for better debugging");
  }

  recommendations.push("Consider a professional manual audit for production deployment");

  // Calculate score
  const totalChecks = securityChecks.length;
  const passedChecks = securityChecks.filter(c => c.status === "PASS").length;
  const warnChecks = securityChecks.filter(c => c.status === "WARN").length;
  
  let baseScore = (passedChecks / totalChecks) * 100;
  baseScore -= warnChecks * 3;
  baseScore -= issues * 10;
  baseScore -= warnings * 3;
  
  const overallScore = Math.max(0, Math.min(100, Math.round(baseScore)));

  // Determine risk level
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  if (overallScore >= 80) riskLevel = "LOW";
  else if (overallScore >= 60) riskLevel = "MEDIUM";
  else if (overallScore >= 40) riskLevel = "HIGH";
  else riskLevel = "CRITICAL";

  // Generate summary
  const summary = `Analyzed ${instructions.length} instructions across the ${idl.metadata?.name || idl.name || "program"}. ` +
    `Found ${issues} high-severity issues and ${warnings} warnings. ` +
    `${passedChecks}/${totalChecks} security checks passed. ` +
    (riskLevel === "LOW" 
      ? "The program follows most Solana security best practices."
      : riskLevel === "MEDIUM"
        ? "Some security patterns are missing or incomplete. Manual review recommended."
        : "Multiple security concerns detected. Thorough review required before deployment.");

  return {
    overallScore,
    riskLevel,
    summary,
    instructions,
    securityChecks,
    recommendations,
  };
}

function analyzeInstruction(ix: any, idl: any): InstructionAnalysis {
  const accounts = (ix.accounts || []).map((acc: any) => ({
    name: acc.name,
    isMut: acc.isMut || acc.writable || false,
    isSigner: acc.isSigner || acc.signer || false,
    constraints: extractConstraints(acc),
    pda: acc.pda || null,
  }));

  const hasSignerCheck = accounts.some((a: any) => a.isSigner);
  
  const hasPdaValidation = accounts.some((a: any) => 
    a.constraints.some((c: string) => 
      c.includes("seeds") || c.includes("bump") || c.includes("pda")
    )
  );

  // Enhanced owner check detection:
  // 1. Explicit constraint/owner/has_one attributes
  // 2. Admin/authority account that is a signer
  // 3. PDA that includes user/signer in its seeds (implicit ownership via PDA derivation)
  const hasExplicitOwnerCheck = accounts.some((a: any) =>
    a.constraints.some((c: string) =>
      c.includes("owner") || c.includes("has_one") || c.includes("constraint")
    )
  );
  
  const hasAdminSigner = accounts.some((a: any) => 
    (a.name.toLowerCase().includes("admin") || a.name.toLowerCase().includes("authority")) && a.isSigner
  );
  
  // Check if any PDA includes user/signer in seeds - this implies ownership validation
  const hasPdaWithUserSeed = accounts.some((a: any) => {
    if (!a.pda || !a.pda.seeds) return false;
    return a.pda.seeds.some((seed: any) => {
      // Check if seed references user, signer, or authority account
      if (seed.kind === "account") {
        const path = (seed.path || "").toLowerCase();
        return path.includes("user") || path.includes("signer") || path.includes("authority");
      }
      return false;
    });
  });
  
  // Also check if there's a "stake" or "user_account" PDA derived from user - common pattern
  const hasUserDerivedAccount = accounts.some((a: any) => {
    const name = a.name.toLowerCase();
    const isUserRelated = name.includes("stake") || name.includes("user_") || name.includes("position");
    const hasPdaSeeds = a.constraints.some((c: string) => c.includes("seeds"));
    return isUserRelated && hasPdaSeeds && hasSignerCheck;
  });

  const hasOwnerCheck = hasExplicitOwnerCheck || hasAdminSigner || hasPdaWithUserSeed || hasUserDerivedAccount;

  const risks: string[] = [];

  // Check for risky patterns
  const mutAccounts = accounts.filter((a: any) => a.isMut);
  const signerAccounts = accounts.filter((a: any) => a.isSigner);

  if (mutAccounts.length > 0 && signerAccounts.length === 0) {
    risks.push("HIGH: Mutable accounts without signer");
  }

  if (ix.name.toLowerCase().includes("withdraw") || ix.name.toLowerCase().includes("transfer")) {
    // Only flag if there's no owner check AND no user-derived PDA AND no admin signer
    if (!hasOwnerCheck) {
      risks.push("CRITICAL: Fund movement without owner check");
    }
  }

  if (ix.name.toLowerCase().includes("close") && !hasOwnerCheck) {
    risks.push("HIGH: Account closure without owner verification");
  }

  // Check for missing PDA validation on PDAs
  const pdaAccounts = accounts.filter((a: any) => 
    a.name.toLowerCase().includes("pda") || 
    a.name.toLowerCase().includes("vault") ||
    a.name.toLowerCase().includes("pool")
  );
  
  if (pdaAccounts.length > 0 && !hasPdaValidation) {
    risks.push("MEDIUM: PDA accounts without seed validation");
  }

  return {
    name: ix.name,
    accounts,
    hasSignerCheck,
    hasPdaValidation,
    hasOwnerCheck,
    risks,
  };
}

function extractConstraints(acc: any): string[] {
  const constraints: string[] = [];
  
  if (acc.pda) constraints.push(`pda: ${JSON.stringify(acc.pda.seeds || acc.pda)}`);
  if (acc.relations) constraints.push(`has_one: ${acc.relations.join(", ")}`);
  if (acc.constraint) constraints.push(`constraint: ${acc.constraint}`);
  if (acc.owner) constraints.push(`owner: ${acc.owner}`);
  if (acc.address) constraints.push(`address: ${acc.address}`);
  
  // Handle Anchor IDL v0.29+ format
  if (acc.seeds) constraints.push(`seeds: ${JSON.stringify(acc.seeds)}`);
  if (acc.bump) constraints.push("bump validated");
  
  return constraints;
}