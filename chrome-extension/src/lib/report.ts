// Compliance Scorecard & 1-Page Printable Report Generator
import type { AuditSummary, AuditViolation } from "./types";

export interface ScoreBreakdown {
  overallScore: number;
  colorScore: number;
  typographyScore: number;
  contrastScore: number;
}

export function calculateComplianceScores(
  totalElementsScanned: number,
  violations: AuditViolation[],
): ScoreBreakdown {
  if (totalElementsScanned === 0) {
    return {
      overallScore: 100,
      colorScore: 100,
      typographyScore: 100,
      contrastScore: 100,
    };
  }

  const offBrandColors = violations.filter((v) => v.type === "off_brand_color").length;
  const unapprovedFonts = violations.filter((v) => v.type === "unapproved_font").length;
  const contrastFailures = violations.filter((v) => v.type === "wcag_contrast_failure").length;

  // Scale deductions based on violation proportion
  const colorDeduction = Math.min(100, Math.round((offBrandColors / Math.max(10, totalElementsScanned)) * 180));
  const fontDeduction = Math.min(100, Math.round((unapprovedFonts / Math.max(10, totalElementsScanned)) * 200));
  const contrastDeduction = Math.min(100, Math.round((contrastFailures / Math.max(10, totalElementsScanned)) * 220));

  const colorScore = Math.max(0, 100 - colorDeduction);
  const typographyScore = Math.max(0, 100 - fontDeduction);
  const contrastScore = Math.max(0, 100 - contrastDeduction);

  const overallScore = Math.max(
    0,
    Math.min(100, Math.round(colorScore * 0.4 + typographyScore * 0.3 + contrastScore * 0.3)),
  );

  return {
    overallScore,
    colorScore,
    typographyScore,
    contrastScore,
  };
}

export function generateJsonReport(summary: AuditSummary): string {
  return JSON.stringify(summary, null, 2);
}

