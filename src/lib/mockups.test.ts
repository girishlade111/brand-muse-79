import { describe, expect, it } from "vitest";
import {
  MOCKUP_CATEGORIES,
  MOCKUP_CATEGORY_META,
  MOCKUP_PRESETS,
  PRESETS_BY_CATEGORY,
  buildMockupSVG,
  cleanHexColor,
  escapeXml,
  wrapTextLines,
} from "./mockups";

describe("Live AI Brand Mockups Studio — Core Engine", () => {
  it("defines the 5 mandatory mockup categories with complete metadata", () => {
    expect(MOCKUP_CATEGORIES).toEqual([
      "social-media",
      "stationery",
      "merchandise",
      "outdoor",
      "saas-dashboard",
    ]);

    for (const cat of MOCKUP_CATEGORIES) {
      expect(MOCKUP_CATEGORY_META[cat]).toBeDefined();
      expect(MOCKUP_CATEGORY_META[cat].label).toBeTruthy();
      expect(MOCKUP_CATEGORY_META[cat].description).toBeTruthy();
      expect(PRESETS_BY_CATEGORY[cat].length).toBeGreaterThanOrEqual(2);
    }
  });

  it("verifies preset resolutions and aspect ratios", () => {
    expect(MOCKUP_PRESETS["instagram-square"]).toMatchObject({
      width: 1080,
      height: 1080,
      category: "social-media",
    });
    expect(MOCKUP_PRESETS["linkedin-banner"]).toMatchObject({
      width: 1584,
      height: 396,
      category: "social-media",
    });
    expect(MOCKUP_PRESETS["business-cards"]).toMatchObject({
      width: 1200,
      height: 800,
      category: "stationery",
    });
    expect(MOCKUP_PRESETS["letterhead-folio"]).toMatchObject({
      width: 850,
      height: 1100,
      category: "stationery",
    });
    expect(MOCKUP_PRESETS["crewneck-tshirt"]).toMatchObject({
      width: 1200,
      height: 1200,
      category: "merchandise",
    });
    expect(MOCKUP_PRESETS["ceramic-mug"]).toMatchObject({
      width: 1200,
      height: 1200,
      category: "merchandise",
    });
    expect(MOCKUP_PRESETS["metro-billboard"]).toMatchObject({
      width: 1920,
      height: 1080,
      category: "outdoor",
    });
    expect(MOCKUP_PRESETS["bus-shelter-poster"]).toMatchObject({
      width: 1200,
      height: 1600,
      category: "outdoor",
    });
    expect(MOCKUP_PRESETS["saas-hero-dark"]).toMatchObject({
      width: 1920,
      height: 1080,
      category: "saas-dashboard",
    });
    expect(MOCKUP_PRESETS["saas-hero-light"]).toMatchObject({
      width: 1920,
      height: 1080,
      category: "saas-dashboard",
    });
  });

  it("cleans and normalizes hex colors safely", () => {
    expect(cleanHexColor("#0a0a0a")).toBe("#0A0A0A");
    expect(cleanHexColor("#fff")).toBe("#FFFFFF");
    expect(cleanHexColor("invalid-color", "#0A0A0A")).toBe("#0A0A0A");
    expect(cleanHexColor(null, "#F4EFE6")).toBe("#F4EFE6");
  });

  it("escapes XML special characters to prevent SVG injection", () => {
    expect(escapeXml('<script>alert("xss")&\'</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&amp;&apos;&lt;/script&gt;",
    );
    expect(escapeXml("Normal Text")).toBe("Normal Text");
    expect(escapeXml("")).toBe("");
  });

  it("wraps text lines deterministically without breaking words", () => {
    const lines = wrapTextLines("The Invisible Instrument Precision Archive Brand Kit", 16, 4);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.length).toBeLessThanOrEqual(4);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(25);
    }
  });

  it("renders deterministic high-resolution SVG for all 5 categories in Light and Dark variants", () => {
    const testCases: Array<{ presetId: string; expectedWidth: number; expectedHeight: number }> = [
      { presetId: "instagram-square", expectedWidth: 1080, expectedHeight: 1080 },
      { presetId: "linkedin-banner", expectedWidth: 1584, expectedHeight: 396 },
      { presetId: "business-cards", expectedWidth: 1200, expectedHeight: 800 },
      { presetId: "letterhead-folio", expectedWidth: 850, expectedHeight: 1100 },
      { presetId: "crewneck-tshirt", expectedWidth: 1200, expectedHeight: 1200 },
      { presetId: "ceramic-mug", expectedWidth: 1200, expectedHeight: 1200 },
      { presetId: "metro-billboard", expectedWidth: 1920, expectedHeight: 1080 },
      { presetId: "bus-shelter-poster", expectedWidth: 1200, expectedHeight: 1600 },
      { presetId: "saas-hero-dark", expectedWidth: 1920, expectedHeight: 1080 },
      { presetId: "saas-hero-light", expectedWidth: 1920, expectedHeight: 1080 },
    ];

    for (const tc of testCases) {
      for (const variant of ["light", "dark"] as const) {
        const svg = buildMockupSVG({
          presetId: tc.presetId,
          variant,
          kitName: "Sumi Studios",
          headline: "Sharp Edges Everywhere",
          tagline: "Japanese Washi & Sumi Ink Standard.",
          cta: "Enter Studio",
          primaryColor: "#0A0A0A",
          secondaryColor: "#8B1A1A",
          backgroundColor: "#F4EFE6",
          accentColor: "#C0392B",
          headingFont: "Cormorant Garamond",
          monoFont: "Courier Prime",
          logoUrl: "https://example.com/logo.svg",
        });

        expect(svg).toContain("<svg");
        expect(svg).toContain(`width="${tc.expectedWidth}"`);
        expect(svg).toContain(`height="${tc.expectedHeight}"`);
        expect(svg.toLowerCase()).toContain("sumi studios");
        expect(svg).toContain("</svg>");
      }
    }
  });

  it("injects custom headline, tagline, and CTA into editorial presets", () => {
    const svg = buildMockupSVG({
      presetId: "instagram-square",
      variant: "light",
      kitName: "Sumi Studios",
      headline: "Sharp Edges Everywhere",
      tagline: "Japanese Washi & Sumi Ink Standard.",
      cta: "Enter Studio",
    });
    expect(svg).toContain("Sharp Edges Everywhere");
    expect(svg).toContain("Japanese Washi &amp; Sumi Ink Standard.");
    expect(svg).toContain("ENTER STUDIO");
  });

  it("gracefully falls back when logoUrl is missing with elegant typographic mark", () => {
    const svg = buildMockupSVG({
      presetId: "instagram-square",
      variant: "light",
      kitName: "Archival DNA",
      headline: "Scalpel Clean",
      tagline: "No decorative fluff.",
      cta: "Explore",
      logoUrl: null,
    });

    expect(svg).toContain("ARCHIVAL DNA");
    expect(svg).not.toContain("<image");
    expect(svg).toContain("<rect");
  });
});
