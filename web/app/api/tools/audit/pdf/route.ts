import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Base64 encoded StakePoint logo
const LOGO_BASE64 = "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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/xAAoEAAEDAwQCAgIDAQAAAAAAAAABAgMSExQEERVgBTQgMDFQIZDAMv/a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hqampqampqavDRERERERERERERERERETiyh8zwk4icREREREREROIzJ+UEufwiIn/h4SIiIiJxE4iIiIiPx8rVZqMpOI+pfCREREREREREREREfLmIiPqXwkRERERERERE4iJxSfhir5zURF5WvCRE4iIiIiIiIiInERERGa38eFhIYNzcnY2p3t7YnY3J3IUKNEgRJ1mk0mq1U6KBkp8fxJ+P8f8A/8QAIxEBAQADAAICAgIDAAAAAAAAAQAQEWFQUSAxIXEw8EFgoP/aAAgBAgEBPxD/AIv9Wsu1vb23u3923u292/u293a7XS7XS7Xb5CBbikNHwpERgjBERHwIyRGCIVHxBgiIiIjBERgiIiIvt/XhDBEREREREYMERgiPh9v68IRERERGCIiIyRERki+39eFIiPgYIjBGT5EYcp+XxO7du222222222222222221t7tvdt7tvdt7tvd0ult7/wBm021tb4uFwudzuNxuVyuFxudzuHwEH9Wr+7V/drGV0NeFIiMEZMEZIwZIwRG/s8MZIwRERGDBGCIiIi+39eEIwRgiMERkwRH8H2/rwhgiIiIwRGCIiIiIyRfb+vCEYI+REYIiIiPgREbn+Xwu7bbW2LtdLvd7vdbtdrtdLrd/4kJEtshtb/2jVq02m02m02m021t6tvVt6tvVwuFwuFyuVyuXhiMH8BGDBEREYMoS/J4YyRgiMmSIjGw+4g/OCL7f14QiI+JER8CIjH1KrjcjBfb+vCGCIiPgRGSIiL7MkRF9v68IREfAyRGCMERhD6tN/kfgtJzwh8SIiIwZIiMkZItv3wo2y0tLtdo9l0ut3u91ul2u12/hS0AG5pM3G/F9H/H/AP/EACkQAQEAAAQEBwEAAwEAAAAAAAEAEdHw8TFRYOEQIUFhkbHBcYGQocD/2gAIAQEAAT8Q/wDGXkByjkHxHKfEdsjs0dqjtEdlR29Ha0dgR2RHbMdjx2PHbcdlx2LHakdsR2VHa0drZR2ZlGsvqNRfUaK+o199Rrb6jQn1GiPqNcfUaQ+o0J9RqT6jX31GmvqNRfUai+o019Rr76jUv1GhfqNc/Uap+o0D9Rqf6jW/1Gj/AKjRf1IlifVD6lAQY8fH+M/luCenQ5EREREREREREREREREREREREREREREREREREcZA4xME44C4/wDOhyIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiInMHB/ZH0ORxiIiIiIiIiI4xERERERERERERERERERERERERaFz9DkRERERERERERERERERERERERERERERERERERaFz9D8ERERERERERERERERERERERERERERERERERERaFz9DnCIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiItC5+hzgRERERERERERERERERERERERERERERERERERFqXP0PwERERERERERERERERERERERERERERERERERERGN9GfPodxEREREREREREREREREREREREREREREREREREPpxHuE6HHBxhfWIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIgsS+YEHYA8xgx90sbknkeg5dE4vNvcfm9x83vPm9582+W7W7W7W9W8eEt1W6rd1v63tbktwW6LfFvm37bntz247fdvu33blty25Lelvi3Vbqt1W9re1vbO3ZnaS/bSX7ay/bUX7aq/bR37ae/bT37a2/YXA73TKriuL/o9BYx+sN9bHshPZYuT4sfL8WPl+Ib6PiE9HxHIfF7X4va/F7SYnonsoL4zmMXwCDTf2NV/Y1H9sTR+7Qc4TV+7e+dvvOHzecLns7d2cd/Z2Pms476zjubOO5s7emcd4Zw2Yzty5wudzt25w+Zzh8znC53O3bnb9zjvDOxs1nYmezmC16Hl/bG0v4x/XogiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiECbBE4wh+uObl0ORERERERwiIiIiIiIiIiIiIiIiIiIiIiIiIiIiF7zH/w+hyOMREREREREREREREREREREREREREREREREREQHG0PociIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiLQufogRERERERERERERERERERERERERERERERERERaFz9DnCIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiItC5+hzgRERERERERERERERERERERERERERERERERERFoXP0PwERERERERERERERERERERERHCIiIiIiIiIiIiIkGJ6/Z6H4IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiYgxOP6+h1g+AiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIYwYqYREr8q59EC4GEehCPRYuS9re1+bC9PzbpA5lvkd+t2juVuEd5t9YPPYHPYHPbeWCzVuC3JAZyDzlvi3RbsgM9b2jvKAzVuqDz1v635bgtwx3jb1t+wOfjuuDzdvOAz9ueAz8HmbfPg02EuYrh8y3nNYD/R9g8rB5N7D8XuPi958W2WzWzW1W0W4rdVu63tb0twW6LfNv23Pbnt92+7dNuW3Jb0t0W6reVva3Nbuyt0ZWovy1F+Wivy09+Wvvy1t+Whvy0N+WiPy1x+WuPy0B+WhPy1J+WvPy05+RSnHqL8kRwTB6JCIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIkeAnuY3kobyOGD/C88IPsDn0ORERERERERERERERERERERERERHGIiIiIiIiIiD1wD2C9DkREREREcIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiS+rPn0OREREREREREREREREREREREREREREqiqnKV6GHuwY8I9nG+vmIiIiItY5+hzhEREREREREREREREREREREREREREuJPL1fA8DCYJeQ8HjERERFrHP0OcCIiIiIiIiIiIiIiIiIiIiIiIiIi50elxcXwIiUTngyxBOCREREWkc/Q/ARERERERERERERERERERERERERES8iERERPFvZERERaRz9D8BERERERERERERERERERERERERERO7zYxHgRYSerhewAERERFoXP0PwEREREREREREREREREREREREREREhFwZXXD0Y8CJsF8jh7xERERf2Qf99D8MRERERERERERERERERERERERERETUf8zXlw+0m4L+J/zEqnkEAAGARERERAdcMF/wAvofgiIiIiIiIiIiIiIiIiIiIiIiIiIiIsCIiIiIiLE55pT2xHQ6wwRERERERERERERERERERERERERERERERERERELXHh/qvn+9Dnk4xAiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIg1YSY/mtilmJ7vRCLEYDgf8Qfp8I5XwjsEdlI7aZx2kzjsBnA5RnbcZx2szjtZnHZzOO3GcdoM4DIZx2RnHbWcdpZx2NnHZmca4+41R9wGo/7aU/YOQUggBIDwwXCOE8L4VQ8CiQOYU4hxJi7HhWJE6L0UsgZ4I8ZU94JfkUoPDHgfz/xmH//Z";

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

    // Try to embed logo
    let logoImage = null;
    try {
      const logoBytes = Uint8Array.from(atob(LOGO_BASE64), c => c.charCodeAt(0));
      logoImage = await pdfDoc.embedJpg(logoBytes);
    } catch (e) {
      console.log("Failed to embed logo, using fallback");
    }

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

    // Logo or fallback circle
    if (logoImage) {
      page.drawImage(logoImage, {
        x: 55,
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