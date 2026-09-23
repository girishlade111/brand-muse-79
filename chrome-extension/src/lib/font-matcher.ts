// Font Family Normalizer and Brand Kit Matcher
import type { BrandFont } from "./types";

/**
 * Extracts the clean primary font family name from a CSS `font-family` declaration.
 * Example: '"Plus Jakarta Sans", -apple-system, sans-serif' -> 'Plus Jakarta Sans'
 */
export function extractPrimaryFontFamily(rawCssFontFamily: string): string {
  if (!rawCssFontFamily) return "inherit";

  // Take the first family name before the comma
  const parts = rawCssFontFamily.split(",");
  const first = parts[0]?.trim() || "";

  // Strip wrapping single or double quotes
  const clean = first.replace(/^["']+|["']+$/g, "").trim();

  // If CSS variable e.g. var(--font-sans, Inter), extract fallback or variable name
  if (clean.startsWith("var(")) {
    const varFallback = clean.match(/var\([^,]+,\s*([^)]+)\)/);
    if (varFallback?.[1]) {
      return varFallback[1].replace(/^["']+|["']+$/g, "").trim();
    }
    return clean;
  }

  return clean;
}

export interface FontMatchResult {
  isApproved: boolean;
  primaryFont: string;
  suggestedFont: BrandFont | null;
  suggestedRole?: string;
  isGenericFallback: boolean;
}

const GENERIC_SYSTEM_FALLBACKS = new Set([
  "sans-serif",
  "serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "helvetica neue",
  "arial",
]);

/**
 * Matches an extracted font family against approved Brand Kit fonts.
 */
export function checkFontApproval(
  fontFamilyCss: string,
  approvedBrandFonts: BrandFont[],
  elementRoleHint?: "heading" | "body" | "code",
): FontMatchResult {
  const primary = extractPrimaryFontFamily(fontFamilyCss);
  const normalizedPrimary = primary.toLowerCase();

  if (!approvedBrandFonts || approvedBrandFonts.length === 0) {
    return {
      isApproved: true,
      primaryFont: primary,
      suggestedFont: null,
      isGenericFallback: false,
    };
  }

  // Check if primary font matches any approved brand kit font
  for (const font of approvedBrandFonts) {
    const brandName = (font.family || "").trim().toLowerCase();
    if (
      brandName &&
      (normalizedPrimary === brandName ||
        normalizedPrimary.includes(brandName) ||
        brandName.includes(normalizedPrimary))
    ) {
      return {
        isApproved: true,
        primaryFont: primary,
        suggestedFont: font,
        suggestedRole: font.role || undefined,
        isGenericFallback: false,
      };
    }
  }

  const isGeneric = GENERIC_SYSTEM_FALLBACKS.has(normalizedPrimary);

  // Suggest best replacement based on element role hint (heading, body, code)
  let bestSuggestion: BrandFont = approvedBrandFonts[0];
  if (elementRoleHint === "heading") {
    const headingFont = approvedBrandFonts.find(
      (f) => f.role?.toLowerCase().includes("heading") || f.role?.toLowerCase().includes("display"),
    );
    if (headingFont) bestSuggestion = headingFont;
  } else if (elementRoleHint === "code") {
    const monoFont = approvedBrandFonts.find(
      (f) => f.role?.toLowerCase().includes("mono") || f.role?.toLowerCase().includes("code"),
    );
    if (monoFont) bestSuggestion = monoFont;
  } else {
    const bodyFont = approvedBrandFonts.find(
      (f) => f.role?.toLowerCase().includes("body") || f.role?.toLowerCase().includes("primary"),
    );
    if (bodyFont) bestSuggestion = bodyFont;
  }

  return {
    isApproved: false,
    primaryFont: primary,
    suggestedFont: bestSuggestion,
    suggestedRole: bestSuggestion?.role || "Primary",
    isGenericFallback: isGeneric,
  };
}
