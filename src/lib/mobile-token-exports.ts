// Multi-Platform Native Mobile Token Generators for Brand Muse.
// Generates production-ready token packages for:
// 1. Flutter (Dart): ThemeData, ColorScheme, TextStyle with GoogleFonts
// 2. iOS (Swift / SwiftUI): Color extensions, semantic dynamic providers, Font hierarchy
// 3. Android (Kotlin / Jetpack Compose): Color.kt and Type.kt (Material 3)
// 4. React Native: StyleSheet-compatible tokens, TypeScript types, and Tamagui / NativeWind presets.

import { cleanHexColor } from "@/lib/mockups";

export type MobileColorToken = {
  id?: string;
  hex: string;
  role?: string | null;
  name?: string | null;
};

export type MobileFontToken = {
  id?: string;
  family: string;
  role?: string | null;
  weights?: string[] | null;
  google_font?: boolean;
};

export type MobileDesignToken = {
  id?: string;
  category: string;
  name: string;
  value: string;
  description?: string | null;
};

export type MobileExportOptions = {
  name: string;
  colors: MobileColorToken[];
  fonts: MobileFontToken[];
  tokens?: MobileDesignToken[];
};

// ---------------------------------------------------------------------------
// Helpers & Sanitizers
// ---------------------------------------------------------------------------

export function cleanHex(raw: string, fallback = "#0A0A0A"): string {
  return cleanHexColor(raw, fallback).toUpperCase();
}

/**
 * Converts a hex code (#RRGGBB or #AARRGGBB) to a 32-bit ARGB hex string (0xFF...)
 * Used by Flutter (Dart) and Android Compose (Kotlin).
 */
export function toHex32ARGB(hex: string): string {
  if (!hex) return "0xFF0A0A0A";
  const raw = String(hex).trim().replace(/^#/, "");
  if (raw.length === 8 && /^[0-9a-fA-F]{8}$/.test(raw)) {
    const rr = raw.slice(0, 2);
    const gg = raw.slice(2, 4);
    const bb = raw.slice(4, 6);
    const aa = raw.slice(6, 8);
    return `0x${aa.toUpperCase()}${rr.toUpperCase()}${gg.toUpperCase()}${bb.toUpperCase()}`;
  }
  const clean = cleanHex(hex).replace("#", "");
  if (clean.length === 3) {
    const r = clean[0] + clean[0];
    const g = clean[1] + clean[1];
    const b = clean[2] + clean[2];
    return `0xFF${r.toUpperCase()}${g.toUpperCase()}${b.toUpperCase()}`;
  }
  const hex6 = clean.slice(0, 6).padEnd(6, "0");
  return `0xFF${hex6.toUpperCase()}`;
}

/**
 * Converts a hex string into normalized RGB floats (0.0 .. 1.0)
 * Used by SwiftUI Color(red:green:blue:).
 */
export function toRgbFloats(hex: string): { r: number; g: number; b: number } {
  const clean = cleanHex(hex).replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return {
    r: Number(r.toFixed(3)),
    g: Number(g.toFixed(3)),
    b: Number(b.toFixed(3)),
  };
}

export function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[a-z]/, (chr) => chr.toUpperCase());
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toSnakeCase(str: string): string {
  return (
    str
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .toLowerCase()
      .replace(/^_+|_+$/g, "") || "token"
  );
}

export function sanitizeIdentifier(str: string, fallback = "token"): string {
  const clean = str.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "");
  if (!clean || /^[0-9]/.test(clean)) {
    return `${fallback}_${clean}`;
  }
  return clean;
}

export function parseDimension(value: string | number, fallback = 0): number {
  if (typeof value === "number") return value;
  if (!value) return fallback;
  const trimmed = String(value).trim();
  if (/rem$/i.test(trimmed)) {
    const num = parseFloat(trimmed);
    return isNaN(num) ? fallback : Math.round(num * 16);
  }
  const num = parseFloat(trimmed);
  return isNaN(num) ? fallback : Math.round(num);
}

// ---------------------------------------------------------------------------
// Semantic Color Palette Resolution
// ---------------------------------------------------------------------------

export type ResolvedMobilePalette = {
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  accent: string;
  onAccent: string;
  muted: string;
  onMuted: string;
  border: string;
  error: string;
  onError: string;
  allColors: Array<{ name: string; hex: string; role?: string | null }>;
};

