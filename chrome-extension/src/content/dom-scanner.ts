// High-Performance DOM Scanner & Design QA Engine
import {
  parseCssColor,
  findClosestBrandColor,
  calculateContrastRatio,
  checkWcagCompliance,
  compositeColor,
  type ClosestBrandColorResult,
} from "../lib/color-math";
import { checkFontApproval, type FontMatchResult } from "../lib/font-matcher";
import { calculateComplianceScores } from "../lib/report";
import type { AuditSummary, AuditViolation, BrandKitData } from "../lib/types";

// Performance caches to avoid redundant math across repeated styles
const colorCheckCache = new Map<string, ClosestBrandColorResult>();
const fontCheckCache = new Map<string, FontMatchResult>();

export function clearScannerCaches(): void {
  colorCheckCache.clear;
  fontCheckCache.clear;
}

/**
 * Traverses parent elements to compute the composite background color under an element.
 */
export function resolveEffectiveBackground(element: HTMLElement): {
  r: number;
  g: number;
  b: number;
} {
  let curr: HTMLElement | null = element;
  let accumulatedBg = { r: 255, g: 255, b: 255 }; // Default fallback white

  const layers: Array<{ r: number; g: number; b: number; a: number }> = [];

  while (curr && curr !== document.documentElement) {
    try {
      const style = window.getComputedStyle(curr);
      const parsed = parseCssColor(style.backgroundColor);
      if (parsed && parsed.a > 0.01) {
        layers.push(parsed);
        // If layer is fully opaque, we have reached the base surface
        if (parsed.a >= 0.99) {
          break;
        }
      }
    } catch {
      break;
    }
    curr = curr.parentElement;
  }

  // Composite layers from bottom (opaque) to top
  for (let i = layers.length - 1; i >= 0; i--) {
    accumulatedBg = compositeColor(layers[i], accumulatedBg);
  }

  return accumulatedBg;
}

/**
 * Builds a clean, unique CSS selector for an element.
 */
export function getCleanSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const tag = el.tagName.toLowerCase();
  if (el.classList.length > 0) {
    const classList = Array.from(el.classList)
      .filter((c) => !c.startsWith("brand-muse-"))
      .slice(0, 2)
      .map((c) => `.${CSS.escape(c)}`)
      .join("");
    if (classList) return `${tag}${classList}`;
  }

  const parent = el.parentElement;
  if (!parent) return tag;
  const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
  if (siblings.length > 1) {
    const idx = siblings.indexOf(el) + 1;
    return `${tag}:nth-of-type(${idx})`;
  }

  return tag;
}

/**
 * Evaluates whether an element is visible and rendered in layout.
 */
function isRendered(el: HTMLElement): boolean {
  if (
    el.tagName === "SCRIPT" ||
    el.tagName === "STYLE" ||
    el.tagName === "NOSCRIPT" ||
    el.tagName === "TEMPLATE" ||
    el.tagName === "HEAD" ||
    el.tagName === "META" ||
    el.tagName === "LINK" ||
    el.tagName === "BR" ||
    el.tagName === "WBR"
  ) {
    return false;
  }

  // Ignore extension injected overlays
  if (el.id === "brand-muse-overlay-root" || el.closest("#brand-muse-overlay-root")) {
    return false;
  }

  // Hidden attribute or aria-hidden
  if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;

  const rects = el.getClientRects();
  if (rects.length === 0) return false;

  const style = window.getComputedStyle(el);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    parseFloat(style.opacity) === 0
  ) {
    return false;
  }

  return true;
}

/**
 * Fast check for off-brand color with caching.
 */
function checkColorWithCache(
  rawColor: string,
  brandPalette: BrandKitData["colors"],
  threshold = 5.0,
): ClosestBrandColorResult | null {
  const parsed = parseCssColor(rawColor);
  if (!parsed || parsed.a === 0) return null; // Transparent or invalid
  const hex = parsed.hex;

  // Ignore pure white / pure black if palette has neutrals or standard backgrounds
  if (colorCheckCache.has(hex)) {
    return colorCheckCache.get(hex)!;
  }

  const result = findClosestBrandColor(hex, brandPalette, threshold);
  colorCheckCache.set(hex, result);
  return result;
}

