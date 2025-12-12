import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Base64 encoded StakePoint logo
const LOGO_BASE64 = "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

/**
 * POST /api/tools/token-safety/pdf
 * Generates a PDF token audit report using pdf-lib (serverless compatible)
 */
export async function POST(req: Request) {
  try {
    const { audit } = await req.json();

    if (!audit || !audit.fullAuditCompleted) {
      return NextResponse.json({ error: "Full audit data required" }, { status: 400 });
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
    const BLUE = rgb(0.23, 0.51, 0.96);

    const getRiskColor = (risk: string) => {
      switch (risk) {
        case "LOW": return GREEN;
        case "MEDIUM": return YELLOW;
        case "HIGH": return ORANGE;
        case "CRITICAL": return RED;
        case "INFO": return BLUE;
        default: return GRAY;
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case "safe": return GREEN;
        case "warning": return YELLOW;
        case "danger": return RED;
        default: return GRAY;
      }
    };

    // Page dimensions
    const pageWidth = 595.28; // A4
    const pageHeight = 841.89;
    const margin = 50;

    // Try to embed logo (JPG format)
    let logoImage = null;
    if (LOGO_BASE64) {
      try {
        const logoBytes = Uint8Array.from(atob(LOGO_BASE64), c => c.charCodeAt(0));
        logoImage = await pdfDoc.embedJpg(logoBytes); // Fixed: JPG not PNG
      } catch (e) {
        console.log("Failed to embed logo, using fallback:", e);
      }
    }

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

    // Logo or fallback circle
    if (logoImage) {
      page.drawImage(logoImage, {
        x: 50,
        y: pageHeight - 95,
        width: 50,
        height: 50,
      });
    } else {
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
    }

    // Title
    page.drawText("TOKEN SECURITY AUDIT", {
      x: 120,
      y: pageHeight - 45,
      size: 22,
      font: helveticaBold,
      color: WHITE,
    });

    page.drawText("StakePoint Token Safety Scanner", {
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
    const dateStr = new Date().toLocaleString();
    page.drawText(`Generated: ${dateStr}`, {
      x: 380,
      y: pageHeight - 82,
      size: 9,
      font: helvetica,
      color: LIGHT_GRAY,
    });

    y = pageHeight - 160;

    // Token Information
    page.drawText("Token Information", {
      x: margin,
      y,
      size: 14,
      font: helveticaBold,
      color: DARK,
    });
    y -= 25;

    // Token name and symbol
    page.drawText(`${audit.symbol} - ${audit.name}`, {
      x: margin,
      y,
      size: 12,
      font: helveticaBold,
      color: DARK,
    });
    y -= 18;

    // Token-2022 badge
    if (audit.isToken2022) {
      page.drawRectangle({
        x: margin,
        y: y - 3,
        width: 70,
        height: 16,
        color: BLUE,
      });
      page.drawText("Token-2022", {
        x: margin + 8,
        y: y,
        size: 9,
        font: helvetica,
        color: WHITE,
      });
      y -= 22;
    }

    // Mint address
    page.drawText(`Mint: ${audit.mint}`, {
      x: margin,
      y,
      size: 8,
      font: courier,
      color: GRAY,
    });
    y -= 20;

    // Supply and holders
    const supplyStr = formatNumber(audit.totalSupply);
    page.drawText(`Total Supply: ${supplyStr}  |  Holders: ${audit.holderCount?.toLocaleString() || "N/A"}  |  Age: ${audit.ageInDays || "?"} days`, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: GRAY,
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

    page.drawText("Safety Score", {
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

    y = scoreBoxY - 30;

    // ===== SECURITY CHECKS =====
    page.drawText("Security Checks", {
      x: margin,
      y,
      size: 14,
      font: helveticaBold,
      color: DARK,
    });
    y -= 25;

    const securityChecks = [
      { name: "Mint Authority", status: audit.mintAuthority?.status, value: audit.mintAuthority?.value ? "Active" : "Revoked ✓" },
      { name: "Freeze Authority", status: audit.freezeAuthority?.status, value: audit.freezeAuthority?.value ? "Active" : "Revoked ✓" },
      { name: "Transfer Tax", status: audit.hasTransferTax?.status, value: audit.hasTransferTax?.taxBps ? `${(audit.hasTransferTax.taxBps / 100).toFixed(2)}%` : "None ✓" },
      { name: "Metadata", status: audit.metadataMutable?.status, value: audit.metadataMutable?.mutable ? "Mutable" : "Immutable ✓" },
      { name: "Top 10 Concentration", status: audit.top10Concentration > 50 ? "danger" : audit.top10Concentration > 30 ? "warning" : "safe", value: `${audit.top10Concentration?.toFixed(1) || 0}%` },
    ];

    for (const check of securityChecks) {
      // Status circle
      page.drawCircle({
        x: margin + 8,
        y: y + 4,
        size: 5,
        color: getStatusColor(check.status || "safe"),
      });

      page.drawText(check.name, {
        x: margin + 25,
        y,
        size: 10,
        font: helvetica,
        color: DARK,
      });

      page.drawText(check.value, {
        x: pageWidth - margin - 80,
        y,
        size: 10,
        font: helveticaBold,
        color: getStatusColor(check.status || "safe"),
      });

      y -= 22;
    }

    y -= 15;

    // ===== TOKEN-2022 EXTENSIONS =====
    page.drawText("Token-2022 Extension Analysis", {
      x: margin,
      y,
      size: 14,
      font: helveticaBold,
      color: DARK,
    });
    y -= 25;

    const extensions = audit.token2022Extensions || [];
    if (extensions.length === 0) {
      page.drawRectangle({
        x: margin,
        y: y - 18,
        width: pageWidth - margin * 2,
        height: 30,
        color: rgb(0.94, 0.99, 0.95),
        borderColor: GREEN,
        borderWidth: 1,
      });
      page.drawText("No dangerous Token-2022 extensions detected", {
        x: margin + 15,
        y: y - 5,
        size: 10,
        font: helvetica,
        color: GREEN,
      });
      y -= 45;
    } else {
      for (const ext of extensions) {
        if (y < 100) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - 50;
        }

        const extColor = getRiskColor(ext.riskLevel);

        // Extension box
        page.drawRectangle({
          x: margin,
          y: y - 25,
          width: pageWidth - margin * 2,
          height: 35,
          color: rgb(0.98, 0.98, 0.98),
          borderColor: extColor,
          borderWidth: 1,
        });

        // Risk badge
        page.drawRectangle({
          x: margin + 10,
          y: y - 15,
          width: 60,
          height: 16,
          color: extColor,
        });
        page.drawText(ext.riskLevel, {
          x: margin + 20,
          y: y - 12,
          size: 8,
          font: helveticaBold,
          color: WHITE,
        });

        // Extension name
        page.drawText(ext.name, {
          x: margin + 80,
          y: y - 5,
          size: 10,
          font: helveticaBold,
          color: DARK,
        });

        // Description
        page.drawText(ext.description || "", {
          x: margin + 80,
          y: y - 18,
          size: 8,
          font: helvetica,
          color: GRAY,
        });

        y -= 45;
      }
    }

    // ===== HONEYPOT ANALYSIS =====
    if (y < 150) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 50;
    }

    page.drawText("Honeypot Analysis", {
      x: margin,
      y,
      size: 14,
      font: helveticaBold,
      color: DARK,
    });
    y -= 25;

    const hp = audit.honeypotAnalysis;
    if (hp) {
      const hpColor = hp.isHoneypot ? RED : GREEN;
      const hpBgColor = hp.isHoneypot ? rgb(0.99, 0.94, 0.94) : rgb(0.94, 0.99, 0.95);

      page.drawRectangle({
        x: margin,
        y: y - 45,
        width: pageWidth - margin * 2,
        height: 55,
        color: hpBgColor,
        borderColor: hpColor,
        borderWidth: 1,
      });

      if (hp.isHoneypot) {
        page.drawText("HONEYPOT DETECTED", {
          x: margin + 15,
          y: y - 10,
          size: 12,
          font: helveticaBold,
          color: RED,
        });
        if (hp.honeypotReason) {
          page.drawText(hp.honeypotReason.slice(0, 80), {
            x: margin + 15,
            y: y - 28,
            size: 9,
            font: helvetica,
            color: GRAY,
          });
        }
      } else {
        page.drawText("No honeypot detected - Token is tradeable", {
          x: margin + 15,
          y: y - 10,
          size: 11,
          font: helveticaBold,
          color: GREEN,
        });

        page.drawText(`Can Buy: Yes    Can Sell: Yes    Buy Tax: ${hp.buyTax}%    Sell Tax: ${hp.sellTax}%`, {
          x: margin + 15,
          y: y - 30,
          size: 10,
          font: helvetica,
          color: DARK,
        });
      }

      y -= 65;
    }

    // ===== LP STATUS =====
    if (y < 150) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 50;
    }

    page.drawText("Liquidity Pool Status", {
      x: margin,
      y,
      size: 14,
      font: helveticaBold,
      color: DARK,
    });
    y -= 25;

    const lp = audit.lpInfo;
    if (lp) {
      // LP bar background
      page.drawRectangle({
        x: margin,
        y: y - 15,
        width: pageWidth - margin * 2,
        height: 20,
        color: rgb(0.9, 0.9, 0.9),
      });

      // Burned portion
      if (lp.burned > 0) {
        page.drawRectangle({
          x: margin,
          y: y - 15,
          width: (pageWidth - margin * 2) * (lp.burned / 100),
          height: 20,
          color: ORANGE,
        });
      }

      // Locked portion
      if (lp.locked > 0) {
        page.drawRectangle({
          x: margin + (pageWidth - margin * 2) * (lp.burned / 100),
          y: y - 15,
          width: (pageWidth - margin * 2) * (lp.locked / 100),
          height: 20,
          color: GREEN,
        });
      }

      y -= 30;

      // Labels
      page.drawText(`Burned: ${lp.burned.toFixed(1)}%`, {
        x: margin,
        y,
        size: 10,
        font: helvetica,
        color: ORANGE,
      });

      page.drawText(`Locked: ${lp.locked.toFixed(1)}%`, {
        x: margin + 150,
        y,
        size: 10,
        font: helvetica,
        color: GREEN,
      });

      page.drawText(`Unlocked: ${lp.unlocked.toFixed(1)}%`, {
        x: margin + 300,
        y,
        size: 10,
        font: helvetica,
        color: lp.unlocked > 50 ? RED : GRAY,
      });

      y -= 25;

      // Warning message
      if (lp.unlocked > 50) {
        page.drawRectangle({
          x: margin,
          y: y - 15,
          width: pageWidth - margin * 2,
          height: 22,
          color: rgb(0.99, 0.94, 0.94),
          borderColor: RED,
          borderWidth: 1,
        });
        page.drawText("High rug pull risk - majority of LP is unlocked", {
          x: margin + 15,
          y: y - 8,
          size: 9,
          font: helvetica,
          color: RED,
        });
        y -= 30;
      } else if (lp.burned > 90) {
        page.drawRectangle({
          x: margin,
          y: y - 15,
          width: pageWidth - margin * 2,
          height: 22,
          color: rgb(0.94, 0.99, 0.95),
          borderColor: GREEN,
          borderWidth: 1,
        });
        page.drawText("LP burned - cannot be rugged via liquidity removal", {
          x: margin + 15,
          y: y - 8,
          size: 9,
          font: helvetica,
          color: GREEN,
        });
        y -= 30;
      }
    } else {
      page.drawText("LP data not available", {
        x: margin,
        y,
        size: 10,
        font: helvetica,
        color: GRAY,
      });
      y -= 20;
    }

    // ===== TOP HOLDERS =====
    if (y < 200) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 50;
    }

    y -= 15;
    page.drawText("Top Holders", {
      x: margin,
      y,
      size: 14,
      font: helveticaBold,
      color: DARK,
    });
    y -= 25;

    // Table header
    page.drawRectangle({
      x: margin,
      y: y - 15,
      width: pageWidth - margin * 2,
      height: 22,
      color: rgb(0.95, 0.95, 0.95),
    });

    page.drawText("#", { x: margin + 10, y: y - 8, size: 9, font: helveticaBold, color: GRAY });
    page.drawText("Wallet Address", { x: margin + 40, y: y - 8, size: 9, font: helveticaBold, color: GRAY });
    page.drawText("Holdings %", { x: pageWidth - margin - 70, y: y - 8, size: 9, font: helveticaBold, color: GRAY });

    y -= 22;

    const topHolders = audit.topHolders || [];
    for (let i = 0; i < Math.min(topHolders.length, 10); i++) {
      const holder = topHolders[i];
      const bgColor = i % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.98, 0.98);
      const holdingColor = holder.percentage > 20 ? RED : holder.percentage > 10 ? YELLOW : DARK;

      page.drawRectangle({
        x: margin,
        y: y - 15,
        width: pageWidth - margin * 2,
        height: 20,
        color: bgColor,
      });

      page.drawText(`#${i + 1}`, {
        x: margin + 10,
        y: y - 8,
        size: 9,
        font: helvetica,
        color: i < 3 ? YELLOW : GRAY,
      });

      page.drawText(`${holder.wallet.slice(0, 8)}...${holder.wallet.slice(-8)}`, {
        x: margin + 40,
        y: y - 8,
        size: 8,
        font: courier,
        color: GRAY,
      });

      page.drawText(`${holder.percentage.toFixed(2)}%`, {
        x: pageWidth - margin - 60,
        y: y - 8,
        size: 10,
        font: helveticaBold,
        color: holdingColor,
      });

      y -= 20;
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

    const disclaimerText = `This token safety audit report was automatically generated by StakePoint Token Safety Scanner on ${dateStr}.

IMPORTANT: This automated analysis is provided for informational purposes only and should not be considered financial advice. It analyzes on-chain token data and applies pattern-based checks for common risks.

What this audit checks:
- Token authority status (mint, freeze)
- Token-2022 dangerous extensions (transfer hooks, permanent delegates)
- Holder concentration and distribution
- Liquidity pool status (burned/locked)
- Basic honeypot indicators

Limitations:
- Cannot guarantee future token behavior
- Cannot detect all scam patterns
- LP status may change after this report
- Not a substitute for professional due diligence

Always do your own research before investing in any token.`;

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

    // Logo in branding box
    if (logoImage) {
      page.drawImage(logoImage, {
        x: margin + 25,
        y: y - 65,
        width: 50,
        height: 50,
      });
    } else {
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
    }

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
      p.drawText("This is an automated analysis and should not replace professional due diligence.", {
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

    console.log("Token audit PDF generated, size:", pdfBytes.length);

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="token-audit-${audit.symbol || 'unknown'}.pdf"`,
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

// Helper to format large numbers
function formatNumber(num: number): string {
  if (!num) return "0";
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
  return num.toLocaleString();
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