function isLight(hex: string): boolean {
  const { r, g, b } = toRgbFloats(hex);
  // ITU-R BT.709 relative luminance
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45;
}

export function resolveMobilePalette(colors: MobileColorToken[]): ResolvedMobilePalette {
  const findRole = (keywords: string[]): MobileColorToken | undefined => {
    return colors.find((c) => {
      const target = `${c.role ?? ""} ${c.name ?? ""}`.toLowerCase();
      return keywords.some((kw) => target.includes(kw));
    });
  };

  const primaryToken = findRole(["primary", "brand", "main"]) ??
    colors[0] ?? { hex: "#0A0A0A", role: "primary" };
  const primary = cleanHex(primaryToken.hex, "#0A0A0A");

  const secondaryToken = findRole(["secondary", "sub", "alt"]) ??
    colors.find((c) => cleanHex(c.hex) !== primary) ?? { hex: "#5F5A52", role: "secondary" };
  const secondary = cleanHex(secondaryToken.hex, "#5F5A52");

  const bgToken = findRole(["background", "bg", "canvas", "paper", "washi"]) ?? {
    hex: "#F4EFE6",
    role: "background",
  };
  const background = cleanHex(bgToken.hex, "#F4EFE6");

  const surfaceToken = findRole(["surface", "card", "panel"]) ?? bgToken;
  const surface = cleanHex(surfaceToken.hex, background);

  const fgToken = findRole(["foreground", "text", "ink", "body", "sumi"]) ?? {
    hex: isLight(background) ? "#0A0A0A" : "#F4EFE6",
    role: "foreground",
  };
  const onBackground = cleanHex(fgToken.hex, isLight(background) ? "#0A0A0A" : "#F4EFE6");
  const onSurface = onBackground;

  const accentToken = findRole(["accent", "cta", "highlight", "hanko"]) ?? primaryToken;
  const accent = cleanHex(accentToken.hex, primary);

  const mutedToken = findRole(["muted", "subtle", "gray", "neutral"]) ?? {
    hex: "#8A857B",
    role: "muted",
  };
  const muted = cleanHex(mutedToken.hex, "#8A857B");

  const borderToken = findRole(["border", "line", "rule", "divider"]) ?? {
    hex: isLight(background) ? "#E2DDD2" : "#2A2A2A",
    role: "border",
  };
  const border = cleanHex(borderToken.hex, "#E2DDD2");

  const errorToken = findRole(["error", "destructive", "danger", "alert"]) ?? {
    hex: "#8B1A1A",
    role: "error",
  };
  const error = cleanHex(errorToken.hex, "#8B1A1A");

  const allColors = colors.map((c, i) => ({
    name: c.name || c.role || `Color${i + 1}`,
    hex: cleanHex(c.hex),
    role: c.role,
  }));

  return {
    primary,
    onPrimary: isLight(primary) ? "#0A0A0A" : "#FFFFFF",
    secondary,
    onSecondary: isLight(secondary) ? "#0A0A0A" : "#FFFFFF",
    background,
    onBackground,
    surface,
    onSurface,
    accent,
    onAccent: isLight(accent) ? "#0A0A0A" : "#FFFFFF",
    muted,
    onMuted: isLight(muted) ? "#0A0A0A" : "#FFFFFF",
    border,
    error,
    onError: "#FFFFFF",
    allColors,
  };
}