/**
 * Fast check for unapproved font with caching.
 */
function checkFontWithCache(
  fontFamily: string,
  approvedFonts: BrandKitData["fonts"],
  roleHint?: "heading" | "body" | "code",
): FontMatchResult {
  const cacheKey = `${fontFamily}|${roleHint || "body"}`;
  if (fontCheckCache.has(cacheKey)) {
    return fontCheckCache.get(cacheKey)!;
  }

  const result = checkFontApproval(fontFamily, approvedFonts, roleHint);
  fontCheckCache.set(cacheKey, result);
  return result;
}

/**
 * Scans the live document against a Brand Muse kit.
 */
export function scanDocument(kit: BrandKitData): AuditSummary {
  clearScannerCaches();

  const violations: AuditViolation[] = [];
  const elements = document.querySelectorAll<HTMLElement>("*");
  let scannedCount = 0;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!isRendered(el)) continue;
    scannedCount++;

    const style = window.getComputedStyle(el);
    const selector = getCleanSelector(el);
    const tag = el.tagName.toLowerCase();
    const rect = el.getBoundingClientRect();

    const boundingBox = {
      top: Math.round(rect.top + window.scrollY),
      left: Math.round(rect.left + window.scrollX),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };

    // 1. Text & Typography Check (if element contains direct text)
    const hasDirectText = Array.from(el.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim().length > 0,
    );

    if (hasDirectText) {
      // Check font family
      const isHeading = ["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag);
      const isCode = ["code", "pre", "kbd"].includes(tag);
      const roleHint = isHeading ? "heading" : isCode ? "code" : "body";

      const fontResult = checkFontWithCache(style.fontFamily, kit.fonts, roleHint);
      if (!fontResult.isApproved && !fontResult.isGenericFallback) {
        violations.push({
          id: `font-${i}`,
          type: "unapproved_font",
          selector,
          elementTag: tag,
          property: "font-family",
          actualValue: fontResult.primaryFont,
          suggestedReplacement: fontResult.suggestedFont?.family || "Primary Brand Font",
          suggestedRole: fontResult.suggestedRole,
          message: `Unapproved typography: "${fontResult.primaryFont}" is not in Brand Kit. Suggested replacement: "${fontResult.suggestedFont?.family || "Brand Font"}" (${fontResult.suggestedRole || "Body"})`,
          boundingBox,
        });
      }

      // Check text color (Delta E > 5.0)
      const textColorResult = checkColorWithCache(style.color, kit.colors, 5.0);
      if (textColorResult && textColorResult.isOffBrand && textColorResult.closest) {
        const parsedColor = parseCssColor(style.color);
        const actualHex = parsedColor?.hex || style.color;
        violations.push({
          id: `color-text-${i}`,
          type: "off_brand_color",
          selector,
          elementTag: tag,
          property: "color",
          actualValue: actualHex,
          suggestedReplacement: textColorResult.closest.hex,
          suggestedRole:
            textColorResult.closest.role || textColorResult.closest.name || "Brand Color",
          deltaE: textColorResult.deltaE,
          message: `Warning: ${actualHex} is not in Brand Palette (ΔE = ${textColorResult.deltaE}). Suggested replacement: ${textColorResult.closest.hex} (${textColorResult.closest.role || "Primary"})`,
          boundingBox,
        });
      }

      // Check WCAG Accessibility Contrast
      const parsedFg = parseCssColor(style.color);
      if (parsedFg && parsedFg.a > 0.1) {
        const effectiveBg = resolveEffectiveBackground(el);
        const contrast = calculateContrastRatio(parsedFg, effectiveBg);
        const fontSizePx = parseFloat(style.fontSize) || 16;
        const compliance = checkWcagCompliance(contrast, fontSizePx, style.fontWeight);

        if (!compliance.compliant) {
          violations.push({
            id: `contrast-${i}`,
            type: "wcag_contrast_failure",
            selector,
            elementTag: tag,
            property: "color",
            actualValue: `${contrast}:1`,
            suggestedReplacement: `${compliance.requiredRatio}:1 (WCAG ${compliance.level})`,
            contrastRatio: contrast,
            requiredContrast: compliance.requiredRatio,
            message: `Accessibility Contrast Failure: ${contrast}:1 fails WCAG ${compliance.level} minimum requirement of ${compliance.requiredRatio}:1.`,
            boundingBox,
          });
        }
      }
    }

    // 2. Background Color Check
    const parsedBg = parseCssColor(style.backgroundColor);
    if (parsedBg && parsedBg.a > 0.05 && rect.width > 10 && rect.height > 10) {
      const bgColorResult = checkColorWithCache(style.backgroundColor, kit.colors, 5.0);
      if (bgColorResult && bgColorResult.isOffBrand && bgColorResult.closest) {
        const actualHex = parsedBg.hex;
        violations.push({
          id: `color-bg-${i}`,
          type: "off_brand_color",
          selector,
          elementTag: tag,
          property: "background-color",
          actualValue: actualHex,
          suggestedReplacement: bgColorResult.closest.hex,
          suggestedRole: bgColorResult.closest.role || bgColorResult.closest.name || "Brand Color",
          deltaE: bgColorResult.deltaE,
          message: `Warning: ${actualHex} is not in Brand Palette (ΔE = ${bgColorResult.deltaE}). Suggested replacement: ${bgColorResult.closest.hex} (${bgColorResult.closest.role || "Background"})`,
          boundingBox,
        });
      }
    }

    // 3. Border Color Check
    const borderWidth = parseFloat(style.borderWidth) || 0;
    if (borderWidth > 0 && style.borderStyle !== "none") {
      const parsedBorder = parseCssColor(style.borderColor);
      if (parsedBorder && parsedBorder.a > 0.05) {
        const borderResult = checkColorWithCache(style.borderColor, kit.colors, 5.0);
        if (borderResult && borderResult.isOffBrand && borderResult.closest) {
          const actualHex = parsedBorder.hex;
          violations.push({
            id: `color-border-${i}`,
            type: "off_brand_color",
            selector,
            elementTag: tag,
            property: "border-color",
            actualValue: actualHex,
            suggestedReplacement: borderResult.closest.hex,
            suggestedRole: borderResult.closest.role || borderResult.closest.name || "Border Color",
            deltaE: borderResult.deltaE,
            message: `Warning: ${actualHex} is not in Brand Palette (ΔE = ${borderResult.deltaE}). Suggested replacement: ${borderResult.closest.hex} (${borderResult.closest.role || "Border"})`,
            boundingBox,
          });
        }
      }
    }

    // 4. SVG Fill & Stroke Check
    if (tag === "svg" || tag === "path" || tag === "circle" || tag === "rect") {
      const fill = style.fill || el.getAttribute("fill");
      if (fill && fill !== "none" && fill !== "currentColor") {
        const fillResult = checkColorWithCache(fill, kit.colors, 5.0);
        if (fillResult && fillResult.isOffBrand && fillResult.closest) {
          const parsedFill = parseCssColor(fill);
          const actualHex = parsedFill?.hex || fill;
          violations.push({
            id: `color-svg-fill-${i}`,
            type: "off_brand_color",
            selector,
            elementTag: tag,
            property: "fill",
            actualValue: actualHex,
            suggestedReplacement: fillResult.closest.hex,
            suggestedRole: fillResult.closest.role || fillResult.closest.name || "Accent",
            deltaE: fillResult.deltaE,
            message: `Warning: SVG fill ${actualHex} is not in Brand Palette (ΔE = ${fillResult.deltaE}). Suggested replacement: ${fillResult.closest.hex}`,
            boundingBox,
          });
        }
      }
    }
  }

  const scores = calculateComplianceScores(scannedCount, violations);

  return {
    url: window.location.href,
    title: document.title || "Target Website",
    kitId: kit.id,
    kitName: kit.name,
    scannedAt: new Date().toISOString(),
    totalElementsScanned: scannedCount,
    totalViolations: violations.length,
    offBrandColorCount: violations.filter((v) => v.type === "off_brand_color").length,
    unapprovedFontCount: violations.filter((v) => v.type === "unapproved_font").length,
    contrastFailureCount: violations.filter((v) => v.type === "wcag_contrast_failure").length,
    overallScore: scores.overallScore,
    colorScore: scores.colorScore,
    typographyScore: scores.typographyScore,
    contrastScore: scores.contrastScore,
    violations,
  };
}
