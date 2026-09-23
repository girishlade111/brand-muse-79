import { describe, expect, it } from "vitest";
import {
  buildDtcgTokensPayload,
  buildFigmaVariablesPayload,
  computeTokenHash,
  hexToRgbaFloat,
  parseDimensionPx,
} from "./figma-tokens";

describe("Figma Design Tokens & Variables Engine", () => {
  const sampleColors = [
    { hex: "#0A0A0A", role: "primary", name: "Sumi Black" },
    { hex: "#EDE8DE", role: "secondary", name: "Pale Washi" },
    { hex: "#8B1A1A", role: "accent", name: "Vermilion Urushi" },
  ];

  const sampleFonts = [
    { family: "Cormorant Garamond", role: "display", weights: ["700"] },
    { family: "Libre Baskerville", role: "body", weights: ["400"] },
    { family: "Courier Prime", role: "mono", weights: ["400"] },
  ];

  const sampleTokens = [
    { category: "spacing", name: "sm", value: "8px", description: "Small gap" },
    { category: "spacing", name: "md", value: "16px", description: "Medium gap" },
    { category: "radius", name: "none", value: "0px", description: "Sharp corner" },
    { category: "radius", name: "base", value: "0px", description: "Base corner" },
  ];

  const sampleAssets = [
    { kind: "logo-vector", url: "https://cdn.example.com/logo.svg" },
    { kind: "logo-mark", url: "https://cdn.example.com/mark.svg" },
  ];

  describe("Helper Conversions", () => {
    it("converts hex colors to Figma 0..1 RGBA float structures", () => {
      const black = hexToRgbaFloat("#000000");
      expect(black).toEqual({ r: 0, g: 0, b: 0, a: 1 });

      const white = hexToRgbaFloat("#FFFFFF");
      expect(white).toEqual({ r: 1, g: 1, b: 1, a: 1 });

      const red = hexToRgbaFloat("#8B1A1A");
      expect(red.r).toBeCloseTo(0.545, 2);
      expect(red.g).toBeCloseTo(0.102, 2);
      expect(red.b).toBeCloseTo(0.102, 2);
      expect(red.a).toBe(1);
    });

    it("parses dimension pixel values accurately", () => {
      expect(parseDimensionPx("16px")).toBe(16);
      expect(parseDimensionPx("0px")).toBe(0);
      expect(parseDimensionPx("24")).toBe(24);
      expect(parseDimensionPx("1.5rem")).toBe(24); // 1.5 * 16
    });
  });

  describe("W3C DTCG Specification Format", () => {
    it("formats tokens conforming to W3C DTCG standard ($value, $type, $description)", () => {
      const dtcg = buildDtcgTokensPayload({
        colors: sampleColors,
        fonts: sampleFonts,
        tokens: sampleTokens,
      });

      expect(dtcg.color).toBeDefined();
      expect(dtcg.font).toBeDefined();
      expect(dtcg.dimension).toBeDefined();

      const primaryColor = (dtcg.color as any).primary;
      expect(primaryColor).toBeDefined();
      expect(primaryColor.$value).toBe("#0A0A0A");
      expect(primaryColor.$type).toBe("color");
      expect(primaryColor.$description).toContain("primary");

      const displayFont = (dtcg.font as any)["font-display"];
      expect(displayFont).toBeDefined();
      expect(displayFont.$value).toBe("Cormorant Garamond");
      expect(displayFont.$type).toBe("fontFamily");

      const spacingToken = (dtcg.dimension as any)["spacing-md"];
      expect(spacingToken).toBeDefined();
      expect(spacingToken.$value).toBe("16px");
      expect(spacingToken.$type).toBe("dimension");
    });
  });

  describe("Figma Local Variables & Text Styles Generator", () => {
    it("generates 3 variable collections (Colors, Spacing, Radius)", () => {
      const payload = buildFigmaVariablesPayload({
        kitName: "Kyoto Ink Works",
        colors: sampleColors,
        fonts: sampleFonts,
        tokens: sampleTokens,
        assets: sampleAssets,
      });

      expect(payload.collections.length).toBe(3);

      const colorCol = payload.collections.find((c) => c.name.includes("Colors"));
      expect(colorCol).toBeDefined();
      expect(colorCol?.modes).toContain("Default");
      expect(colorCol?.variables.length).toBe(sampleColors.length);

      const firstVar = colorCol?.variables[0];
      expect(firstVar?.type).toBe("COLOR");
      expect(firstVar?.valuesByMode.Default).toEqual(hexToRgbaFloat("#0A0A0A"));

      const spacingCol = payload.collections.find((c) => c.name.includes("Spacing"));
      expect(spacingCol).toBeDefined();
      const mdSpacing = spacingCol?.variables.find((v) => v.name.includes("md"));
      expect(mdSpacing?.type).toBe("FLOAT");
      expect(mdSpacing?.valuesByMode.Default).toBe(16);

      const radiusCol = payload.collections.find((c) => c.name.includes("Radius"));
      expect(radiusCol).toBeDefined();
      const baseRadius = radiusCol?.variables.find((v) => v.name.includes("base"));
      expect(baseRadius?.type).toBe("FLOAT");
      expect(baseRadius?.valuesByMode.Default).toBe(0); // 0px standard
    });

    it("generates typography text styles and logo lists", () => {
      const payload = buildFigmaVariablesPayload({
        kitName: "Kyoto Ink Works",
        colors: sampleColors,
        fonts: sampleFonts,
        tokens: sampleTokens,
        assets: sampleAssets,
      });

      expect(payload.textStyles.length).toBeGreaterThanOrEqual(4);
      const h1 = payload.textStyles.find((s) => s.name.includes("H1"));
      expect(h1).toBeDefined();
      expect(h1?.fontFamily).toBe("Cormorant Garamond");
      expect(h1?.fontSize).toBe(48);

      expect(payload.logos.length).toBe(2);
      expect(payload.logos[0].kind).toBe("logo-vector");
      expect(payload.logos[0].url).toContain("https://");
    });
  });

  describe("2-Way Diffing Content Hashing", () => {
    it("computes deterministic content hash and detects cloud updates", () => {
      const hash1 = computeTokenHash({
        kitName: "Kyoto Ink Works",
        colors: sampleColors,
        tokens: sampleTokens,
        fonts: sampleFonts,
      });

      const hash2 = computeTokenHash({
        kitName: "Kyoto Ink Works",
        colors: sampleColors,
        tokens: sampleTokens,
        fonts: sampleFonts,
      });

      // Same inputs must yield identical hash
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe("string");
      expect(hash1.length).toBeGreaterThan(0);

      // Modified color must produce diff hash
      const modifiedColors = [
        ...sampleColors.slice(0, 2),
        { hex: "#FF0000", role: "accent", name: "Changed Red" },
      ];

      const hashModified = computeTokenHash({
        kitName: "Kyoto Ink Works",
        colors: modifiedColors,
        tokens: sampleTokens,
        fonts: sampleFonts,
      });

      expect(hashModified).not.toBe(hash1);
    });
  });
});
