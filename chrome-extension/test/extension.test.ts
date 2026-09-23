import { describe, expect, it } from "vitest";
import {
  calculateContrastRatio,
  checkWcagCompliance,
  compositeColor,
  deltaE76,
  deltaEBetweenHex,
  findClosestBrandColor,
  parseCssColor,
  relativeLuminance,
  rgbToLab,
} from "../src/lib/color-math";
import { checkFontApproval, extractPrimaryFontFamily } from "../src/lib/font-matcher";
import {
  calculateComplianceScores,
  generateJsonReport,
  generatePrintableHtmlReport,
} from "../src/lib/report";
import type { AuditSummary, AuditViolation, BrandColor, BrandFont } from "../src/lib/types";

describe("Brand Muse Chrome Extension QA Engine", () => {
  describe("Color Science & Delta E (CIE76)", () => {
    it("parses 3-digit and 6-digit hex colors", () => {
      const c1 = parseCssColor("#fff");
      expect(c1).toEqual({ r: 255, g: 255, b: 255, a: 1, hex: "#ffffff" });

      const c2 = parseCssColor("#10b981");
      expect(c2).toEqual({ r: 16, g: 185, b: 129, a: 1, hex: "#10b981" });
    });

    it("parses rgb and rgba colors", () => {
      const rgb = parseCssColor("rgb(16, 185, 129)");
      expect(rgb).toEqual({ r: 16, g: 185, b: 129, a: 1, hex: "#10b981" });

      const rgba = parseCssColor("rgba(0, 0, 0, 0.5)");
      expect(rgba).toEqual({ r: 0, g: 0, b: 0, a: 0.5, hex: "#000000" });
    });

    it("converts sRGB to CIE L*a*b* accurately", () => {
      const [lWhite] = rgbToLab(255, 255, 255);
      expect(Math.round(lWhite)).toBe(100);

      const [lBlack] = rgbToLab(0, 0, 0);
      expect(Math.round(lBlack)).toBe(0);
    });

    it("computes Delta E (CIE76) with zero distance for identical colors", () => {
      const lab1 = rgbToLab(16, 185, 129);
      const lab2 = rgbToLab(16, 185, 129);
      expect(deltaE76(lab1, lab2)).toBe(0);
    });

    it("detects off-brand color when Delta E > 5.0", () => {
      const brandPalette: BrandColor[] = [
        { hex: "#10B981", role: "Primary", name: "Emerald" },
        { hex: "#0F172A", role: "Surface", name: "Slate Dark" },
      ];

      // Exact match
      const exact = findClosestBrandColor("#10B981", brandPalette);
      expect(exact.deltaE).toBe(0);
      expect(exact.isOffBrand).toBe(false);
      expect(exact.closest?.hex).toBe("#10B981");

      // Minor variation (ΔE <= 5.0)
      const minor = findClosestBrandColor("#11B882", brandPalette);
      expect(minor.deltaE).toBeLessThan(5.0);
      expect(minor.isOffBrand).toBe(false);

      // Off-brand color (e.g. bright purple #A855F7, ΔE > 5.0)
      const offBrand = findClosestBrandColor("#A855F7", brandPalette);
      expect(offBrand.deltaE).toBeGreaterThan(5.0);
      expect(offBrand.isOffBrand).toBe(true);
      expect(offBrand.closest).not.toBeNull();
    });

    it("composites transparent foreground over opaque background", () => {
      const fg = { r: 0, g: 0, b: 0, a: 0.5 };
      const bg = { r: 255, g: 255, b: 255 };
      const comp = compositeColor(fg, bg);
      expect(comp.r).toBe(128);
      expect(comp.g).toBe(128);
      expect(comp.b).toBe(128);
    });
  });

  describe("WCAG Accessibility Contrast Checking", () => {
    it("calculates contrast ratio correctly", () => {
      const black = { r: 0, g: 0, b: 0 };
      const white = { r: 255, g: 255, b: 255 };
      const ratio = calculateContrastRatio(black, white);
      expect(ratio).toBe(21);
    });

    it("identifies WCAG AA pass and fail", () => {
      // 21:1 passes normal and large text
      const pass = checkWcagCompliance(21, 16, 400);
      expect(pass.compliant).toBe(true);
      expect(pass.requiredRatio).toBe(4.5);

      // 3.5:1 passes large text (>= 24px) but fails normal text (16px)
      const normalFail = checkWcagCompliance(3.5, 16, 400);
      expect(normalFail.compliant).toBe(false);
      expect(normalFail.requiredRatio).toBe(4.5);

      const largePass = checkWcagCompliance(3.5, 24, 400);
      expect(largePass.compliant).toBe(true);
      expect(largePass.requiredRatio).toBe(3.0);
    });
  });

  describe("Font Matching & Brand Approval", () => {
    const approvedFonts: BrandFont[] = [
      { family: "Plus Jakarta Sans", role: "Primary / Body" },
      { family: "Syne", role: "Heading / Display" },
    ];

    it("extracts primary font family from complex CSS font-family", () => {
      expect(extractPrimaryFontFamily('"Plus Jakarta Sans", -apple-system, sans-serif')).toBe(
        "Plus Jakarta Sans",
      );
      expect(extractPrimaryFontFamily("Syne, serif")).toBe("Syne");
      expect(extractPrimaryFontFamily("monospace")).toBe("monospace");
    });

    it("approves fonts listed in brand kit", () => {
      const res = checkFontApproval('"Plus Jakarta Sans", sans-serif', approvedFonts);
      expect(res.isApproved).toBe(true);
      expect(res.primaryFont).toBe("Plus Jakarta Sans");
    });

    it("flags unapproved fonts and recommends role-matched brand font", () => {
      const headingCheck = checkFontApproval("Comic Sans MS, cursive", approvedFonts, "heading");
      expect(headingCheck.isApproved).toBe(false);
      expect(headingCheck.primaryFont).toBe("Comic Sans MS");
      expect(headingCheck.suggestedFont?.family).toBe("Syne");

      const bodyCheck = checkFontApproval("Times New Roman, serif", approvedFonts, "body");
      expect(bodyCheck.isApproved).toBe(false);
      expect(bodyCheck.suggestedFont?.family).toBe("Plus Jakarta Sans");
    });
  });

  describe("Report & Compliance Scorecard", () => {
    it("calculates 100% compliance when 0 violations", () => {
      const scores = calculateComplianceScores(100, []);
      expect(scores.overallScore).toBe(100);
      expect(scores.colorScore).toBe(100);
      expect(scores.typographyScore).toBe(100);
      expect(scores.contrastScore).toBe(100);
    });

    it("deducts points proportionally for violations", () => {
      const mockViolations: AuditViolation[] = [
        {
          id: "1",
          type: "off_brand_color",
          selector: ".cta",
          elementTag: "button",
          property: "background-color",
          actualValue: "#FF0000",
          suggestedReplacement: "#10B981",
          deltaE: 14.2,
          message: "Off-brand color",
        },
        {
          id: "2",
          type: "unapproved_font",
          selector: "h1",
          elementTag: "h1",
          property: "font-family",
          actualValue: "Papyrus",
          suggestedReplacement: "Syne",
          message: "Unapproved typography",
        },
      ];

      const scores = calculateComplianceScores(50, mockViolations);
      expect(scores.overallScore).toBeLessThan(100);
      expect(scores.colorScore).toBeLessThan(100);
      expect(scores.typographyScore).toBeLessThan(100);
      expect(scores.contrastScore).toBe(100); // 0 contrast errors
    });

    it("generates valid JSON export and printable HTML report", () => {
      const summary: AuditSummary = {
        url: "https://example.com",
        title: "Example Website",
        kitId: "mock-kit-123",
        kitName: "Brand Muse Core",
        scannedAt: new Date().toISOString(),
        totalElementsScanned: 50,
        totalViolations: 2,
        offBrandColorCount: 1,
        unapprovedFontCount: 1,
        contrastFailureCount: 0,
        overallScore: 92,
        colorScore: 90,
        typographyScore: 90,
        contrastScore: 100,
        violations: [
          {
            id: "1",
            type: "off_brand_color",
            selector: ".cta",
            elementTag: "button",
            property: "background-color",
            actualValue: "#FF0000",
            suggestedReplacement: "#10B981",
            deltaE: 14.2,
            message: "Off-brand color",
          },
        ],
      };

      const jsonStr = generateJsonReport(summary);
      const parsed = JSON.parse(jsonStr);
      expect(parsed.kitName).toBe("Brand Muse Core");
      expect(parsed.violations.length).toBe(1);

      const html = generatePrintableHtmlReport(summary);
      expect(html).toContain("Brand Muse Compliance Report");
      expect(html).toContain("92%");
      expect(html).toContain("#FF0000");
      expect(html).toContain("#10B981");
      expect(html).toContain("window.print()");
    });
  });
});
