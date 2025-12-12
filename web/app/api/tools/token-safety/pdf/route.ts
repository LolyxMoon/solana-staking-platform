import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const LOGO_BASE64 = "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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/xAAoEAAEDAwQCAgIDAQAAAAAAAAABAgMSExQEERVgBTQgMDFQIZDAMv/a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hqampqampqavDRERERERERERERERERETiyh8zwk4icREREREREROIzJ+UEufwiIn/h4SIiIiJxE4iIiIiPx8rVZqMpOI+pfCREREREREREREREfLmIiPqXwkRERERERERE4iJxSfhir5zURF5WvCRE4iIiIiIiIiInERERGa38eFhIYNzcnY2p3t7YnY3J3IUKNEgRJ1mk0mq1U6KBkp8fxJ+P8f8A/8QAIxEBAQADAAICAgIDAAAAAAAAAQAQEWFQUSAxIXEw8EFgoP/aAAgBAgEBPxD/AIv9Wsu1vb23u3923u292/u293a7XS7XS7Xb5CBbikNHwpERgjBERHwIyRGCIVHxBgiIiIjBERgiIiIvt/XhDBEREREREYMERgiPh9v68IRERERGCIiIyRERki+39eFIiPgYIjBGT5EYcp+XxO7du222222222222222221t7tvdt7tvdt7tvd0ult7/wBm021tb4uFwudzuNxuVyuFxudzuHwEH9Wr+7V/drGV0NeFIiMEZMEZIwZIwRG/s8MZIwRERGDBGCIiIi+39eEIwRgiMERkwRH8H2/rwhgiIiIwRGCIiIiIyRfb+vCEYI+REYIiIiPgREbn+Xwu7bbW2LtdLvd7vdbtdrtdLrd/4kJEtshtb/2jVq02m02m02m021t6tvVt6tvVwuFwuFyuVyuXhiMH8BGDBEREYMoS/J4YyRgiMmSIjGw+4g/OCL7f14QiI+JER8CIjH1KrjcjBfb+vCGCIiPgRGSIiL7MkRF9v68IREfAyRGCMERhD6tN/kfgtJzwh8SIiIwZIiMkZItv3wo2y0tLtdo9l0ut3u91ul2u12/hS0AG5pM3G/F9H/H/AP/EACkQAQEAAAQEBwEAAwEAAAAAAAEAEdHw8TFRYOEQIUFhkbHBcYGQocD/2gAIAQEAAT8Q/wDGXkByjkHxHKfEdsjs0dqjtEdlR29Ha0dgR2RHbMdjx2PHbcdlx2LHakdsR2VHa0drZR2ZlGsvqNRfUaK+o199Rrb6jQn1GiPqNcfUaQ+o0J9RqT6jX31GmvqNRfUai+o019Rr76jUv1GhfqNc/Uap+o0D9Rqf6jW/1Gj/AKjRf1IlifVD6lAQY8fH+M/luCenQ5EREREREREREREREREREREREREREREREREREcZA4xME44C4/wDOhyIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiInMHB/ZH0ORxiIiIiIiIiI4xERERERERERERERERERERERERaFz9DkRERERERERERERERERERERERERERERERERERaFz9D8ERERERERERERERERERERERERERERERERERERaFz9DnCIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiItC5+hzgRERERERERERERERERERERERERERERERERERFqXP0PwERERERERERERERERERERERERERERERERERERGN9GfPodxEREREREREREREREREREREREREREREREREREPpxHuE6HHBxhfWIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIgsS+YEHYA8xgx90sbknkeg5dE4vNvcfm9x83vPm9582+W7W7W7W9W8eEt1W6rd1v63tbktwW6LfFvm37bntz247fdvu33blty25Lelvi3Vbqt1W9re1vbO3ZnaS/bSX7ay/bUX7aq/bR37ae/bT37a2/YXA73TKriuL/o9BYx+sN9bHshPZYuT4sfL8WPl+Ib6PiE9HxHIfF7X4va/F7SYnonsoL4zmMXwCDTf2NV/Y1H9sTR+7Qc4TV+7e+dvvOHzecLns7d2cd/Z2Pms476zjubOO5s7emcd4Zw2Yzty5wudzt25w+Zzh8znC53O3bnb9zjvDOxs1nYmezmC16Hl/bG0v4x/XogiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiECbBE4wh+uObl0ORERERERwiIiIiIiIiIiIiIiIiIiIiIiIiIiIiF7zH/w+hyOMREREREREREREREREREREREREREREREREREQHG0PociIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiLQufogRERERERERERERERERERERERERERERERERERaFz9DnCIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiItC5+hzgRERERERERERERERERERERERERERERERERERFoXP0PwERERERERERERERERERERERHCIiIiIiIiIiIiIkGJ6/Z6H4IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiYgxOP6+h1g+AiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIYwYqYREr8q59EC4GEehCPRYuS9re1+bC9PzbpA5lvkd+t2juVuEd5t9YPPYHPYHPbeWCzVuC3JAZyDzlvi3RbsgM9b2jvKAzVuqDz1v635bgtwx3jb1t+wOfjuuDzdvOAz9ueAz8HmbfPg02EuYrh8y3nNYD/R9g8rB5N7D8XuPi958W2WzWzW1W0W4rdVu63tb0twW6LfNv23Pbnt92+7dNuW3Jb0t0W6reVva3Nbuyt0ZWovy1F+Wivy09+Wvvy1t+Whvy0N+WiPy1x+WuPy0B+WhPy1J+WvPy05+RSnHqL8kRwTB6JCIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIkeAnuY3kobyOGD/C88IPsDn0ORERERERERERERERERERERERERHGIiIiIiIiIiD1wD2C9DkREREREcIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiS+rPn0OREREREREREREREREREREREREREREqiqnKV6GHuwY8I9nG+vmIiIiItY5+hzhEREREREREREREREREREREREREREuJPL1fA8DCYJeQ8HjERERFrHP0OcCIiIiIiIiIiIiIiIiIiIiIiIiIi50elxcXwIiUTngyxBOCREREWkc/Q/ARERERERERERERERERERERERERES8iERERPFvZERERaRz9D8BERERERERERERERERERERERERERO7zYxHgRYSerhewAERERFoXP0PwEREREREREREREREREREREREREREhFwZXXD0Y8CJsF8jh7xERERf2Qf99D8MRERERERERERERERERERERERERETUf8zXlw+0m4L+J/zEqnkEAAGARERERAdcMF/wAvofgiIiIiIiIiIiIiIiIiIiIiIiIiIiIsCIiIiIiLE55pT2xHQ6wwRERERERERERERERERERERERERERERERERERELXHh/qvn+9Dnk4xAiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIg1YSY/mtilmJ7vRCLEYDgf8Qfp8I5XwjsEdlI7aZx2kzjsBnA5RnbcZx2szjtZnHZzOO3GcdoM4DIZx2RnHbWcdpZx2NnHZmca4+41R9wGo/7aU/YOQUggBIDwwXCOE8L4VQ8CiQOYU4hxJi7HhWJE6L0UsgZ4I8ZU94JfkUoPDHgfz/xmH//Z";

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

    // Try to embed logo
    let logoImage = null;
    if (LOGO_BASE64) {
      try {
        const logoBytes = Uint8Array.from(atob(LOGO_BASE64), c => c.charCodeAt(0));
        logoImage = await pdfDoc.embedJpg(logoBytes);
      } catch (e) {
        console.log("Failed to embed logo, using fallback");
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