export function getFontFamilies(fonts: MobileFontToken[]): {
  display: string;
  body: string;
  mono: string;
} {
  const displayFont = fonts.find((f) =>
    /display|heading|header|title/i.test(`${f.role ?? ""} ${f.family}`),
  ) ??
    fonts[0] ?? { family: "Cormorant Garamond" };

  const bodyFont = fonts.find((f) =>
    /body|text|sans|content/i.test(`${f.role ?? ""} ${f.family}`),
  ) ??
    fonts.find((f) => f.family !== displayFont.family) ??
    fonts[0] ?? { family: "Libre Baskerville" };

  const monoFont = fonts.find((f) => /mono|code|terminal/i.test(`${f.role ?? ""} ${f.family}`)) ??
    fonts.find((f) => /courier|fira|mono|source code|jet/i.test(f.family)) ?? {
      family: "Courier Prime",
    };

  return {
    display: displayFont.family.replace(/["\\]/g, "").trim(),
    body: bodyFont.family.replace(/["\\]/g, "").trim(),
    mono: monoFont.family.replace(/["\\]/g, "").trim(),
  };
}

// ---------------------------------------------------------------------------
// 1. Flutter (Dart) Generator
// ---------------------------------------------------------------------------

export function buildFlutterBrandTheme(options: MobileExportOptions): string {
  const p = resolveMobilePalette(options.colors);
  const fonts = getFontFamilies(options.fonts);
  const brandName = toPascalCase(options.name || "Brand");

  const rawColorConsts = p.allColors
    .map((c) => {
      const field = toCamelCase(c.name);
      return `  static const Color ${field} = Color(${toHex32ARGB(c.hex)});`;
    })
    .join("\n");

  const lines = [
    `// ===========================================================================`,
    `// ${options.name} Flutter Theme Package`,
    `// Generated by Brand Muse Mobile Token Generator`,
    `// ===========================================================================`,
    ``,
    `import 'package:flutter/material.dart';`,
    `import 'package:google_fonts/google_fonts.dart';`,
    ``,
    `/// Canonical Brand Colors mapped directly to 32-bit ARGB values.`,
    `class ${brandName}Colors {`,
    `  ${brandName}Colors._();`,
    ``,
    `  // Semantic Palette`,
    `  static const Color primary = Color(${toHex32ARGB(p.primary)});`,
    `  static const Color onPrimary = Color(${toHex32ARGB(p.onPrimary)});`,
    `  static const Color secondary = Color(${toHex32ARGB(p.secondary)});`,
    `  static const Color onSecondary = Color(${toHex32ARGB(p.onSecondary)});`,
    `  static const Color background = Color(${toHex32ARGB(p.background)});`,
    `  static const Color onBackground = Color(${toHex32ARGB(p.onBackground)});`,
    `  static const Color surface = Color(${toHex32ARGB(p.surface)});`,
    `  static const Color onSurface = Color(${toHex32ARGB(p.onSurface)});`,
    `  static const Color accent = Color(${toHex32ARGB(p.accent)});`,
    `  static const Color onAccent = Color(${toHex32ARGB(p.onAccent)});`,
    `  static const Color muted = Color(${toHex32ARGB(p.muted)});`,
    `  static const Color onMuted = Color(${toHex32ARGB(p.onMuted)});`,
    `  static const Color border = Color(${toHex32ARGB(p.border)});`,
    `  static const Color error = Color(${toHex32ARGB(p.error)});`,
    `  static const Color onError = Color(${toHex32ARGB(p.onError)});`,
    ``,
    `  // Raw Kit Palette`,
    rawColorConsts,
    `}`,
    ``,
    `/// GoogleFonts-backed TextTheme with strict typography hierarchy.`,
    `class ${brandName}TextTheme {`,
    `  ${brandName}TextTheme._();`,
    ``,
    `  static const String displayFont = '${fonts.display}';`,
    `  static const String bodyFont = '${fonts.body}';`,
    `  static const String monoFont = '${fonts.mono}';`,
    ``,
    `  static TextStyle getDisplay({`,
    `    double fontSize = 36,`,
    `    FontWeight fontWeight = FontWeight.w700,`,
    `    Color? color,`,
    `  }) {`,
    `    try {`,
    `      return GoogleFonts.getFont(`,
    `        displayFont,`,
    `        fontSize: fontSize,`,
    `        fontWeight: fontWeight,`,
    `        color: color ?? ${brandName}Colors.onBackground,`,
    `      );`,
    `    } catch (_) {`,
    `      return TextStyle(`,
    `        fontFamily: displayFont,`,
    `        fontSize: fontSize,`,
    `        fontWeight: fontWeight,`,
    `        color: color ?? ${brandName}Colors.onBackground,`,
    `      );`,
    `    }`,
    `  }`,
    ``,
    `  static TextStyle getBody({`,
    `    double fontSize = 16,`,
    `    FontWeight fontWeight = FontWeight.w400,`,
    `    Color? color,`,
    `  }) {`,
    `    try {`,
    `      return GoogleFonts.getFont(`,
    `        bodyFont,`,
    `        fontSize: fontSize,`,
    `        fontWeight: fontWeight,`,
    `        color: color ?? ${brandName}Colors.onBackground,`,
    `      );`,
    `    } catch (_) {`,
    `      return TextStyle(`,
    `        fontFamily: bodyFont,`,
    `        fontSize: fontSize,`,
    `        fontWeight: fontWeight,`,
    `        color: color ?? ${brandName}Colors.onBackground,`,
    `      );`,
    `    }`,
    `  }`,
    ``,
    `  static TextTheme get light {`,
    `    return TextTheme(`,
    `      displayLarge: getDisplay(fontSize: 48, fontWeight: FontWeight.w700),`,
    `      displayMedium: getDisplay(fontSize: 36, fontWeight: FontWeight.w700),`,
    `      displaySmall: getDisplay(fontSize: 28, fontWeight: FontWeight.w600),`,
    `      headlineLarge: getDisplay(fontSize: 24, fontWeight: FontWeight.w600),`,
    `      headlineMedium: getDisplay(fontSize: 20, fontWeight: FontWeight.w500),`,
    `      titleLarge: getBody(fontSize: 18, fontWeight: FontWeight.w600),`,
    `      bodyLarge: getBody(fontSize: 16, fontWeight: FontWeight.w400),`,
    `      bodyMedium: getBody(fontSize: 14, fontWeight: FontWeight.w400),`,
    `      labelLarge: getBody(fontSize: 14, fontWeight: FontWeight.w600),`,
    `      labelSmall: TextStyle(`,
    `        fontFamily: monoFont,`,
    `        fontSize: 11,`,
    `        fontWeight: FontWeight.w400,`,
    `        color: ${brandName}Colors.muted,`,
    `      ),`,
    `    );`,
    `  }`,
    `}`,
    ``,
    `/// Production Material 3 ThemeData with Brand Muse editorial defaults (0px radius).`,
    `class ${brandName}Theme {`,
    `  ${brandName}Theme._();`,
    ``,
    `  static const ColorScheme lightColorScheme = ColorScheme(`,
    `    brightness: Brightness.light,`,
    `    primary: ${brandName}Colors.primary,`,
    `    onPrimary: ${brandName}Colors.onPrimary,`,
    `    secondary: ${brandName}Colors.secondary,`,
    `    onSecondary: ${brandName}Colors.onSecondary,`,
    `    error: ${brandName}Colors.error,`,
    `    onError: ${brandName}Colors.onError,`,
    `    surface: ${brandName}Colors.surface,`,
    `    onSurface: ${brandName}Colors.onSurface,`,
    `    outline: ${brandName}Colors.border,`,
    `  );`,
    ``,
    `  static ThemeData get lightTheme {`,
    `    return ThemeData(`,
    `      useMaterial3: true,`,
    `      colorScheme: lightColorScheme,`,
    `      scaffoldBackgroundColor: ${brandName}Colors.background,`,
    `      textTheme: ${brandName}TextTheme.light,`,
    `      appBarTheme: AppBarTheme(`,
    `        backgroundColor: ${brandName}Colors.background,`,
    `        foregroundColor: ${brandName}Colors.onBackground,`,
    `        elevation: 0,`,
    `      ),`,
    `      cardTheme: CardTheme(`,
    `        color: ${brandName}Colors.surface,`,
    `        elevation: 0,`,
    `        shape: RoundedRectangleBorder(`,
    `          borderRadius: BorderRadius.zero,`,
    `          side: BorderSide(color: ${brandName}Colors.border, width: 1),`,
    `        ),`,
    `      ),`,
    `      elevatedButtonTheme: ElevatedButtonThemeData(`,
    `        style: ElevatedButton.styleFrom(`,
    `          backgroundColor: ${brandName}Colors.primary,`,
    `          foregroundColor: ${brandName}Colors.onPrimary,`,
    `          elevation: 0,`,
    `          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),`,
    `        ),`,
    `      ),`,
    `    );`,
    `  }`,
    `}`,
  ];

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 2. iOS (Swift / SwiftUI) Generator
// ---------------------------------------------------------------------------

export function buildSwiftBrandColors(options: MobileExportOptions): string {
  const p = resolveMobilePalette(options.colors);
  const fonts = getFontFamilies(options.fonts);
  const brandName = toPascalCase(options.name || "Brand");

  const rawColorProperties = p.allColors
    .map((c) => {
      const name = toCamelCase(c.name);
      return `        public static let ${name} = Color(hex: "${c.hex}")`;
    })
    .join("\n");

  const lines = [
    `// ===========================================================================`,
    `// ${options.name} Swift / SwiftUI Token Package`,
    `// Generated by Brand Muse Mobile Token Generator`,
    `// ===========================================================================`,
    ``,
    `import SwiftUI`,
    ``,
    `// MARK: - Color Hex Initializer`,
    ``,
    `public extension Color {`,
    `    init(hex: String) {`,
    `        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")`,
    `        var value: UInt64 = 0`,
    `        Scanner(string: clean).scanHexInt64(&value)`,
    `        let r, g, b, a: Double`,
    `        switch clean.count {`,
    `        case 3: // RGB (12-bit)`,
    `            r = Double((value >> 8) * 17) / 255.0`,
    `            g = Double((value >> 4 & 0xF) * 17) / 255.0`,
    `            b = Double((value & 0xF) * 17) / 255.0`,
    `            a = 1.0`,
    `        case 6: // RGB (24-bit)`,
    `            r = Double((value >> 16) & 0xFF) / 255.0`,
    `            g = Double((value >> 8) & 0xFF) / 255.0`,
    `            b = Double(value & 0xFF) / 255.0`,
    `            a = 1.0`,
    `        case 8: // ARGB (32-bit)`,
    `            r = Double((value >> 24) & 0xFF) / 255.0`,
    `            g = Double((value >> 16) & 0xFF) / 255.0`,
    `            b = Double((value >> 8) & 0xFF) / 255.0`,
    `            a = Double(value & 0xFF) / 255.0`,
    `        default:`,
    `            r = 0.0; g = 0.0; b = 0.0; a = 1.0`,
    `        }`,
    `        self.init(.sRGB, red: r, green: g, blue: b, opacity: a)`,
    `    }`,
    `}`,
    ``,
    `// MARK: - Semantic Brand Colors`,
    ``,
    `public extension Color {`,
    `    struct ${brandName} {`,
    `        public static let primary = Color(hex: "${p.primary}")`,
    `        public static let onPrimary = Color(hex: "${p.onPrimary}")`,
    `        public static let secondary = Color(hex: "${p.secondary}")`,
    `        public static let onSecondary = Color(hex: "${p.onSecondary}")`,
    `        public static let background = Color(hex: "${p.background}")`,
    `        public static let onBackground = Color(hex: "${p.onBackground}")`,
    `        public static let surface = Color(hex: "${p.surface}")`,
    `        public static let onSurface = Color(hex: "${p.onSurface}")`,
    `        public static let accent = Color(hex: "${p.accent}")`,
    `        public static let onAccent = Color(hex: "${p.onAccent}")`,
    `        public static let muted = Color(hex: "${p.muted}")`,
    `        public static let onMuted = Color(hex: "${p.onMuted}")`,
    `        public static let border = Color(hex: "${p.border}")`,
    `        public static let error = Color(hex: "${p.error}")`,
    `        public static let onError = Color(hex: "${p.onError}")`,
    ``,
    `        // Raw Palette`,
    rawColorProperties,
    `    }`,
    `}`,
    ``,
    `// MARK: - Brand Typography Hierarchy`,
    ``,
    `public struct ${brandName}Typography {`,
    `    public static let displayFontName = "${fonts.display}"`,
    `    public static let bodyFontName = "${fonts.body}"`,
    `    public static let monoFontName = "${fonts.mono}"`,
    ``,
    `    public static func displayLarge(size: CGFloat = 40, weight: Font.Weight = .bold) -> Font {`,
    `        Font.custom(displayFontName, size: size).weight(weight)`,
    `    }`,
    ``,
    `    public static func headline(size: CGFloat = 24, weight: Font.Weight = .semibold) -> Font {`,
    `        Font.custom(displayFontName, size: size).weight(weight)`,
    `    }`,
    ``,
    `    public static func body(size: CGFloat = 16, weight: Font.Weight = .regular) -> Font {`,
    `        Font.custom(bodyFontName, size: size).weight(weight)`,
    `    }`,
    ``,
    `    public static func caption(size: CGFloat = 12, weight: Font.Weight = .regular) -> Font {`,
    `        Font.custom(bodyFontName, size: size).weight(weight)`,
    `    }`,
    ``,
    `    public static func mono(size: CGFloat = 12, weight: Font.Weight = .regular) -> Font {`,
    `        Font.custom(monoFontName, size: size).weight(weight)`,
    `    }`,
    `}`,
    ``,
    `// MARK: - Convenient View Modifiers`,
    ``,
    `public extension View {`,
    `    func brandPaperBackground() -> some View {`,
    `        self.background(Color.${brandName}.background)`,
    `    }`,
    `}`,
  ];

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 3. Android (Kotlin / Jetpack Compose) Generators
// ---------------------------------------------------------------------------

export function buildComposeColor(options: MobileExportOptions): string {
  const p = resolveMobilePalette(options.colors);
  const brandName = toPascalCase(options.name || "Brand");

  const rawColorVals = p.allColors
    .map((c) => {
      const name = toPascalCase(c.name);
      return `val ${brandName}${name} = Color(${toHex32ARGB(c.hex)})`;
    })
    .join("\n");

  const lines = [
    `// ===========================================================================`,
    `// ${options.name} Jetpack Compose Colors (Material 3)`,
    `// Generated by Brand Muse Mobile Token Generator`,
    `// ===========================================================================`,
    ``,
    `package com.brandmuse.theme`,
    ``,
    `import androidx.compose.material3.darkColorScheme`,
    `import androidx.compose.material3.lightColorScheme`,
    `import androidx.compose.ui.graphics.Color`,
    ``,
    `// Semantic Color Values`,
    `val ${brandName}Primary = Color(${toHex32ARGB(p.primary)})`,
    `val ${brandName}OnPrimary = Color(${toHex32ARGB(p.onPrimary)})`,
    `val ${brandName}Secondary = Color(${toHex32ARGB(p.secondary)})`,
    `val ${brandName}OnSecondary = Color(${toHex32ARGB(p.onSecondary)})`,
    `val ${brandName}Background = Color(${toHex32ARGB(p.background)})`,
    `val ${brandName}OnBackground = Color(${toHex32ARGB(p.onBackground)})`,
    `val ${brandName}Surface = Color(${toHex32ARGB(p.surface)})`,
    `val ${brandName}OnSurface = Color(${toHex32ARGB(p.onSurface)})`,
    `val ${brandName}Accent = Color(${toHex32ARGB(p.accent)})`,
    `val ${brandName}OnAccent = Color(${toHex32ARGB(p.onAccent)})`,
    `val ${brandName}Muted = Color(${toHex32ARGB(p.muted)})`,
    `val ${brandName}OnMuted = Color(${toHex32ARGB(p.onMuted)})`,
    `val ${brandName}Border = Color(${toHex32ARGB(p.border)})`,
    `val ${brandName}Error = Color(${toHex32ARGB(p.error)})`,
    `val ${brandName}OnError = Color(${toHex32ARGB(p.onError)})`,
    ``,
    `// Raw Kit Palette`,
    rawColorVals,
    ``,
    `// Material 3 Light Color Scheme`,
    `val LightColorScheme = lightColorScheme(`,
    `    primary = ${brandName}Primary,`,
    `    onPrimary = ${brandName}OnPrimary,`,
    `    secondary = ${brandName}Secondary,`,
    `    onSecondary = ${brandName}OnSecondary,`,
    `    background = ${brandName}Background,`,
    `    onBackground = ${brandName}OnBackground,`,
    `    surface = ${brandName}Surface,`,
    `    onSurface = ${brandName}OnSurface,`,
    `    outline = ${brandName}Border,`,
    `    error = ${brandName}Error,`,
    `    onError = ${brandName}OnError`,
    `)`,
    ``,
    `// Material 3 Dark Color Scheme`,
    `val DarkColorScheme = darkColorScheme(`,
    `    primary = ${brandName}Primary,`,
    `    onPrimary = ${brandName}OnPrimary,`,
    `    secondary = ${brandName}Secondary,`,
    `    onSecondary = ${brandName}OnSecondary,`,
    `    background = Color(0xFF121212),`,
    `    onBackground = Color(0xFFF4EFE6),`,
    `    surface = Color(0xFF1E1E1E),`,
    `    onSurface = Color(0xFFF4EFE6),`,
    `    outline = Color(0xFF333333),`,
    `    error = ${brandName}Error,`,
    `    onError = ${brandName}OnError`,
    `)`,
  ];

  return lines.join("\n");
}

export function buildComposeType(options: MobileExportOptions): string {
  const fonts = getFontFamilies(options.fonts);
  const brandName = toPascalCase(options.name || "Brand");

  const lines = [
    `// ===========================================================================`,
    `// ${options.name} Jetpack Compose Typography (Material 3)`,
    `// Generated by Brand Muse Mobile Token Generator`,
    `// ===========================================================================`,
    ``,
    `package com.brandmuse.theme`,
    ``,
    `import androidx.compose.material3.Typography`,
    `import androidx.compose.ui.text.TextStyle`,
    `import androidx.compose.ui.text.font.FontFamily`,
    `import androidx.compose.ui.text.font.FontWeight`,
    `import androidx.compose.ui.unit.sp`,
    ``,
    `// Font Families (Place your .ttf / .otf in res/font/ or use Google Font provider)`,
    `val ${brandName}DisplayFont = FontFamily.Default // Configure FontFamily(Font(R.font.${toSnakeCase(fonts.display)}))`,
    `val ${brandName}BodyFont = FontFamily.Default // Configure FontFamily(Font(R.font.${toSnakeCase(fonts.body)}))`,
    `val ${brandName}MonoFont = FontFamily.Monospace`,
    ``,
    `// Material 3 Typography Scale`,
    `val ${brandName}Typography = Typography(`,
    `    displayLarge = TextStyle(`,
    `        fontFamily = ${brandName}DisplayFont,`,
    `        fontWeight = FontWeight.Bold,`,
    `        fontSize = 40.sp,`,
    `        lineHeight = 48.sp,`,
    `        letterSpacing = (-0.5).sp`,
    `    ),`,
    `    headlineMedium = TextStyle(`,
    `        fontFamily = ${brandName}DisplayFont,`,
    `        fontWeight = FontWeight.SemiBold,`,
    `        fontSize = 24.sp,`,
    `        lineHeight = 32.sp`,
    `    ),`,
    `    titleLarge = TextStyle(`,
    `        fontFamily = ${brandName}BodyFont,`,
    `        fontWeight = FontWeight.Medium,`,
    `        fontSize = 20.sp,`,
    `        lineHeight = 26.sp`,
    `    ),`,
    `    bodyLarge = TextStyle(`,
    `        fontFamily = ${brandName}BodyFont,`,
    `        fontWeight = FontWeight.Normal,`,
    `        fontSize = 16.sp,`,
    `        lineHeight = 24.sp`,
    `    ),`,
    `    bodyMedium = TextStyle(`,
    `        fontFamily = ${brandName}BodyFont,`,
    `        fontWeight = FontWeight.Normal,`,
    `        fontSize = 14.sp,`,
    `        lineHeight = 20.sp`,
    `    ),`,
    `    labelLarge = TextStyle(`,
    `        fontFamily = ${brandName}BodyFont,`,
    `        fontWeight = FontWeight.SemiBold,`,
    `        fontSize = 14.sp,`,
    `        lineHeight = 20.sp`,
    `    ),`,
    `    labelSmall = TextStyle(`,
    `        fontFamily = ${brandName}MonoFont,`,
    `        fontWeight = FontWeight.Normal,`,
    `        fontSize = 11.sp,`,
    `        lineHeight = 16.sp,`,
    `        letterSpacing = 0.5.sp`,
    `    )`,
    `)`,
  ];

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 4. React Native (StyleSheet & Tamagui) Generator
// ---------------------------------------------------------------------------

export function buildReactNativeBrandTokens(options: MobileExportOptions): string {
  const p = resolveMobilePalette(options.colors);
  const fonts = getFontFamilies(options.fonts);
  const brandName = toPascalCase(options.name || "Brand");

  // Spacing & Radii from design tokens or editorial defaults
  const spacingTokens = (options.tokens ?? []).filter((t) => t.category === "spacing");
  const spacingObj: Record<string, number> = {
    none: 0,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  };
  for (const st of spacingTokens) {
    const key = toCamelCase(st.name);
    spacingObj[key] = parseDimension(st.value, 16);
  }

  const radiusTokens = (options.tokens ?? []).filter((t) => t.category === "radius");
  const radiusObj: Record<string, number> = {
    none: 0,
    sm: 0, // 0px standard
    md: 0,
    lg: 0,
  };
  for (const rt of radiusTokens) {
    const key = toCamelCase(rt.name);
    radiusObj[key] = parseDimension(rt.value, 0);
  }

  const rawColorEntries = p.allColors
    .map((c) => `    ${toCamelCase(c.name)}: "${c.hex}",`)
    .join("\n");

  const lines = [
    `// ===========================================================================`,
    `// ${options.name} React Native & Tamagui Design Tokens`,
    `// Generated by Brand Muse Mobile Token Generator`,
    `// ===========================================================================`,
    ``,
    `import { StyleSheet } from "react-native";`,
    ``,
    `export const colors = {`,
    `  // Semantic Palette`,
    `  primary: "${p.primary}",`,
    `  onPrimary: "${p.onPrimary}",`,
    `  secondary: "${p.secondary}",`,
    `  onSecondary: "${p.onSecondary}",`,
    `  background: "${p.background}",`,
    `  onBackground: "${p.onBackground}",`,
    `  surface: "${p.surface}",`,
    `  onSurface: "${p.onSurface}",`,
    `  accent: "${p.accent}",`,
    `  onAccent: "${p.onAccent}",`,
    `  muted: "${p.muted}",`,
    `  onMuted: "${p.onMuted}",`,
    `  border: "${p.border}",`,
    `  error: "${p.error}",`,
    `  onError: "${p.onError}",`,
    ``,
    `  // Raw Palette`,
    rawColorEntries,
    `} as const;`,
    ``,
    `export type BrandColor = keyof typeof colors;`,
    ``,
    `export const spacing = ${JSON.stringify(spacingObj, null, 2)} as const;`,
    `export type BrandSpacing = keyof typeof spacing;`,
    ``,
    `export const radii = ${JSON.stringify(radiusObj, null, 2)} as const;`,
    `export type BrandRadius = keyof typeof radii;`,
    ``,
    `export const typography = {`,
    `  display: {`,
    `    fontFamily: "${fonts.display}",`,
    `    fontSize: 36,`,
    `    fontWeight: "700" as const,`,
    `    lineHeight: 44,`,
    `  },`,
    `  heading: {`,
    `    fontFamily: "${fonts.display}",`,
    `    fontSize: 24,`,
    `    fontWeight: "600" as const,`,
    `    lineHeight: 32,`,
    `  },`,
    `  body: {`,
    `    fontFamily: "${fonts.body}",`,
    `    fontSize: 16,`,
    `    fontWeight: "400" as const,`,
    `    lineHeight: 24,`,
    `  },`,
    `  caption: {`,
    `    fontFamily: "${fonts.body}",`,
    `    fontSize: 12,`,
    `    fontWeight: "400" as const,`,
    `    lineHeight: 16,`,
    `  },`,
    `  mono: {`,
    `    fontFamily: "${fonts.mono}",`,
    `    fontSize: 11,`,
    `    fontWeight: "400" as const,`,
    `    lineHeight: 16,`,
    `  },`,
    `} as const;`,
    ``,
    `/// React Native StyleSheet Pre-baked Styles`,
    `export const brandStyles = StyleSheet.create({`,
    `  container: {`,
    `    flex: 1,`,
    `    backgroundColor: colors.background,`,
    `  },`,
    `  card: {`,
    `    backgroundColor: colors.surface,`,
    `    borderColor: colors.border,`,
    `    borderWidth: 1,`,
    `    borderRadius: radii.none,`,
    `    padding: spacing.md,`,
    `  },`,
    `  buttonPrimary: {`,
    `    backgroundColor: colors.primary,`,
    `    borderRadius: radii.none,`,
    `    paddingVertical: spacing.sm,`,
    `    paddingHorizontal: spacing.md,`,
    `    alignItems: "center",`,
    `    justifyContent: "center",`,
    `  },`,
    `  buttonPrimaryText: {`,
    `    color: colors.onPrimary,`,
    `    fontFamily: typography.body.fontFamily,`,
    `    fontWeight: "600",`,
    `    fontSize: 14,`,
    `  },`,
    `});`,
    ``,
    `/// Tamagui Config Preset`,
    `export const ${brandName}TamaguiTokens = {`,
    `  color: colors,`,
    `  space: spacing,`,
    `  size: spacing,`,
    `  radius: radii,`,
    `  zIndex: { 0: 0, 1: 100, 2: 200, 3: 300 },`,
    `} as const;`,
    ``,
    `/// NativeWind / Tailwind Preset`,
    `export const nativeWindTheme = {`,
    `  theme: {`,
    `    extend: {`,
    `      colors,`,
    `      spacing,`,
    `      borderRadius: radii,`,
    `    },`,
    `  },`,
    `} as const;`,
  ];

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 5. Aggregate Native Token Package
// ---------------------------------------------------------------------------

export function buildNativeTokenPackage(options: MobileExportOptions): Record<string, string> {
  return {
    "native/BrandTheme.dart": buildFlutterBrandTheme(options),
    "native/BrandColors.swift": buildSwiftBrandColors(options),
    "native/Color.kt": buildComposeColor(options),
    "native/Type.kt": buildComposeType(options),
    "native/brandTokens.ts": buildReactNativeBrandTokens(options),
  };
}
