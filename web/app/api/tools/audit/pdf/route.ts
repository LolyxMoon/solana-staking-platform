import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/tools/audit/pdf
 * Generates a PDF audit report using pdf-lib (serverless compatible)
 */
export async function POST(req: Request) {
  try {
    const { audit } = await req.json();

    if (!audit) {
      return NextResponse.json({ error: "No audit data provided" }, { status: 400 });
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Embed fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const courier = await pdfDoc.embedFont(StandardFonts.Courier);

    // Colors
    const PRIMARY = rgb(0.98, 0.34, 1); // #fb57ff
    const DARK = rgb(0.1, 0.1, 0.1);
    const GRAY = rgb(0.4, 0.4, 0.4);
    const LIGHT_GRAY = rgb(0.6, 0.6, 0.6);
    const GREEN = rgb(0.13, 0.77, 0.37);
    const YELLOW = rgb(0.92, 0.7, 0.03);
    const ORANGE = rgb(0.98, 0.45, 0.09);
    const RED = rgb(0.94, 0.27, 0.27);
    const WHITE = rgb(1, 1, 1);

    const getRiskColor = (risk: string) => {
      switch (risk) {
        case "LOW": return GREEN;
        case "MEDIUM": return YELLOW;
        case "HIGH": return ORANGE;
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

    // Page dimensions
    const pageWidth = 595.28; // A4
    const pageHeight = 841.89;
    const margin = 50;

    // ===== PAGE 1 =====
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - 50;

    // Header background
    page.drawRectangle({
      x: 0,
      y: pageHeight - 120,
      width: pageWidth,
      height: 120,
      color: DARK,
    });

    // Logo circle
    page.drawCircle({
      x: 80,
      y: pageHeight - 60,
      size: 25,
      color: PRIMARY,
    });
    page.drawText("SP", {
      x: 68,
      y: pageHeight - 67,
      size: 16,
      font: helveticaBold,
      color: WHITE,
    });

    // Title
    page.drawText("SECURITY AUDIT REPORT", {
      x: 120,
      y: pageHeight - 45,
      size: 22,
      font: helveticaBold,
      color: WHITE,
    });

    page.drawText("StakePoint Smart Contract Auditor", {
      x: 120,
      y: pageHeight - 65,
      size: 10,
      font: helvetica,
      color: PRIMARY,
    });

    page.drawText("stakepoint.app", {
      x: 120,
      y: pageHeight - 82,
      size: 9,
      font: helvetica,
      color: LIGHT_GRAY,
    });

    // Date
    const dateStr = new Date(audit.timestamp || Date.now()).toLocaleString();
    page.drawText(`Generated: ${dateStr}`, {
      x: 380,
      y: pageHeight - 82,
      size: 9,
      font: helvetica,
      color: LIGHT_GRAY,
    });

    y = pageHeight - 160;

    // Program Information
    page.drawText("Program Information", {
      x: margin,
      y,
      size: 14,
      font: helveticaBold,
      color: DARK,
    });
    y -= 25;

    page.drawText(`Program Name: ${audit.programName || "Unknown"}`, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: GRAY,
    });
    y -= 15;

    page.drawText(`Program ID: ${audit.programId || "N/A"}`, {
      x: margin,
      y,
      size: 10,
      font: courier,
      color: DARK,
    });
    y -= 35;

    // Score Box
    const scoreBoxY = y - 60;
    page.drawRectangle({
      x: margin,
      y: scoreBoxY,
      width: pageWidth - margin * 2,
      height: 80,
      color: rgb(0.97, 0.97, 0.97),
      borderColor: rgb(0.88, 0.88, 0.88),
      borderWidth: 1,
    });

    // Score circle
    const scoreColor = getRiskColor(audit.riskLevel || "MEDIUM");
    page.drawCircle({
      x: margin + 60,
      y: scoreBoxY + 40,
      size: 30,
      color: scoreColor,
    });

    const scoreText = String(audit.overallScore || 0);
    page.drawText(scoreText, {
      x: margin + 60 - (scoreText.length * 6),
      y: scoreBoxY + 33,
      size: 24,
      font: helveticaBold,
      color: WHITE,
    });

    page.drawText("Security Score", {
      x: margin + 105,
      y: scoreBoxY + 52,
      size: 12,
      font: helveticaBold,
      color: DARK,
    });

    page.drawText("out of 100", {
      x: margin + 105,
      y: scoreBoxY + 36,
      size: 10,
      font: helvetica,
      color: GRAY,
    });

    // Risk badge
    const riskText = `${audit.riskLevel || "UNKNOWN"} RISK`;
    page.drawRectangle({
      x: margin + 105,
      y: scoreBoxY + 10,
      width: 90,
      height: 20,
      color: scoreColor,
    });
    page.drawText(riskText, {
      x: margin + 115,
      y: scoreBoxY + 15,
      size: 10,
      font: helveticaBold,
      color: WHITE,
    });

    // Stats
    const instructionCount = audit.instructions?.length || 0;
    const passedChecks = audit.securityChecks?.filter((c: any) => c.status === "PASS").length || 0;
    const totalChecks = audit.securityChecks?.length || 0;

    page.drawText(`${instructionCount} Instructions Analyzed`, {
      x: 300,
      y: scoreBoxY + 48,
      size: 11,
      font: helvetica,
      color: DARK,
    });

    page.drawText(`${passedChecks}/${totalChecks} Security Checks Passed`, {
      x: 300,
      y: scoreBoxY + 30,
      size: 10,
      font: helvetica,
      color: GRAY,
    });

    y = scoreBoxY - 30;

    // Summary
    page.drawText("Executive Summary", {
      x: margin,
      y,
      size: 14,
      font: helveticaBold,
      color: DARK,
    });
    y -= 20;

    // Word wrap summary
    const summaryText = audit.summary || "No summary available.";
    const summaryLines = wrapText(summaryText, 90);
    for (const line of summaryLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: 10,
        font: helvetica,
        color: GRAY,
      });
      y -= 14;
    }
    y -= 15;

    // Security Checks
    page.drawText("Security Checks", {
      x: margin,
      y,
      size: 14,
      font: helveticaBold,
      color: DARK,
    });
    y -= 25;

    const securityChecks = audit.securityChecks || [];
    for (const check of securityChecks) {
      if (y < 100) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - 50;
      }

      // Status circle
      page.drawCircle({
        x: margin + 8,
        y: y + 4,
        size: 5,
        color: getStatusColor(check.status),
      });

      page.drawText(check.name, {
        x: margin + 25,
        y,
        size: 10,
        font: helvetica,
        color: DARK,
      });

      page.drawText(check.description || "", {
        x: margin + 25,
        y: y - 12,
        size: 9,
        font: helvetica,
        color: GRAY,
      });

      page.drawText(check.status, {
        x: pageWidth - margin - 40,
        y,
        size: 9,
        font: helveticaBold,
        color: getStatusColor(check.status),
      });

      y -= 35;
    }

    // ===== PAGE 2 - Instructions =====
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - 50;

    page.drawText("Instructions Analysis", {
      x: margin,
      y,
      size: 14,
      font: helveticaBold,
      color: DARK,
    });
    y -= 30;

    const instructions = audit.instructions || [];
    for (const ix of instructions) {
      if (y < 100) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - 50;
      }

      const hasRisks = ix.risks && ix.risks.length > 0;
      const boxHeight = hasRisks ? 55 : 40;

      // Instruction box
      page.drawRectangle({
        x: margin,
        y: y - boxHeight + 15,
        width: pageWidth - margin * 2,
        height: boxHeight,
        color: rgb(0.98, 0.98, 0.98),
        borderColor: rgb(0.9, 0.9, 0.9),
        borderWidth: 1,
      });

      // Instruction name
      page.drawText(ix.name, {
        x: margin + 10,
        y: y,
        size: 11,
        font: courier,
        color: DARK,
      });

      // Badges
      let badgeX = margin + 10;
      const badgeY = y - 18;

      if (ix.hasSignerCheck) {
        page.drawRectangle({
          x: badgeX,
          y: badgeY - 3,
          width: 50,
          height: 14,
          color: GREEN,
        });
        page.drawText("Signer", {
          x: badgeX + 8,
          y: badgeY,
          size: 8,
          font: helvetica,
          color: WHITE,
        });
        badgeX += 55;
      }

      if (ix.hasPdaValidation) {
        page.drawRectangle({
          x: badgeX,
          y: badgeY - 3,
          width: 35,
          height: 14,
          color: rgb(0.23, 0.51, 0.96),
        });
        page.drawText("PDA", {
          x: badgeX + 8,
          y: badgeY,
          size: 8,
          font: helvetica,
          color: WHITE,
        });
        badgeX += 40;
      }

      if (ix.hasOwnerCheck) {
        page.drawRectangle({
          x: badgeX,
          y: badgeY - 3,
          width: 45,
          height: 14,
          color: rgb(0.55, 0.36, 0.96),
        });
        page.drawText("Owner", {
          x: badgeX + 8,
          y: badgeY,
          size: 8,
          font: helvetica,
          color: WHITE,
        });
        badgeX += 50;
      }

      // Risks
      if (hasRisks) {
        let riskX = margin + 10;
        const riskY = badgeY - 20;
        for (const risk of ix.risks.slice(0, 2)) {
          const riskColor = risk.includes("CRITICAL") ? RED :
                           risk.includes("HIGH") ? ORANGE : YELLOW;
          const riskDisplayText = risk.length > 30 ? risk.slice(0, 30) + "..." : risk;
          const riskWidth = Math.min(riskDisplayText.length * 4.5 + 16, 180);

          page.drawRectangle({
            x: riskX,
            y: riskY - 3,
            width: riskWidth,
            height: 14,
            color: riskColor,
          });
          page.drawText(riskDisplayText, {
            x: riskX + 5,
            y: riskY,
            size: 7,
            font: helvetica,
            color: WHITE,
          });
          riskX += riskWidth + 5;
        }
      }

      // Account count
      const accountCount = ix.accounts?.length || 0;
      page.drawText(`${accountCount} accounts`, {
        x: pageWidth - margin - 60,
        y: y,
        size: 9,
        font: helvetica,
        color: GRAY,
      });

      y -= boxHeight + 10;
    }

    // ===== RECOMMENDATIONS =====
    const recommendations = audit.recommendations || [];
    if (recommendations.length > 0) {
      if (y < 200) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - 50;
      }

      y -= 20;
      page.drawText("Recommendations", {
        x: margin,
        y,
        size: 14,
        font: helveticaBold,
        color: DARK,
      });
      y -= 25;

      for (const rec of recommendations) {
        if (y < 80) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - 50;
        }

        page.drawText("!", {
          x: margin + 5,
          y,
          size: 12,
          font: helveticaBold,
          color: YELLOW,
        });

        const recLines = wrapText(rec, 85);
        for (const line of recLines) {
          page.drawText(line, {
            x: margin + 25,
            y,
            size: 10,
            font: helvetica,
            color: GRAY,
          });
          y -= 14;
        }
        y -= 8;
      }
    }

    // ===== DISCLAIMER PAGE =====
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - 50;

    page.drawText("Disclaimer", {
      x: margin,
      y,
      size: 16,
      font: helveticaBold,
      color: DARK,
    });
    y -= 30;

    const disclaimerText = `This security audit report was automatically generated by StakePoint Smart Contract Auditor on ${dateStr}.

IMPORTANT: This automated analysis is provided for informational purposes only and should not be considered a comprehensive security audit. It analyzes publicly available IDL data and applies pattern-based checks for common vulnerabilities.

Limitations of this automated audit include:
- Cannot analyze actual program bytecode or implementation details
- Cannot detect logical vulnerabilities specific to business logic
- Cannot verify runtime behavior or edge cases
- Cannot assess cross-program invocation risks in full context
- May not detect all vulnerability patterns

For production deployments involving significant value, we strongly recommend engaging a professional security auditing firm to conduct a thorough manual review of your smart contract code.`;

    const disclaimerLines = disclaimerText.split('\n');
    for (const line of disclaimerLines) {
      const wrappedLines = wrapText(line, 90);
      for (const wLine of wrappedLines) {
        page.drawText(wLine, {
          x: margin,
          y,
          size: 10,
          font: helvetica,
          color: GRAY,
        });
        y -= 14;
      }
      y -= 6;
    }

    // Branding box
    y -= 20;
    page.drawRectangle({
      x: margin,
      y: y - 85,
      width: pageWidth - margin * 2,
      height: 100,
      color: rgb(0.98, 0.98, 0.98),
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 1,
    });

    // Logo
    page.drawCircle({
      x: margin + 50,
      y: y - 35,
      size: 30,
      color: PRIMARY,
    });
    page.drawText("SP", {
      x: margin + 38,
      y: y - 42,
      size: 18,
      font: helveticaBold,
      color: WHITE,
    });

    page.drawText("StakePoint", {
      x: margin + 100,
      y: y - 20,
      size: 16,
      font: helveticaBold,
      color: DARK,
    });

    page.drawText("Solana DeFi Platform", {
      x: margin + 100,
      y: y - 38,
      size: 10,
      font: helvetica,
      color: GRAY,
    });

    page.drawText("stakepoint.app", {
      x: margin + 100,
      y: y - 55,
      size: 10,
      font: helvetica,
      color: PRIMARY,
    });

    page.drawText("contact@stakepoint.app", {
      x: margin + 100,
      y: y - 70,
      size: 10,
      font: helvetica,
      color: GRAY,
    });

    page.drawText("Staking | Farming | Swaps | Tools", {
      x: 350,
      y: y - 38,
      size: 9,
      font: helvetica,
      color: GRAY,
    });

    // Add footer to all pages
    const pages = pdfDoc.getPages();
    for (const p of pages) {
      p.drawText("This is an automated analysis and should not replace a professional security audit.", {
        x: margin,
        y: 25,
        size: 8,
        font: helvetica,
        color: LIGHT_GRAY,
      });

      p.drawText("stakepoint.app", {
        x: pageWidth - margin - 60,
        y: 25,
        size: 8,
        font: helvetica,
        color: PRIMARY,
      });
    }

    // Generate PDF
    const pdfBytes = await pdfDoc.save();

    console.log("PDF generated, size:", pdfBytes.length);

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="audit-${(audit.programId || 'unknown').slice(0, 8)}.pdf"`,
        "Content-Length": String(pdfBytes.length),
      },
    });

  } catch (err: any) {
    console.error("PDF generation error:", err);
    return NextResponse.json({
      error: err.message || "PDF generation failed",
    }, { status: 500 });
  }
}

// Helper to wrap text
function wrapText(text: string, maxChars: number): string[] {
  if (!text) return [""];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + word).length <= maxChars) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.length > 0 ? lines : [""];
}