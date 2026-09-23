import { describe, expect, it } from "vitest";
import {
  buildMockupPrompt,
  GenerateMockupInputSchema,
  SaveMockupInputSchema,
} from "./mockups.server";

describe("Live AI Brand Mockups Studio — Server Engine", () => {
  it("synthesizes brand-aligned photorealistic prompts incorporating kit tokens and positioning", () => {
    const prompt = buildMockupPrompt({
      category: "stationery",
      presetId: "business-cards",
      presetName: "Business Cards (Front & Back)",
      kitName: "Kyoto Ink Works",
      primaryHex: "#0A0A0A",
      secondaryHex: "#EDE8DE",
      bgHex: "#F4EFE6",
      headingFont: "Cormorant Garamond",
      monoFont: "Courier Prime",
      positioning: "Minimalist tactile paper goods for architects",
      headline: "The Invisible Instrument",
      tagline: "Precision architecture.",
      cta: "Explore System",
      variant: "light",
    });

    expect(prompt).toContain("Kyoto Ink Works");
    expect(prompt).toContain("#0A0A0A");
    expect(prompt).toContain("#EDE8DE");
    expect(prompt).toContain("#F4EFE6");
    expect(prompt).toContain("350gsm");
    expect(prompt).toContain("The Invisible Instrument");
    expect(prompt).toContain("0px border radius everywhere");
  });

  it("builds category-specific directives for each of the 5 categories", () => {
    const categories = [
      "social-media",
      "stationery",
      "merchandise",
      "outdoor",
      "saas-dashboard",
    ] as const;

    for (const cat of categories) {
      const p = buildMockupPrompt({
        category: cat,
        presetId: "test-preset",
        presetName: "Test Preset",
        kitName: "Acme Brand",
        primaryHex: "#111111",
        secondaryHex: "#222222",
        bgHex: "#FFFFFF",
        headingFont: "Serif",
        monoFont: "Mono",
        variant: "dark",
      });

      expect(p).toContain("Acme Brand");
      expect(p).toContain("#111111");
      expect(p).toContain("#FFFFFF");
      expect(p).toContain("0px border radius");
    }
  });

  it("validates GenerateMockupInputSchema strictly", () => {
    const valid = {
      kitId: "123e4567-e89b-12d3-a456-426614174000",
      category: "merchandise",
      presetId: "crewneck-tshirt",
      variant: "light",
      customHeadline: "Limited Edition",
      customTagline: "Heavyweight Cotton",
      customCta: "Shop Now",
    };

    const parsed = GenerateMockupInputSchema.parse(valid);
    expect(parsed.kitId).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(parsed.category).toBe("merchandise");

    // Invalid UUID
    expect(() =>
      GenerateMockupInputSchema.parse({
        ...valid,
        kitId: "not-a-uuid",
      }),
    ).toThrow();

    // Invalid category
    expect(() =>
      GenerateMockupInputSchema.parse({
        ...valid,
        category: "invalid-category",
      }),
    ).toThrow();
  });

  it("validates SaveMockupInputSchema strictly", () => {
    const validSave = {
      kitId: "123e4567-e89b-12d3-a456-426614174000",
      category: "outdoor",
      presetId: "metro-billboard",
      imageDataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      width: 1920,
      height: 1080,
    };

    const parsed = SaveMockupInputSchema.parse(validSave);
    expect(parsed.kitId).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(parsed.presetId).toBe("metro-billboard");

    // Invalid data URL
    expect(() =>
      SaveMockupInputSchema.parse({
        ...validSave,
        imageDataUrl: "short",
      }),
    ).toThrow();
  });
});
