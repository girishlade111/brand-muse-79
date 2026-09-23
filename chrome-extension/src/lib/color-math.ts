// Color Science, Delta E (CIE76), and WCAG Contrast Auditor
import type { BrandColor } from "./types";

export interface ParsedRgba {
  r: number;
  g: number;
  b: number;
  a: number;
  hex: string;
}

export type LabColor = [number, number, number]; // [L*, a*, b*]

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  gray: "#808080",
  grey: "#808080",
  transparent: "rgba(0, 0, 0, 0)",
};

/**
 * Parses any CSS color string (hex, rgb, rgba, named) into an RGBA object.
 */
export function parseCssColor(raw: string): ParsedRgba | null {
  if (!raw) return null;
  const str = raw.trim().toLowerCase();

  if (NAMED_COLORS[str]) {
    return parseCssColor(NAMED_COLORS[str]);
  }

  // Hex: #rgb, #rgba, #rrggbb, #rrggbbaa
  if (str.startsWith("#")) {
    let h = str.slice(1);
    if (h.length === 3 || h.length === 4) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (h.length === 6) {
      const num = parseInt(h, 16);
      if (Number.isNaN(num)) return null;
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      return { r, g, b, a: 1, hex: `#${h.toLowerCase()}` };
    }
    if (h.length === 8) {
      const num = parseInt(h, 16);
      if (Number.isNaN(num)) return null;
      const r = (num >> 24) & 255;
      const g = (num >> 16) & 255;
      const b = (num >> 8) & 255;
      const a = (num & 255) / 255;
      return { r, g, b, a, hex: `#${h.slice(0, 6).toLowerCase()}` };
    }
    return null;
  }

  // rgb(...) or rgba(...)
  const rgbMatch = str.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgbMatch) {
    const r = Math.max(0, Math.min(255, Math.round(parseFloat(rgbMatch[1]))));
    const g = Math.max(0, Math.min(255, Math.round(parseFloat(rgbMatch[2]))));
    const b = Math.max(0, Math.min(255, Math.round(parseFloat(rgbMatch[3]))));
    const a = rgbMatch[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(rgbMatch[4]))) : 1;
    const hex = rgbToHex(r, g, b);
    return { r, g, b, a, hex };
  }

  return null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp(v).toString(16).padStart(2, "0"))
      .join("")
      .toLowerCase()
  );
}

/**
 * Convert 8-bit sRGB channel to linear light value.
 */
function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * Converts sRGB [0-255] to CIE L*a*b* under standard D65 illuminant (2° observer).
 */
export function rgbToLab(r: number, g: number, b: number): LabColor {
  const lr = srgbToLinear(r) * 100;
  const lg = srgbToLinear(g) * 100;
  const lb = srgbToLinear(b) * 100;

  // sRGB to XYZ (D65)
  const X = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const Y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175;
  const Z = lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041;

  // D65 reference white
  const Xn = 95.047;
  const Yn = 100.0;
  const Zn = 108.883;

  const f = (t: number) => {
    const delta = 6 / 29;
    return t > delta * delta * delta ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29;
  };

  const fx = f(X / Xn);
  const fy = f(Y / Yn);
  const fz = f(Z / Zn);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bVal = 200 * (fy - fz);

  return [L, a, bVal];
}

/**
 * Computes standard CIE76 Euclidean Delta E between two CIE Lab colors:
 * ΔE = sqrt((ΔL*)^2 + (Δa*)^2 + (Δb*)^2)
 */
export function deltaE76(lab1: LabColor, lab2: LabColor): number {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Computes Delta E between two hex color strings.
 */
export function deltaEBetweenHex(hex1: string, hex2: string): number {
  const c1 = parseCssColor(hex1);
  const c2 = parseCssColor(hex2);
  if (!c1 || !c2) return 100;
  const lab1 = rgbToLab(c1.r, c1.g, c1.b);
  const lab2 = rgbToLab(c2.r, c2.g, c2.b);
  return deltaE76(lab1, lab2);
}

export interface ClosestBrandColorResult {
  closest: BrandColor | null;
  deltaE: number;
  isOffBrand: boolean;
}

/**
 * Finds the closest brand color in the kit palette.
 * Returns closest color, deltaE, and whether it deviates by > 5.0.
 */
export function findClosestBrandColor(
  targetHex: string,
  brandPalette: BrandColor[],
  threshold = 5.0,
): ClosestBrandColorResult {
  if (!brandPalette || brandPalette.length === 0) {
    return { closest: null, deltaE: 0, isOffBrand: false };
  }

  const parsedTarget = parseCssColor(targetHex);
  if (!parsedTarget) {
    return { closest: null, deltaE: 100, isOffBrand: true };
  }

  const targetLab = rgbToLab(parsedTarget.r, parsedTarget.g, parsedTarget.b);

  let closest: BrandColor = brandPalette[0];
  let minDeltaE = Number.MAX_VALUE;

  for (const brandColor of brandPalette) {
    const parsedBrand = parseCssColor(brandColor.hex);
    if (!parsedBrand) continue;
    const brandLab = rgbToLab(parsedBrand.r, parsedBrand.g, parsedBrand.b);
    const dE = deltaE76(targetLab, brandLab);

    if (dE < minDeltaE) {
      minDeltaE = dE;
      closest = brandColor;
    }
  }

  return {
    closest,
    deltaE: Math.round(minDeltaE * 10) / 10,
    isOffBrand: minDeltaE > threshold,
  };
}

/**
 * Calculates WCAG relative luminance from 8-bit RGB components.
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/**
 * Calculates WCAG contrast ratio between foreground and background RGB colors.
 * Formula: (L1 + 0.05) / (L2 + 0.05)
 */
export function calculateContrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number },
): number {
  const l1 = relativeLuminance(fg.r, fg.g, fg.b);
  const l2 = relativeLuminance(bg.r, bg.g, bg.b);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (brighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100;
}

export interface WcagComplianceResult {
  compliant: boolean;
  requiredRatio: number;
  contrastRatio: number;
  isLargeText: boolean;
  level: "AA" | "AA-Large";
}

/**
 * Checks if a contrast ratio satisfies WCAG AA guidelines.
 * Normal text: 4.5:1
 * Large text (>= 24px or >= 18.66px bold): 3.0:1
 */
export function checkWcagCompliance(
  contrastRatio: number,
  fontSizePx: number,
  fontWeight: string | number,
): WcagComplianceResult {
  const isBold =
    fontWeight === "bold" ||
    fontWeight === "bolder" ||
    (typeof fontWeight === "number" && fontWeight >= 700) ||
    (typeof fontWeight === "string" && parseInt(fontWeight, 10) >= 700);

  const isLargeText = fontSizePx >= 24 || (fontSizePx >= 18.66 && isBold);
  const requiredRatio = isLargeText ? 3.0 : 4.5;
  const compliant = contrastRatio >= requiredRatio;

  return {
    compliant,
    requiredRatio,
    contrastRatio,
    isLargeText,
    level: isLargeText ? "AA-Large" : "AA",
  };
}

/**
 * Composites a semi-transparent foreground color over an opaque background color.
 */
export function compositeColor(
  fg: { r: number; g: number; b: number; a: number },
  bg: { r: number; g: number; b: number },
): { r: number; g: number; b: number } {
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
  };
}
