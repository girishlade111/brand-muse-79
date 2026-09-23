import { describe, expect, it } from "vitest";
import {
  buildDtcgTokens,
  buildFlutterTheme,
  buildFrameworkFiles,
  buildReactNativeTheme,
  buildShadcnGlobalsCss,
  buildSwiftColors,
  buildTailwindConfig,
  resolveSemanticPalette,
} from "./exports";

const COLORS = [
  { id: "1", hex: "#0A0A0A", role: "primary", name: "Ink" },
  { id: "2", hex: "#F4EFE6", role: "background", name: "Paper" },
  { id: "3", hex: "#8B1A1A", role: "accent", name: "Hanko" },
  { id: "4", hex: "#5F5A52", role: "muted", name: "Stone" },
];

const FONTS = [
  { id: "1", family: "Cormorant Garamond", role: "display", weights: ["500", "700"] },
  { id: "2", family: "Courier Prime", role: "mono", weights: ["400", "700"] },
];

const TOKENS = [
  { id: "1", category: "spacing", name: "md", value: "16px" },
  { id: "2", category: "radius", name: "default", value: "0px" },
  { id: "3", category: "shadow", name: "soft", value: "0 16px 40px rgba(0,0,0,0.10)" },
];

describe("semantic palette", () => {
  it("maps roles with readable foregrounds", () => {
    const s = resolveSemanticPalette(COLORS);
    expect(s.background).toBe("#F4EFE6");
    expect(s.primary).toBe("#0A0A0A");
    expect(s.accent).toBe("#8B1A1A");
    expect(s.primaryForeground).toMatch(/^#(FFFFFF|0A0A0A)$/);
    expect(s.border).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("falls back gracefully with no colors", () => {
    const s = resolveSemanticPalette([]);
    for (const v of Object.values(s)) expect(v).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("shadcn globals.css", () => {
  it("emits @theme with HSL tokens", () => {
    const css = buildShadcnGlobalsCss({ colors: COLORS, fonts: FONTS });
    expect(css).toContain("@theme");
    for (const token of [
      "--background",
      "--foreground",
      "--primary",
      "--primary-foreground",
      "--muted",
      "--accent",
      "--border",
      "--ring",
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toMatch(/--primary: \d+ \d+% \d+%;/);
    expect(css).toContain("Cormorant Garamond");
  });
});

describe("tailwind.config.js", () => {
  it("emits a CJS config with colors and fonts", () => {
    const js = buildTailwindConfig({ colors: COLORS, fonts: FONTS, tokens: TOKENS });
    expect(js).toContain("module.exports");
    expect(js).toContain('"primary": "#0A0A0A"');
    expect(js).toContain("fontFamily");
    expect(js).toContain("Courier Prime");
  });
});

describe("flutter theme", () => {
  it("emits BrandColors with Color(0xFF..) and a TextTheme", () => {
    const dart = buildFlutterTheme({ name: "Acme", colors: COLORS, fonts: FONTS });
    expect(dart).toContain("class BrandColors");
    expect(dart).toContain("Color(0xFF0A0A0A)");
    expect(dart).toContain("Color(0xFF8B1A1A)");
    expect(dart).toContain("TextTheme");
    expect(dart).toContain("Cormorant Garamond");
    expect(dart).toContain("Courier Prime");
    expect(dart).toContain("import 'package:flutter/material.dart';");
  });
});

describe("react native theme", () => {
  it("emits colors and typography presets", () => {
    const ts = buildReactNativeTheme({ colors: COLORS, fonts: FONTS, tokens: TOKENS });
    expect(ts).toContain("export const colors");
    expect(ts).toContain('accent: "#8B1A1A"');
    expect(ts).toContain("export const typography");
    expect(ts).toContain('fontFamily: "Cormorant Garamond"');
    expect(ts).toContain("BrandColor");
    expect(ts).toContain("radii");
  });
});

describe("swift colors", () => {
  it("emits a Color extension with semantic statics", () => {
    const swift = buildSwiftColors({ name: "Acme", colors: COLORS });
    expect(swift).toContain("import SwiftUI");
    expect(swift).toContain("extension Color");
    expect(swift).toContain("static let brandPrimary");
    expect(swift).toContain("static let brandAccent");
    expect(swift).toMatch(/red: 0\.\d+, green: 0\.\d+, blue: 0\.\d+/);
  });
});

describe("DTCG tokens.json", () => {
  it("is valid W3C-style JSON with $value/$type", () => {
    const raw = buildDtcgTokens({ colors: COLORS, fonts: FONTS, tokens: TOKENS });
    const json = JSON.parse(raw) as Record<
      string,
      Record<string, { $value: string; $type: string }>
    >;
    expect(json.color.primary.$type).toBe("color");
    expect(json.color.primary.$value).toBe("#0A0A0A");
    expect(json.font["font-display"].$type).toBe("fontFamily");
    expect(json.dimension["spacing-md"].$type).toBe("dimension");
    expect(json.dimension["spacing-md"].$value).toBe("16px");
    expect(json.other["shadow-soft"].$type).toBe("other");
  });

  it("dedupes colliding keys", () => {
    const raw = buildDtcgTokens({
      colors: [
        { id: "1", hex: "#111111", role: "primary" },
        { id: "2", hex: "#222222", role: "primary" },
      ],
      fonts: [],
      tokens: [],
    });
    const json = JSON.parse(raw) as { color: Record<string, unknown> };
    expect(Object.keys(json.color)).toHaveLength(2);
  });
});

describe("framework file manifest", () => {
  it("covers every required zip path", () => {
    const files = buildFrameworkFiles({
      name: "Acme",
      colors: COLORS,
      fonts: FONTS,
      tokens: TOKENS,
    });
    expect(Object.keys(files).sort()).toEqual(
      [
        "tokens/tokens.css",
        "tokens/tailwind.config.js",
        "tokens/shadcn-globals.css",
        "tokens/tokens.json",
        "mobile/brand_theme.dart",
        "mobile/theme.ts",
        "mobile/BrandColors.swift",
        "native/BrandTheme.dart",
        "native/BrandColors.swift",
        "native/Color.kt",
        "native/Type.kt",
        "native/brandTokens.ts",
      ].sort(),
    );
    expect(files["tokens/tokens.json"]).toContain("$value");
    expect(files["mobile/brand_theme.dart"]).toContain("BrandColors");
  });
});
