import { describe, expect, it } from "vitest";
import {
  buildComposeColor,
  buildComposeType,
  buildFlutterBrandTheme,
  buildNativeTokenPackage,
  buildReactNativeBrandTokens,
  buildSwiftBrandColors,
  resolveMobilePalette,
  toHex32ARGB,
  toRgbFloats,
} from "./mobile-token-exports";

const MOCK_COLORS = [
  { hex: "#0A0A0A", role: "primary", name: "Sumi Black" },
  { hex: "#F4EFE6", role: "background", name: "Washi Paper" },
  { hex: "#8B1A1A", role: "accent", name: "Hanko Crimson" },
  { hex: "#5F5A52", role: "secondary", name: "Slate Charcoal" },
  { hex: "#8A857B", role: "muted", name: "Stone Gray" },
  { hex: "#E2DDD2", role: "border", name: "Line Border" },
];

const MOCK_FONTS = [
  { family: "Cormorant Garamond", role: "display", google_font: true },
  { family: "Libre Baskerville", role: "body", google_font: true },
  { family: "Courier Prime", role: "mono", google_font: true },
];

const MOCK_TOKENS = [
  { category: "spacing", name: "xs", value: "4px" },
  { category: "spacing", name: "md", value: "16px" },
  { category: "spacing", name: "xl", value: "32px" },
  { category: "radius", name: "base", value: "0px" },
];

