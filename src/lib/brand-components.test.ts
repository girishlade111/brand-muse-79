import { describe, expect, it } from "vitest";
import {
  SHOWCASE_COMPONENTS,
  computeContrastRatio,
  createThemeStyleObject,
  generateComponentHtmlCode,
  generateComponentReactCode,
  getDeterministicFallbackComponent,
  resolveBrandComponentTheme,
} from "./brand-components";

describe("Interactive Brand UI Component Library — Engine & Codegen", () => {
  const sampleColors = [
    { hex: "#0A0A0A", role: "primary", name: "Sumi Black" },
    { hex: "#EDE8DE", role: "secondary", name: "Pale Washi" },
    { hex: "#F4EFE6", role: "background", name: "Washi Parchment" },
    { hex: "#8B1A1A", role: "accent", name: "Vermilion Urushi" },
  ];

  const sampleFonts = [
    { family: "Cormorant Garamond", role: "display" },
    { family: "Libre Baskerville", role: "body" },
    { family: "Courier Prime", role: "mono" },
  ];

  it("registers all required component categories and items", () => {
    const requiredCategories = ["buttons", "cards", "forms", "navigation", "hero", "alerts"];
    const categoriesInShowcase = new Set(SHOWCASE_COMPONENTS.map((c) => c.category));

    for (const cat of requiredCategories) {
      expect(categoriesInShowcase.has(cat as any)).toBe(true);
    }

    const itemIds = SHOWCASE_COMPONENTS.map((c) => c.id);
    expect(itemIds).toContain("buttons-suite");
    expect(itemIds).toContain("feature-card");
    expect(itemIds).toContain("product-card");
    expect(itemIds).toContain("pricing-card");
    expect(itemIds).toContain("form-controls");
    expect(itemIds).toContain("navigation-bar");
    expect(itemIds).toContain("hero-header");
    expect(itemIds).toContain("alert-banners");
  });

  it("calculates contrast ratios accurately conforming to WCAG formulas", () => {
    // Pure black vs pure white should equal 21:1
    const blackWhiteRatio = computeContrastRatio("#000000", "#FFFFFF");
    expect(blackWhiteRatio).toBe(21);

    // Sumi Black vs Washi
    const sumiWashiRatio = computeContrastRatio("#0A0A0A", "#F4EFE6");
    expect(sumiWashiRatio).toBeGreaterThanOrEqual(15);

    // Same color has 1:1 ratio
    expect(computeContrastRatio("#123456", "#123456")).toBe(1);
  });

  describe("Theme Resolution (Light / Dark / High-Contrast)", () => {
    it("resolves Light Mode with WCAG AA compliance and brand tokens", () => {
      const theme = resolveBrandComponentTheme(sampleColors, sampleFonts, "light", "Test Brand");
      expect(theme.mode).toBe("light");
      expect(theme.brandName).toBe("Test Brand");
      expect(theme.primary).toBe("#0A0A0A");
      expect(theme.background).toBe("#F4EFE6");
      expect(theme.displayFont).toBe("Cormorant Garamond");
      expect(theme.monoFont).toBe("Courier Prime");
      // Contrast between text and background must meet WCAG AA (>= 4.5:1)
      expect(theme.contrastRatio).toBeGreaterThanOrEqual(4.5);
    });

    it("resolves Dark Mode with inverted surfaces and legible contrast", () => {
      const theme = resolveBrandComponentTheme(sampleColors, sampleFonts, "dark", "Test Brand");
      expect(theme.mode).toBe("dark");
      expect(theme.background).toBe("#0A0A0A");
      expect(theme.text).toBe("#F4EFE6");
      expect(theme.contrastRatio).toBeGreaterThanOrEqual(4.5);
    });

    it("resolves High-Contrast Mode with guaranteed 21:1 contrast and crisp borders", () => {
      const theme = resolveBrandComponentTheme(sampleColors, sampleFonts, "high-contrast", "Test Brand");
      expect(theme.mode).toBe("high-contrast");
      expect(theme.contrastRatio).toBe(21);
      expect(theme.background).toBe("#FFFFFF");
      expect(theme.text).toBe("#000000");
      expect(theme.border).toBe("#000000");
    });
  });

  describe("CSS Custom Property Injection", () => {
    it("creates a comprehensive CSS custom properties style object", () => {
      const theme = resolveBrandComponentTheme(sampleColors, sampleFonts, "light", "Test Brand");
      const styleObj = createThemeStyleObject(theme) as Record<string, string>;

      expect(styleObj["--brand-primary"]).toBe(theme.primary);
      expect(styleObj["--brand-primary-fg"]).toBe(theme.primaryFg);
      expect(styleObj["--brand-secondary"]).toBe(theme.secondary);
      expect(styleObj["--brand-bg"]).toBe(theme.background);
      expect(styleObj["--brand-surface"]).toBe(theme.surface);
      expect(styleObj["--brand-text"]).toBe(theme.text);
      expect(styleObj["--brand-muted"]).toBe(theme.muted);
      expect(styleObj["--brand-accent"]).toBe(theme.accent);
      expect(styleObj["--brand-border"]).toBe(theme.border);
      expect(styleObj["--brand-ring"]).toBe(theme.ring);
      expect(styleObj["--brand-font-display"]).toContain("Cormorant Garamond");
      expect(styleObj["--brand-font-mono"]).toContain("Courier Prime");
    });
  });

  describe("Code Export & Generation", () => {
    it("generates production-ready React 19 + Tailwind v4 code for all components", () => {
      const theme = resolveBrandComponentTheme(sampleColors, sampleFonts, "light", "Test Brand");

      for (const comp of SHOWCASE_COMPONENTS) {
        const reactCode = generateComponentReactCode(comp.id, theme);
        expect(reactCode).toBeTruthy();
        expect(reactCode).toContain("import React");
        expect(reactCode).toContain("export function");
        // Must use CSS custom properties or dynamic classes, never hardcoded raw hex colors
        expect(reactCode).toContain("var(--brand-");
        expect(reactCode).not.toContain("#0A0A0A");
        expect(reactCode).not.toContain("#8B1A1A");
      }
    });

    it("generates clean semantic HTML5 + CSS variables code for all components", () => {
      const theme = resolveBrandComponentTheme(sampleColors, sampleFonts, "light", "Test Brand");

      for (const comp of SHOWCASE_COMPONENTS) {
        const htmlCode = generateComponentHtmlCode(comp.id, theme);
        expect(htmlCode).toBeTruthy();
        expect(htmlCode).toContain("<!-- Component:");
        // Must reference --brand-* variables
        expect(htmlCode).toContain("var(--brand-");
        expect(htmlCode).not.toContain("#0A0A0A");
        expect(htmlCode).not.toContain("#8B1A1A");
      }
    });
  });

  describe("Deterministic AI Fallback Generator", () => {
    it("provides fallback for Testimonial Slider prompt", () => {
      const theme = resolveBrandComponentTheme(sampleColors, sampleFonts, "light", "Test Brand");
      const fallback = getDeterministicFallbackComponent("Create a testimonial slider", theme);

      expect(fallback.componentName).toBe("TestimonialSlider");
      expect(fallback.reactCode).toContain("export function TestimonialSlider");
      expect(fallback.reactCode).toContain("var(--brand-");
      expect(fallback.htmlCode).toContain("var(--brand-");
      expect(fallback.wcagCompliance).toBe("WCAG AA Compliant (4.5:1+ Contrast)");
      expect(fallback.tokensUsed).toContain("--brand-surface");
    });

    it("provides fallback for Checkout Summary prompt", () => {
      const theme = resolveBrandComponentTheme(sampleColors, sampleFonts, "light", "Test Brand");
      const fallback = getDeterministicFallbackComponent("Build a checkout summary card", theme);

      expect(fallback.componentName).toBe("CheckoutSummary");
      expect(fallback.reactCode).toContain("export function CheckoutSummary");
      expect(fallback.reactCode).toContain("var(--brand-");
      expect(fallback.htmlCode).toContain("var(--brand-");
    });
  });
});
