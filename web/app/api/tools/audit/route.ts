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

    // Try Anchor IDL account
    try {
      const [idlAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("anchor:idl"), programPubkey.toBuffer()],
        programPubkey
      );

      const idlAccount = await connection.getAccountInfo(idlAddress);
      
      if (idlAccount) {
        // Skip 8-byte discriminator + 4-byte length
        const idlData = idlAccount.data.slice(12);
        const inflated = await inflateIdl(idlData);
        idl = JSON.parse(inflated);
        programName = idl.name || "Anchor Program";
        console.log("✅ Found on-chain IDL:", programName);
      }
    } catch (idlErr) {
      console.log("No on-chain IDL found, trying registry...");
    }

    // Try Anchor registry as fallback
    if (!idl) {
      try {
        const registryRes = await fetch(
          `https://anchor.so/api/v0/program/${programId}/idl`
        );
        if (registryRes.ok) {
          idl = await registryRes.json();
          programName = idl.name || "Anchor Program";
          console.log("✅ Found IDL in registry:", programName);
        }
      } catch {
        console.log("No IDL in registry");
      }
    }

    if (!idl) {
      return NextResponse.json({ 
        error: "No IDL found. Program must have a verified IDL on-chain or in Anchor registry." 
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
  // IDL is typically zlib compressed
  const pako = await import("pako");
  try {
    const inflated = pako.inflate(data);
    return new TextDecoder().decode(inflated);
  } catch {
    // Maybe not compressed
    return data.toString("utf8");
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

  securityChecks.push({
    name: "Owner Checks",
    status: instructions.every(ix => ix.hasOwnerCheck || ix.accounts.filter(a => a.isMut).length === 0) ? "PASS" : 
            instructions.some(ix => ix.hasOwnerCheck) ? "WARN" : "FAIL",
    description: "Account ownership is verified before mutations",
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

  // Check for admin/authority patterns
  const hasAuthority = idl.accounts?.some((acc: any) => 
    acc.name.toLowerCase().includes("authority") || acc.name.toLowerCase().includes("admin")
  );

  securityChecks.push({
    name: "Access Control",
    status: hasAuthority ? "PASS" : "WARN",
    description: hasAuthority ? "Has authority/admin account structures" : "No explicit authority pattern found",
  });

  // Arithmetic checks (look for checked math in types)
  const hasCheckedMath = JSON.stringify(idl).includes("checked") || 
                          JSON.stringify(idl).includes("saturating");
  
  securityChecks.push({
    name: "Integer Overflow Protection",
    status: hasCheckedMath ? "PASS" : "WARN",
    description: hasCheckedMath ? "Uses checked/saturating math" : "Review arithmetic operations manually",
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

  if (!hasCheckedMath) {
    recommendations.push("Use checked_add, checked_sub, checked_mul for arithmetic operations");
  }

  recommendations.push("Consider a professional manual audit for production deployment");

  // Calculate score
  const totalChecks = securityChecks.length;
  const passedChecks = securityChecks.filter(c => c.status === "PASS").length;
  const warnChecks = securityChecks.filter(c => c.status === "WARN").length;
  
  let baseScore = (passedChecks / totalChecks) * 100;
  baseScore -= warnChecks * 5;
  baseScore -= issues * 15;
  baseScore -= warnings * 5;
  
  const overallScore = Math.max(0, Math.min(100, Math.round(baseScore)));

  // Determine risk level
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  if (overallScore >= 80) riskLevel = "LOW";
  else if (overallScore >= 60) riskLevel = "MEDIUM";
  else if (overallScore >= 40) riskLevel = "HIGH";
  else riskLevel = "CRITICAL";

  // Generate summary
  const summary = `Analyzed ${instructions.length} instructions across the ${idl.name || "program"}. ` +
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
  }));

  const hasSignerCheck = accounts.some((a: any) => a.isSigner);
  
  const hasPdaValidation = accounts.some((a: any) => 
    a.constraints.some((c: string) => 
      c.includes("seeds") || c.includes("bump") || c.includes("pda")
    )
  );

  const hasOwnerCheck = accounts.some((a: any) =>
    a.constraints.some((c: string) =>
      c.includes("owner") || c.includes("has_one") || c.includes("constraint")
    )
  );

  const risks: string[] = [];

  // Check for risky patterns
  const mutAccounts = accounts.filter((a: any) => a.isMut);
  const signerAccounts = accounts.filter((a: any) => a.isSigner);

  if (mutAccounts.length > 0 && signerAccounts.length === 0) {
    risks.push("HIGH: Mutable accounts without signer");
  }

  if (ix.name.toLowerCase().includes("withdraw") || ix.name.toLowerCase().includes("transfer")) {
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
  
  if (acc.pda) constraints.push(`seeds: ${JSON.stringify(acc.pda.seeds)}`);
  if (acc.relations) constraints.push(`has_one: ${acc.relations.join(", ")}`);
  if (acc.constraint) constraints.push(`constraint: ${acc.constraint}`);
  if (acc.owner) constraints.push(`owner: ${acc.owner}`);
  
  // Handle Anchor IDL v0.29+ format
  if (acc.seeds) constraints.push(`seeds: ${JSON.stringify(acc.seeds)}`);
  if (acc.bump) constraints.push("bump validated");
  
  return constraints;
}