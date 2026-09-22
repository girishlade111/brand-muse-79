import { describe, expect, it } from "vitest";
import {
  STUDIO_ASSET_META,
  buildStudioSVG,
  escapeXml,
  pickStudioLogo,
  resolveStudioFonts,
  resolveStudioPalette,
  wrapText,
} from "./studio";

describe("studio engine", () => {
  it("covers the five required asset sizes", () => {
    expect(STUDIO_ASSET_META["linkedin-banner"]).toMatchObject({ width: 1584, height: 396 });
    expect(STUDIO_ASSET_META["twitter-header"]).toMatchObject({ width: 1500, height: 500 });
    expect(STUDIO_ASSET_META["instagram-post"]).toMatchObject({ width: 1080, height: 1080 });
    expect(STUDIO_ASSET_META["og-card"]).toMatchObject({ width: 1200, height: 630 });
    expect(STUDIO_ASSET_META["deck-cover"]).toMatchObject({ width: 1920, height: 1080 });
  });

  it("resolves light/dark/hanko palettes without throwing", () => {
    const colors = [
      { hex: "#0A0A0A", role: "primary" },
      { hex: "#F4EFE6", role: "background" },
      { hex: "#8B1A1A", role: "accent" },
    ];
    for (const scheme of ["light", "dark", "hanko-accent"] as const) {
      const p = resolveStudioPalette(colors, scheme);
      expect(p.background).toMatch(/^#/);
      expect(p.ink).toMatch(/^#/);
    }
  });

  it("picks logo variants per scheme", () => {
    const assets = [
      { kind: "logo", url: "https://example.com/logo.svg" },
      { kind: "logo-on-dark", url: "https://example.com/logo-dark.svg" },
    ];
    expect(pickStudioLogo(assets, "dark")?.kind).toBe("logo-on-dark");
    expect(pickStudioLogo([], "light")).toBeNull();
  });

  it("resolves display/body fonts with fallbacks", () => {
    const f = resolveStudioFonts([
      { family: "Inter", role: "heading", google_font: true },
      { family: "IBM Plex Mono", role: "mono", google_font: true },
    ]);
    expect(f.display).toBe("Inter");
    expect(resolveStudioFonts([]).display).toBe("Cormorant Garamond");
  });

  it("wraps text deterministically", () => {
    expect(wrapText("", 10, 3)).toEqual([]);
    const lines = wrapText("The quick brown fox jumps over the lazy dog", 12, 3);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(escapeXml('<a>&"')).toBe("&lt;a&gt;&amp;&quot;");
  });

  it("builds standalone SVG for every asset x template", () => {
    const colors = [
      { hex: "#0A0A0A", role: "primary" },
      { hex: "#F4EFE6", role: "background" },
      { hex: "#8B1A1A", role: "accent" },
    ];
    const fonts = [{ family: "Inter", role: "heading" }];
    const assetTypes = Object.keys(STUDIO_ASSET_META) as Array<keyof typeof STUDIO_ASSET_META>;
    for (const assetType of assetTypes) {
      const svg = buildStudioSVG({
        assetType,
        template: "minimalist",
        colorScheme: "light",
        logoPlacement: "top-left",
        headline: "Steal any brand.",
        body: "Colors. Typography. Voice. Tokens.",
        cta: "Explore the system",
        kitName: "Acme",
        colors,
        fonts,
        logoUrl: null,
      });
      expect(svg).toContain("<svg");
      expect(svg).toContain(`width="${STUDIO_ASSET_META[assetType].width}"`);
      expect(svg).toContain("Steal any brand.");
    }
  });
});
