import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/tools/audit/pdf
 * Generates a PDF audit report
 */
export async function POST(req: Request) {
  try {
    const { audit } = await req.json();

    if (!audit) {
      return NextResponse.json({ error: "No audit data provided" }, { status: 400 });
    }

    // Dynamic import for server-side PDF generation
    let PDFDocument;
    try {
      PDFDocument = (await import("pdfkit")).default;
    } catch (e) {
      console.error("Failed to import pdfkit:", e);
      return NextResponse.json({ error: "PDF library not available. Run: npm install pdfkit" }, { status: 500 });
    }
    
    // Create PDF document
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Security Audit - ${audit.programId?.slice(0, 8) || 'Unknown'}...`,
        Author: "StakePoint Smart Contract Auditor",
        Subject: "Solana Program Security Analysis",
      },
      autoFirstPage: true,
      bufferPages: true,
    });

    // Collect PDF chunks
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    // Colors
    const PRIMARY = "#fb57ff";
    const DARK = "#1a1a1a";
    const GRAY = "#666666";
    const GREEN = "#22c55e";
    const YELLOW = "#eab308";
    const RED = "#ef4444";

    const getRiskColor = (risk: string) => {
      switch (risk) {
        case "LOW": return GREEN;
        case "MEDIUM": return YELLOW;
        case "HIGH": return "#f97316";
        case "CRITICAL": return RED;
        default: return GRAY;
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case "PASS": return GREEN;
        case "WARN": return YELLOW;
        case "FAIL": return RED;
        default: return GRAY;
      }
    };

    // ===== HEADER =====
    doc.rect(0, 0, doc.page.width, 120).fill(DARK);
    
    // Logo placeholder (circle with SP text - no file system access needed)
    doc.circle(80, 50, 25).fill(PRIMARY);
    doc.fontSize(16).fillColor("#ffffff").text("SP", 68, 42);
    
    doc.fontSize(22).fillColor("#ffffff").text("SECURITY AUDIT REPORT", 120, 30);
    doc.fontSize(10).fillColor(PRIMARY).text("StakePoint Smart Contract Auditor", 120, 58);
    
    // Contact info
    doc.fontSize(9).fillColor("#888888");
    doc.text("stakepoint.app", 120, 78);
    
    doc.fontSize(9).fillColor("#666666").text(
      `Generated: ${new Date(audit.timestamp || Date.now()).toLocaleString()}`, 
      380, 
      78,
      { width: 165, align: "right" }
    );

    doc.y = 140;

    // ===== PROGRAM INFO =====
    doc.fontSize(14).fillColor(DARK).text("Program Information", 50);
    doc.moveDown(0.5);
    
    doc.fontSize(10).fillColor(GRAY);
    doc.text(`Program Name: `, 50, doc.y, { continued: true });
    doc.fillColor(DARK).text(audit.programName || "Unknown");
    
    doc.fillColor(GRAY).text(`Program ID: `, 50, doc.y, { continued: true });
    doc.font("Courier").fillColor(DARK).text(audit.programId || "N/A");
    doc.font("Helvetica");

    doc.moveDown(1.5);

    // ===== OVERALL SCORE BOX =====
    const scoreBoxY = doc.y;
    doc.rect(50, scoreBoxY, 495, 80).fillAndStroke("#f8f8f8", "#e0e0e0");
    
    // Score circle
    const scoreColor = getRiskColor(audit.riskLevel || "MEDIUM");
    doc.circle(110, scoreBoxY + 40, 30).fill(scoreColor);
    doc.fontSize(24).fillColor("#ffffff").text(
      String(audit.overallScore || 0), 
      85, 
      scoreBoxY + 28,
      { width: 50, align: "center" }
    );
    
    // Score label
    doc.fontSize(12).fillColor(DARK).text("Security Score", 155, scoreBoxY + 20);
    doc.fontSize(10).fillColor(GRAY).text("out of 100", 155, scoreBoxY + 36);
    
    // Risk level badge
    doc.roundedRect(155, scoreBoxY + 52, 100, 20, 3).fill(scoreColor);
    doc.fontSize(10).fillColor("#ffffff").text(
      `${audit.riskLevel || "UNKNOWN"} RISK`,
      155,
      scoreBoxY + 56,
      { width: 100, align: "center" }
    );

    // Instructions count
    const instructionCount = audit.instructions?.length || 0;
    const passedChecks = audit.securityChecks?.filter((c: any) => c.status === "PASS").length || 0;
    const totalChecks = audit.securityChecks?.length || 0;
    
    doc.fontSize(11).fillColor(DARK).text(
      `${instructionCount} Instructions Analyzed`,
      300,
      scoreBoxY + 30
    );
    doc.fontSize(10).fillColor(GRAY).text(
      `${passedChecks}/${totalChecks} Security Checks Passed`,
      300,
      scoreBoxY + 48
    );

    doc.y = scoreBoxY + 100;

    // ===== SUMMARY =====
    doc.fontSize(14).fillColor(DARK).text("Executive Summary", 50);
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(GRAY).text(audit.summary || "No summary available.", 50, doc.y, { width: 495 });
    doc.moveDown(1.5);

    // ===== SECURITY CHECKS =====
    doc.fontSize(14).fillColor(DARK).text("Security Checks", 50);
    doc.moveDown(0.5);

    const securityChecks = audit.securityChecks || [];
    for (const check of securityChecks) {
      if (doc.y > 750) {
        doc.addPage();
      }
      
      const checkY = doc.y;
      
      // Status indicator
      doc.circle(60, checkY + 6, 5).fill(getStatusColor(check.status));
      
      // Check name and description
      doc.fontSize(10).fillColor(DARK).text(check.name, 75, checkY);
      doc.fontSize(9).fillColor(GRAY).text(check.description || "", 75, checkY + 12);
      
      // Status text
      doc.fontSize(9).fillColor(getStatusColor(check.status)).text(
        check.status,
        480,
        checkY,
        { width: 65, align: "right" }
      );
      
      doc.y = checkY + 28;
    }

    doc.moveDown(1);

    // ===== INSTRUCTIONS ANALYSIS =====
    if (doc.y > 650) {
      doc.addPage();
    }

    doc.fontSize(14).fillColor(DARK).text("Instructions Analysis", 50);
    doc.moveDown(0.5);

    const instructions = audit.instructions || [];
    for (const ix of instructions) {
      if (doc.y > 720) {
        doc.addPage();
      }

      const ixY = doc.y;
      const hasRisks = ix.risks && ix.risks.length > 0;
      
      // Instruction box
      doc.rect(50, ixY, 495, hasRisks ? 55 : 40).fillAndStroke("#fafafa", "#e5e5e5");
      
      // Instruction name
      doc.font("Courier").fontSize(11).fillColor(DARK).text(ix.name, 60, ixY + 8);
      doc.font("Helvetica");
      
      // Badges
      let badgeX = 60;
      const badgeY = ixY + 24;
      
      if (ix.hasSignerCheck) {
        doc.roundedRect(badgeX, badgeY, 55, 14, 2).fill(GREEN);
        doc.fontSize(8).fillColor("#ffffff").text("Signer", badgeX + 10, badgeY + 3);
        badgeX += 60;
      }
      
      if (ix.hasPdaValidation) {
        doc.roundedRect(badgeX, badgeY, 40, 14, 2).fill("#3b82f6");
        doc.fontSize(8).fillColor("#ffffff").text("PDA", badgeX + 10, badgeY + 3);
        badgeX += 45;
      }
      
      if (ix.hasOwnerCheck) {
        doc.roundedRect(badgeX, badgeY, 50, 14, 2).fill("#8b5cf6");
        doc.fontSize(8).fillColor("#ffffff").text("Owner", badgeX + 10, badgeY + 3);
        badgeX += 55;
      }

      // Risks
      if (hasRisks) {
        let riskX = 60;
        const riskY = badgeY + 18;
        for (const risk of ix.risks.slice(0, 2)) {
          const riskColor = risk.includes("CRITICAL") ? RED : 
                           risk.includes("HIGH") ? "#f97316" : YELLOW;
          
          const riskText = risk.length > 35 ? risk.slice(0, 35) + "..." : risk;
          const riskWidth = Math.min(riskText.length * 5 + 10, 200);
          doc.roundedRect(riskX, riskY, riskWidth, 14, 2).fill(riskColor);
          doc.fontSize(7).fillColor("#ffffff").text(riskText, riskX + 5, riskY + 3);
          riskX += riskWidth + 5;
          
          if (riskX > 400) break;
        }
      }

      // Account count
      const accountCount = ix.accounts?.length || 0;
      doc.fontSize(9).fillColor(GRAY).text(
        `${accountCount} accounts`,
        480,
        ixY + 10,
        { width: 60, align: "right" }
      );

      doc.y = ixY + (hasRisks ? 60 : 45);
    }

    doc.moveDown(1);

    // ===== RECOMMENDATIONS =====
    const recommendations = audit.recommendations || [];
    if (recommendations.length > 0) {
      if (doc.y > 650) {
        doc.addPage();
      }

      doc.fontSize(14).fillColor(DARK).text("Recommendations", 50);
      doc.moveDown(0.5);

      for (const rec of recommendations) {
        if (doc.y > 750) {
          doc.addPage();
        }
        
        const recY = doc.y;
        doc.fontSize(10).fillColor(YELLOW).text("!", 58, recY);
        doc.fontSize(10).fillColor(GRAY).text(rec, 75, recY, { width: 470 });
        doc.moveDown(0.8);
      }
    }

    // ===== DISCLAIMER PAGE =====
    doc.addPage();
    
    doc.fontSize(16).fillColor(DARK).text("Disclaimer", 50, 50);
    doc.moveDown(1);
    
    doc.fontSize(10).fillColor(GRAY).text(
      `This security audit report was automatically generated by StakePoint Smart Contract Auditor on ${new Date(audit.timestamp || Date.now()).toLocaleString()}.`,
      50,
      doc.y,
      { width: 495 }
    );
    doc.moveDown(1);
    
    doc.text(
      "IMPORTANT: This automated analysis is provided for informational purposes only and should not be considered a comprehensive security audit. It analyzes publicly available IDL data and applies pattern-based checks for common vulnerabilities.",
      50,
      doc.y,
      { width: 495 }
    );
    doc.moveDown(1);
    
    doc.text("Limitations of this automated audit include:", 50, doc.y, { width: 495 });
    doc.moveDown(0.5);
    
    const limitations = [
      "- Cannot analyze actual program bytecode or implementation details",
      "- Cannot detect logical vulnerabilities specific to business logic",
      "- Cannot verify runtime behavior or edge cases",
      "- Cannot assess cross-program invocation risks in full context",
      "- May not detect all vulnerability patterns",
    ];
    
    for (const lim of limitations) {
      doc.text(lim, 60, doc.y, { width: 485 });
      doc.moveDown(0.3);
    }
    
    doc.moveDown(1);
    doc.text(
      "For production deployments involving significant value, we strongly recommend engaging a professional security auditing firm to conduct a thorough manual review of your smart contract code.",
      50,
      doc.y,
      { width: 495 }
    );
    
    // StakePoint Branding Box
    doc.moveDown(2);
    const brandBoxY = doc.y;
    doc.rect(50, brandBoxY, 495, 100).fillAndStroke("#fafafa", "#e5e5e5");
    
    // Logo placeholder
    doc.circle(100, brandBoxY + 50, 30).fill(PRIMARY);
    doc.fontSize(18).fillColor("#ffffff").text("SP", 86, brandBoxY + 42);
    
    // Company info
    doc.fontSize(16).fillColor(DARK).text("StakePoint", 150, brandBoxY + 25);
    doc.fontSize(10).fillColor(GRAY).text("Solana DeFi Platform", 150, brandBoxY + 45);
    
    doc.fontSize(10).fillColor(PRIMARY).text("stakepoint.app", 150, brandBoxY + 65);
    doc.fontSize(10).fillColor(GRAY).text("contact@stakepoint.app", 150, brandBoxY + 80);
    
    // Tagline
    doc.fontSize(9).fillColor(GRAY).text(
      "Staking | Farming | Swaps | Tools",
      350,
      brandBoxY + 45,
      { width: 180, align: "right" }
    );

    // ===== FOOTER on all pages =====
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      
      doc.fontSize(8).fillColor("#999999").text(
        "This is an automated analysis and should not replace a professional security audit.",
        50,
        doc.page.height - 40,
        { width: 350 }
      );
      doc.fontSize(8).fillColor(PRIMARY).text(
        "stakepoint.app",
        400,
        doc.page.height - 40,
        { width: 145, align: "right" }
      );
    }

    // Finalize PDF
    doc.end();

    // Wait for PDF to complete
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on("error", reject);
    });

    console.log("PDF generated, size:", pdfBuffer.length);

    // Return PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="audit-${(audit.programId || 'unknown').slice(0, 8)}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });

  } catch (err: any) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ 
      error: err.message || "PDF generation failed",
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}