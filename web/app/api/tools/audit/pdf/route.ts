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
    const PDFDocument = (await import("pdfkit")).default;
    const path = await import("path");
    const fs = await import("fs");
    
    // Create PDF document
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Security Audit - ${audit.programId.slice(0, 8)}...`,
        Author: "StakePoint Smart Contract Auditor",
        Subject: "Solana Program Security Analysis",
      },
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
    doc.rect(0, 0, doc.page.width, 140).fill(DARK);
    
    // Load logo from public folder
    try {
      const logoPath = path.join(process.cwd(), "public", "favicon.jpg");
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 55, 25, { width: 50, height: 50 });
      }
    } catch (e) {
      // Fallback circle if logo not found
      doc.circle(80, 50, 25).fill(PRIMARY);
      doc.fontSize(18).fillColor("#ffffff").text("SP", 67, 42);
    }
    
    doc.fontSize(24).fillColor("#ffffff").text("SECURITY AUDIT REPORT", 120, 35);
    doc.fontSize(11).fillColor(PRIMARY).text("StakePoint Smart Contract Auditor", 120, 65);
    
    // Contact info
    doc.fontSize(9).fillColor("#888888");
    doc.text("stakepoint.app", 120, 85);
    doc.text("contact@stakepoint.app", 120, 98);
    
    doc.fontSize(10).fillColor("#666666").text(
      `Generated: ${new Date(audit.timestamp).toLocaleString()}`, 
      400, 
      85,
      { width: 145, align: "right" }
    );

    doc.moveDown(3);
    doc.y = 160;

    // ===== PROGRAM INFO =====
    doc.fontSize(14).fillColor(DARK).text("Program Information", 50);
    doc.moveDown(0.5);
    
    doc.fontSize(10).fillColor(GRAY);
    doc.text(`Program Name: `, 50, doc.y, { continued: true });
    doc.fillColor(DARK).text(audit.programName);
    
    doc.fillColor(GRAY).text(`Program ID: `, 50, doc.y, { continued: true });
    doc.font("Courier").fillColor(DARK).text(audit.programId);
    doc.font("Helvetica");

    doc.moveDown(1.5);

    // ===== OVERALL SCORE BOX =====
    const scoreBoxY = doc.y;
    doc.rect(50, scoreBoxY, 495, 80).fillAndStroke("#f8f8f8", "#e0e0e0");
    
    // Score circle
    const scoreColor = getRiskColor(audit.riskLevel);
    doc.circle(110, scoreBoxY + 40, 30).fill(scoreColor);
    doc.fontSize(24).fillColor("#ffffff").text(
      audit.overallScore.toString(), 
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
      `${audit.riskLevel} RISK`,
      155,
      scoreBoxY + 56,
      { width: 100, align: "center" }
    );

    // Instructions count
    doc.fontSize(11).fillColor(DARK).text(
      `${audit.instructions.length} Instructions Analyzed`,
      300,
      scoreBoxY + 30
    );
    doc.fontSize(10).fillColor(GRAY).text(
      `${audit.securityChecks.filter((c: any) => c.status === "PASS").length}/${audit.securityChecks.length} Security Checks Passed`,
      300,
      scoreBoxY + 48
    );

    doc.y = scoreBoxY + 100;

    // ===== SUMMARY =====
    doc.fontSize(14).fillColor(DARK).text("Executive Summary", 50);
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(GRAY).text(audit.summary, 50, doc.y, { width: 495 });
    doc.moveDown(1.5);

    // ===== SECURITY CHECKS =====
    doc.fontSize(14).fillColor(DARK).text("Security Checks", 50);
    doc.moveDown(0.5);

    for (const check of audit.securityChecks) {
      const checkY = doc.y;
      
      // Status indicator
      doc.circle(60, checkY + 6, 5).fill(getStatusColor(check.status));
      
      // Check name and description
      doc.fontSize(10).fillColor(DARK).text(check.name, 75, checkY);
      doc.fontSize(9).fillColor(GRAY).text(check.description, 75, checkY + 12);
      
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
    // Check if we need a new page
    if (doc.y > 650) {
      doc.addPage();
    }

    doc.fontSize(14).fillColor(DARK).text("Instructions Analysis", 50);
    doc.moveDown(0.5);

    for (const ix of audit.instructions) {
      // Check page break
      if (doc.y > 700) {
        doc.addPage();
      }

      const ixY = doc.y;
      
      // Instruction box
      doc.rect(50, ixY, 495, ix.risks.length > 0 ? 55 : 40).fillAndStroke("#fafafa", "#e5e5e5");
      
      // Instruction name
      doc.font("Courier").fontSize(11).fillColor(DARK).text(ix.name, 60, ixY + 8);
      doc.font("Helvetica");
      
      // Badges
      let badgeX = 60;
      const badgeY = ixY + 24;
      
      if (ix.hasSignerCheck) {
        doc.roundedRect(badgeX, badgeY, 55, 14, 2).fill(GREEN);
        doc.fontSize(8).fillColor("#ffffff").text("Signer ✓", badgeX + 5, badgeY + 3);
        badgeX += 60;
      }
      
      if (ix.hasPdaValidation) {
        doc.roundedRect(badgeX, badgeY, 45, 14, 2).fill("#3b82f6");
        doc.fontSize(8).fillColor("#ffffff").text("PDA ✓", badgeX + 5, badgeY + 3);
        badgeX += 50;
      }
      
      if (ix.hasOwnerCheck) {
        doc.roundedRect(badgeX, badgeY, 55, 14, 2).fill("#8b5cf6");
        doc.fontSize(8).fillColor("#ffffff").text("Owner ✓", badgeX + 5, badgeY + 3);
        badgeX += 60;
      }

      // Risks
      if (ix.risks.length > 0) {
        let riskX = 60;
        const riskY = badgeY + 18;
        for (const risk of ix.risks) {
          const riskColor = risk.includes("CRITICAL") ? RED : 
                           risk.includes("HIGH") ? "#f97316" : YELLOW;
          
          const riskWidth = Math.min(risk.length * 5 + 10, 200);
          doc.roundedRect(riskX, riskY, riskWidth, 14, 2).fill(riskColor);
          doc.fontSize(7).fillColor("#ffffff").text(risk, riskX + 5, riskY + 3, { width: riskWidth - 10 });
          riskX += riskWidth + 5;
          
          if (riskX > 400) break; // Prevent overflow
        }
      }

      // Account count
      doc.fontSize(9).fillColor(GRAY).text(
        `${ix.accounts.length} accounts`,
        480,
        ixY + 10,
        { width: 60, align: "right" }
      );

      doc.y = ixY + (ix.risks.length > 0 ? 60 : 45);
    }

    doc.moveDown(1);

    // ===== RECOMMENDATIONS =====
    if (audit.recommendations.length > 0) {
      if (doc.y > 650) {
        doc.addPage();
      }

      doc.fontSize(14).fillColor(DARK).text("Recommendations", 50);
      doc.moveDown(0.5);

      for (let i = 0; i < audit.recommendations.length; i++) {
        const rec = audit.recommendations[i];
        const recY = doc.y;
        
        doc.fontSize(10).fillColor(YELLOW).text("⚠", 55, recY);
        doc.fontSize(10).fillColor(GRAY).text(rec, 75, recY, { width: 470 });
        
        doc.moveDown(0.8);
      }
    }

    // ===== FOOTER =====
    const addFooter = () => {
      doc.fontSize(8).fillColor("#999999").text(
        "This is an automated analysis and should not replace a professional security audit.",
        50,
        doc.page.height - 50,
        { width: 350 }
      );
      doc.fontSize(8).fillColor(PRIMARY).text(
        "stakepoint.app",
        400,
        doc.page.height - 50,
        { width: 145, align: "right" }
      );
      doc.fontSize(8).fillColor("#999999").text(
        "contact@stakepoint.app",
        400,
        doc.page.height - 38,
        { width: 145, align: "right" }
      );
    };

    // Add footer to all pages
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      addFooter();
    }

    // ===== DISCLAIMER PAGE =====
    doc.addPage();
    
    doc.fontSize(16).fillColor(DARK).text("Disclaimer", 50, 50);
    doc.moveDown(1);
    
    doc.fontSize(10).fillColor(GRAY).text(
      `This security audit report was automatically generated by StakePoint Smart Contract Auditor on ${new Date(audit.timestamp).toLocaleString()}.`,
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
    
    doc.text(
      "Limitations of this automated audit include:",
      50,
      doc.y,
      { width: 495 }
    );
    doc.moveDown(0.5);
    
    const limitations = [
      "• Cannot analyze actual program bytecode or implementation details",
      "• Cannot detect logical vulnerabilities specific to business logic",
      "• Cannot verify runtime behavior or edge cases",
      "• Cannot assess cross-program invocation risks in full context",
      "• May not detect all vulnerability patterns",
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
    
    // Logo from file
    try {
      const logoPath = path.join(process.cwd(), "public", "favicon.jpg");
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 60, brandBoxY + 20, { width: 60, height: 60 });
      }
    } catch (e) {
      doc.circle(100, brandBoxY + 50, 30).fill(PRIMARY);
      doc.fontSize(20).fillColor("#ffffff").text("SP", 83, brandBoxY + 40);
    }
    
    // Company info
    doc.fontSize(16).fillColor(DARK).text("StakePoint", 140, brandBoxY + 25);
    doc.fontSize(10).fillColor(GRAY).text("Solana DeFi Platform", 140, brandBoxY + 45);
    
    doc.fontSize(10).fillColor(PRIMARY).text("stakepoint.app", 140, brandBoxY + 65);
    doc.fontSize(10).fillColor(GRAY).text("contact@stakepoint.app", 140, brandBoxY + 80);
    
    // Tagline
    doc.fontSize(9).fillColor(GRAY).text(
      "Staking • Farming • Swaps • Token Locks",
      350,
      brandBoxY + 45,
      { width: 180, align: "right" }
    );

    addFooter();

    // Finalize PDF
    doc.end();

    // Wait for PDF to complete
    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
    });

    // Return PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="audit-${audit.programId.slice(0, 8)}.pdf"`,
      },
    });

  } catch (err: any) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: err.message || "PDF generation failed" }, { status: 500 });
  }
}