describe("mobile-token-exports", () => {
  describe("color utilities", () => {
    it("converts hex to 32-bit ARGB hex format for Dart and Compose", () => {
      expect(toHex32ARGB("#0A0A0A")).toBe("0xFF0A0A0A");
      expect(toHex32ARGB("#FFF")).toBe("0xFFFFFFFF");
      expect(toHex32ARGB("#F4EFE6")).toBe("0xFFF4EFE6");
      expect(toHex32ARGB("#8B1A1A")).toBe("0xFF8B1A1A");
      // 8-digit hex (#RRGGBBAA -> 0xAARRGGBB)
      expect(toHex32ARGB("#0A0A0A80")).toBe("0x800A0A0A");
    });

    it("converts hex to normalized RGB floats for SwiftUI", () => {
      const black = toRgbFloats("#000000");
      expect(black.r).toBe(0);
      expect(black.g).toBe(0);
      expect(black.b).toBe(0);

      const white = toRgbFloats("#FFFFFF");
      expect(white.r).toBe(1);
      expect(white.g).toBe(1);
      expect(white.b).toBe(1);
    });

    it("resolves semantic palette with editorial contrast rules", () => {
      const palette = resolveMobilePalette(MOCK_COLORS);
      expect(palette.primary).toBe("#0A0A0A");
      expect(palette.onPrimary).toBe("#FFFFFF");
      expect(palette.background).toBe("#F4EFE6");
      expect(palette.onBackground).toBe("#0A0A0A");
      expect(palette.accent).toBe("#8B1A1A");
      expect(palette.allColors.length).toBe(MOCK_COLORS.length);
    });
  });

  describe("buildFlutterBrandTheme", () => {
    it("generates a complete Flutter BrandTheme.dart file with GoogleFonts and ThemeData", () => {
      const dart = buildFlutterBrandTheme({
        name: "Sumi & Washi",
        colors: MOCK_COLORS,
        fonts: MOCK_FONTS,
        tokens: MOCK_TOKENS,
      });

      expect(dart).toContain("import 'package:flutter/material.dart';");
      expect(dart).toContain("import 'package:google_fonts/google_fonts.dart';");
      expect(dart).toContain("class SumiWashiColors");
      expect(dart).toContain("static const Color primary = Color(0xFF0A0A0A);");
      expect(dart).toContain("static const Color background = Color(0xFFF4EFE6);");
      expect(dart).toContain("class SumiWashiTextTheme");
      expect(dart).toContain("GoogleFonts.getFont(");
      expect(dart).toContain("class SumiWashiTheme");
      expect(dart).toContain("static const ColorScheme lightColorScheme = ColorScheme(");
      expect(dart).toContain("static ThemeData get lightTheme");
      expect(dart).toContain("borderRadius: BorderRadius.zero");
    });
  });

  describe("buildSwiftBrandColors", () => {
    it("generates a complete iOS Swift / SwiftUI token file", () => {
      const swift = buildSwiftBrandColors({
        name: "Sumi & Washi",
        colors: MOCK_COLORS,
        fonts: MOCK_FONTS,
        tokens: MOCK_TOKENS,
      });

      expect(swift).toContain("import SwiftUI");
      expect(swift).toContain("public extension Color");
      expect(swift).toContain("init(hex: String)");
      expect(swift).toContain("struct SumiWashi");
      expect(swift).toContain('public static let primary = Color(hex: "#0A0A0A")');
      expect(swift).toContain('public static let background = Color(hex: "#F4EFE6")');
      expect(swift).toContain("public struct SumiWashiTypography");
      expect(swift).toContain('public static let displayFontName = "Cormorant Garamond"');
      expect(swift).toContain("public static func displayLarge");
      expect(swift).toContain("brandPaperBackground()");
    });
  });

  describe("buildComposeColor and buildComposeType", () => {
    it("generates Android Jetpack Compose Color.kt with Material 3 schemes", () => {
      const ktColor = buildComposeColor({
        name: "Sumi & Washi",
        colors: MOCK_COLORS,
        fonts: MOCK_FONTS,
        tokens: MOCK_TOKENS,
      });

      expect(ktColor).toContain("package com.brandmuse.theme");
      expect(ktColor).toContain("val SumiWashiPrimary = Color(0xFF0A0A0A)");
      expect(ktColor).toContain("val SumiWashiBackground = Color(0xFFF4EFE6)");
      expect(ktColor).toContain("val LightColorScheme = lightColorScheme(");
      expect(ktColor).toContain("val DarkColorScheme = darkColorScheme(");
    });

    it("generates Android Jetpack Compose Type.kt with Material 3 Typography", () => {
      const ktType = buildComposeType({
        name: "Sumi & Washi",
        colors: MOCK_COLORS,
        fonts: MOCK_FONTS,
        tokens: MOCK_TOKENS,
      });

      expect(ktType).toContain("package com.brandmuse.theme");
      expect(ktType).toContain("import androidx.compose.material3.Typography");
      expect(ktType).toContain("val SumiWashiTypography = Typography(");
      expect(ktType).toContain("displayLarge = TextStyle(");
      expect(ktType).toContain("fontSize = 40.sp");
      expect(ktType).toContain("FontWeight.Bold");
    });
  });

  describe("buildReactNativeBrandTokens", () => {
    it("generates React Native brandTokens.ts with StyleSheet and Tamagui preset", () => {
      const rn = buildReactNativeBrandTokens({
        name: "Sumi & Washi",
        colors: MOCK_COLORS,
        fonts: MOCK_FONTS,
        tokens: MOCK_TOKENS,
      });

      expect(rn).toContain('import { StyleSheet } from "react-native";');
      expect(rn).toContain('primary: "#0A0A0A",');
      expect(rn).toContain("export const spacing =");
      expect(rn).toContain("export const radii =");
      expect(rn).toContain("export const brandStyles = StyleSheet.create(");
      expect(rn).toContain("borderRadius: radii.none");
      expect(rn).toContain("export const SumiWashiTamaguiTokens =");
      expect(rn).toContain("export const nativeWindTheme =");
    });
  });

  describe("buildNativeTokenPackage", () => {
    it("aggregates all 5 native mobile files into a file dictionary", () => {
      const pkg = buildNativeTokenPackage({
        name: "Sumi & Washi",
        colors: MOCK_COLORS,
        fonts: MOCK_FONTS,
        tokens: MOCK_TOKENS,
      });

      const keys = Object.keys(pkg);
      expect(keys).toContain("native/BrandTheme.dart");
      expect(keys).toContain("native/BrandColors.swift");
      expect(keys).toContain("native/Color.kt");
      expect(keys).toContain("native/Type.kt");
      expect(keys).toContain("native/brandTokens.ts");

      expect(pkg["native/BrandTheme.dart"]).toContain("class SumiWashiTheme");
      expect(pkg["native/BrandColors.swift"]).toContain("struct SumiWashi");
      expect(pkg["native/Color.kt"]).toContain("val SumiWashiPrimary");
      expect(pkg["native/Type.kt"]).toContain("val SumiWashiTypography");
      expect(pkg["native/brandTokens.ts"]).toContain("SumiWashiTamaguiTokens");
    });
  });
});