export function generatePrintableHtmlReport(summary: AuditSummary): string {
  const getScoreColor = (score: number) => {
    if (score >= 90) return "#10B981"; // Emerald
    if (score >= 70) return "#F59E0B"; // Amber
    return "#EF4444"; // Red
  };

  const overallColor = getScoreColor(summary.overallScore);

  const colorRows = summary.violations
    .filter((v) => v.type === "off_brand_color")
    .slice(0, 15)
    .map(
      (v) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-family: monospace; font-size: 13px;">
          <span style="display:inline-block; width:12px; height:12px; background:${v.actualValue}; border-radius:2px; vertical-align:middle; margin-right:6px; border:1px solid rgba(0,0,0,0.1);"></span>
          ${escapeHtml(v.actualValue)}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #EF4444;">
          ΔE = ${v.deltaE ?? "N/A"}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-family: monospace; font-size: 13px;">
          <span style="display:inline-block; width:12px; height:12px; background:${v.suggestedReplacement}; border-radius:2px; vertical-align:middle; margin-right:6px; border:1px solid rgba(0,0,0,0.1);"></span>
          ${escapeHtml(v.suggestedReplacement)} ${v.suggestedRole ? `(${escapeHtml(v.suggestedRole)})` : ""}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; color: #64748B;">
          &lt;${escapeHtml(v.elementTag)}&gt; ${escapeHtml(v.property)}
        </td>
      </tr>
    `,
    )
    .join("");

  const fontRows = summary.violations
    .filter((v) => v.type === "unapproved_font")
    .slice(0, 10)
    .map(
      (v) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 500;">
          ${escapeHtml(v.actualValue)}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; color: #10B981; font-weight: 600;">
          ${escapeHtml(v.suggestedReplacement)} ${v.suggestedRole ? `(${escapeHtml(v.suggestedRole)})` : ""}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; color: #64748B;">
          &lt;${escapeHtml(v.elementTag)}&gt;
        </td>
      </tr>
    `,
    )
    .join("");

  const contrastRows = summary.violations
    .filter((v) => v.type === "wcag_contrast_failure")
    .slice(0, 10)
    .map(
      (v) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #EF4444;">
          ${v.contrastRatio ?? "N/A"}:1
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #64748B;">
          ${v.requiredContrast ?? 4.5}:1 (WCAG AA)
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; color: #334155;">
          ${escapeHtml(v.message)}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; color: #64748B;">
          &lt;${escapeHtml(v.elementTag)}&gt;
        </td>
      </tr>
    `,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Brand Muse Compliance Report — ${escapeHtml(summary.kitName)}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      margin: 0;
      padding: 24px;
      line-height: 1.4;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .logo-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .score-banner {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 20px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .overall-circle {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: ${overallColor}15;
      border: 2px solid ${overallColor};
      padding: 12px;
      text-align: center;
    }
    .overall-circle .num {
      font-size: 38px;
      font-weight: 900;
      color: ${overallColor};
      line-height: 1;
    }
    .overall-circle .label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
      margin-top: 4px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .metric-card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 10px 12px;
    }
    .metric-card .title {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748B;
    }
    .metric-card .val {
      font-size: 22px;
      font-weight: 800;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 13px;
    }
    th {
      text-align: left;
      padding: 8px 12px;
      background: #F1F5F9;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
      border-bottom: 2px solid #CBD5E1;
    }
    h2 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 18px 0 6px 0;
      color: #1E293B;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #E2E8F0;
      font-size: 11px;
      color: #94A3B8;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-badge">
        <span>⚡ BRAND MUSE</span>
        <span style="font-weight: 400; color: #64748B; font-size: 14px;">/ Design QA Compliance Audit</span>
      </div>
      <div style="margin-top: 6px; font-size: 13px; color: #475569;">
        Target Page: <strong>${escapeHtml(summary.url)}</strong>
      </div>
      <div style="font-size: 12px; color: #64748B;">
        Brand Kit: <strong>${escapeHtml(summary.kitName)}</strong> (ID: ${escapeHtml(summary.kitId)})
      </div>
    </div>
    <div style="text-align: right; font-size: 12px; color: #64748B;">
      <div>Generated: <strong>${new Date(summary.scannedAt).toLocaleString()}</strong></div>
      <div>Elements Scanned: <strong>${summary.totalElementsScanned}</strong></div>
      <button class="no-print" onclick="window.print()" style="margin-top: 8px; padding: 6px 14px; background: #0F172A; color: #FFF; border: none; border-radius: 4px; font-weight: 600; cursor: pointer;">
        🖨️ Print / Save as PDF
      </button>
    </div>
  </div>

  <div class="score-banner">
    <div class="overall-circle">
      <div class="num">${summary.overallScore}%</div>
      <div class="label">Compliance Score</div>
    </div>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="title">Color Palette</div>
        <div class="val" style="color: ${getScoreColor(summary.colorScore)}">${summary.colorScore}%</div>
        <div style="font-size: 11px; color: #64748B; margin-top: 2px;">${summary.offBrandColorCount} off-brand (ΔE > 5.0)</div>
      </div>
      <div class="metric-card">
        <div class="title">Typography</div>
        <div class="val" style="color: ${getScoreColor(summary.typographyScore)}">${summary.typographyScore}%</div>
        <div style="font-size: 11px; color: #64748B; margin-top: 2px;">${summary.unapprovedFontCount} unapproved fonts</div>
      </div>
      <div class="metric-card">
        <div class="title">WCAG Contrast</div>
        <div class="val" style="color: ${getScoreColor(summary.contrastScore)}">${summary.contrastScore}%</div>
        <div style="font-size: 11px; color: #64748B; margin-top: 2px;">${summary.contrastFailureCount} contrast failures</div>
      </div>
    </div>
  </div>

  ${
    colorRows
      ? `
  <h2>🎨 Off-Brand Colors Deviations (Delta E &gt; 5.0)</h2>
  <table>
    <thead>
      <tr>
        <th>Detected Color</th>
        <th>Delta E Distance</th>
        <th>Suggested Brand Match</th>
        <th>Element / CSS Property</th>
      </tr>
    </thead>
    <tbody>${colorRows}</tbody>
  </table>`
      : `<div style="padding: 10px; background: #ECFDF5; color: #065F46; border-radius: 6px; font-size: 13px;">✓ All colors match the approved brand palette within ΔE ≤ 5.0 threshold.</div>`
  }

  ${
    fontRows
      ? `
  <h2>🔤 Unapproved Typography Deviations</h2>
  <table>
    <thead>
      <tr>
        <th>Detected Font Family</th>
        <th>Recommended Brand Font</th>
        <th>Element Tag</th>
      </tr>
    </thead>
    <tbody>${fontRows}</tbody>
  </table>`
      : ""
  }

  ${
    contrastRows
      ? `
  <h2>👁️ WCAG Accessibility Contrast Failures</h2>
  <table>
    <thead>
      <tr>
        <th>Actual Ratio</th>
        <th>Required Threshold</th>
        <th>Issue Description</th>
        <th>Element Tag</th>
      </tr>
    </thead>
    <tbody>${contrastRows}</tbody>
  </table>`
      : ""
  }

  <div class="footer">
    <div>Brand Muse QA Extension — Automated Compliance Engine</div>
    <div>Report ID: bm-audit-${Date.now().toString(36)}</div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
