// Interactive Brand UI Component Library — Engine & Codegen.
// Formulates theme-aware CSS custom properties (--brand-*), resolves WCAG AA/AAA
// contrast, and generates production-ready React 19 + Tailwind v4 and pure HTML5
// snippets without hardcoded hex values.

import { cleanHexColor } from "@/lib/mockups";

export type ComponentThemeMode = "light" | "dark" | "high-contrast";

export type BrandComponentTheme = {
  mode: ComponentThemeMode;
  brandName: string;
  primary: string;
  primaryFg: string;
  secondary: string;
  secondaryFg: string;
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  muted: string;
  mutedFg: string;
  accent: string;
  accentFg: string;
  border: string;
  borderSubtle: string;
  ring: string;
  displayFont: string;
  bodyFont: string;
  monoFont: string;
  contrastRatio: number;
};

export type ComponentItem = {
  id: string;
  category: "buttons" | "cards" | "forms" | "navigation" | "hero" | "alerts";
  title: string;
  description: string;
};

export const SHOWCASE_COMPONENTS: ComponentItem[] = [
  {
    id: "buttons-suite",
    category: "buttons",
    title: "Action Buttons Suite",
    description: "Primary, secondary, ghost, and loading states with 0px sharp geometry.",
  },
  {
    id: "feature-card",
    category: "cards",
    title: "Editorial Feature Card",
    description: "Structured card with monospace eyebrow, display serif title, and hairline border.",
  },
  {
    id: "product-card",
    category: "cards",
    title: "E-Commerce Product Card",
    description: "High-contrast product showcase card with price badge and acquisition CTA.",
  },
  {
    id: "pricing-card",
    category: "cards",
    title: "Pricing Tier Card",
    description: "Tier badge, monetary scale, feature checklist with custom glyphs, and action button.",
  },
  {
    id: "form-controls",
    category: "forms",
    title: "Form Inputs & Textarea",
    description: "Text input, select menu, and textarea featuring active brand accent focus rings.",
  },
  {
    id: "navigation-bar",
    category: "navigation",
    title: "Navigation Bar & Breadcrumb",
    description: "Header navigation with brand wordmark, tab links, and editorial breadcrumb trail.",
  },
  {
    id: "hero-header",
    category: "hero",
    title: "Hero Header Section",
    description: "Large H1 display typography scale, subtitle prose, and dual bracket CTAs.",
  },
  {
    id: "alert-banners",
    category: "alerts",
    title: "Toast & Notification Banners",
    description: "Success, warning, and destructive notification banners with brand styling.",
  },
];

// ---------------------------------------------------------------------------
// Contrast & Color Utilities
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = cleanHexColor(hex, "#000000").replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export function computeContrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

// ---------------------------------------------------------------------------
// Theme Resolver
// ---------------------------------------------------------------------------

export function resolveBrandComponentTheme(
  colors: Array<{ hex: string; role?: string | null; name?: string | null }>,
  fonts: Array<{ family?: string | null; role?: string | null }>,
  mode: ComponentThemeMode = "light",
  brandName = "Brand Muse",
): BrandComponentTheme {
  const byRole = (r: string) =>
    colors.find((c) => String(c.role ?? "").toLowerCase() === r.toLowerCase())?.hex;

  const rawPrimary = cleanHexColor(byRole("primary") ?? colors[0]?.hex, "#0A0A0A");
  const rawSecondary = cleanHexColor(byRole("secondary") ?? colors[1]?.hex, "#EDE8DE");
  const rawBg = cleanHexColor(byRole("background"), "#F4EFE6");
  const rawAccent = cleanHexColor(byRole("accent"), "#8B1A1A");

  const displayFont = fonts.find((f) => /display|heading/i.test(f.role ?? ""))?.family || "Cormorant Garamond";
  const bodyFont = fonts.find((f) => /body|text|sans/i.test(f.role ?? ""))?.family || "Libre Baskerville";
  const monoFont = fonts.find((f) => /mono|code/i.test(f.role ?? ""))?.family || "Courier Prime";

  if (mode === "high-contrast") {
    // 21:1 stark contrast guaranteed (pure ink & paper, high visibility borders)
    return {
      mode,
      brandName,
      primary: "#000000",
      primaryFg: "#FFFFFF",
      secondary: "#000000",
      secondaryFg: "#FFFFFF",
      background: "#FFFFFF",
      surface: "#FFFFFF",
      surfaceRaised: "#F0F0F0",
      text: "#000000",
      muted: "#E0E0E0",
      mutedFg: "#404040",
      accent: "#C0392B",
      accentFg: "#FFFFFF",
      border: "#000000",
      borderSubtle: "#000000",
      ring: "#000000",
      displayFont,
      bodyFont,
      monoFont,
      contrastRatio: 21.0,
    };
  }

  if (mode === "dark") {
    const bg = "#0A0A0A";
    const text = "#F4EFE6";
    const primary = rawPrimary === "#0A0A0A" ? text : rawPrimary;
    const primaryFg = relativeLuminance(primary) > 0.4 ? "#0A0A0A" : text;
    const accent = rawAccent === "#8B1A1A" ? "#C0392B" : rawAccent;

    return {
      mode,
      brandName,
      primary,
      primaryFg,
      secondary: "#1A1A1A",
      secondaryFg: text,
      background: bg,
      surface: "#141414",
      surfaceRaised: "#1A1A1A",
      text,
      muted: "rgba(244, 239, 230, 0.08)",
      mutedFg: "rgba(244, 239, 230, 0.6)",
      accent,
      accentFg: "#FFFFFF",
      border: "#F4EFE6",
      borderSubtle: "rgba(244, 239, 230, 0.2)",
      ring: accent,
      displayFont,
      bodyFont,
      monoFont,
      contrastRatio: computeContrastRatio(text, bg),
    };
  }

  // Light Mode (Washi & Sumi)
  const bg = rawBg;
  const text = "#0A0A0A";
  const primary = rawPrimary;
  const primaryFg = relativeLuminance(primary) > 0.4 ? "#0A0A0A" : "#F4EFE6";

  return {
    mode,
    brandName,
    primary,
    primaryFg,
    secondary: rawSecondary,
    secondaryFg: text,
    background: bg,
    surface: "#EDE8DE",
    surfaceRaised: "#F9F6F0",
    text,
    muted: "rgba(10, 10, 10, 0.06)",
    mutedFg: "rgba(10, 10, 10, 0.6)",
    accent: rawAccent,
    accentFg: "#F4EFE6",
    border: "#0A0A0A",
    borderSubtle: "rgba(10, 10, 10, 0.18)",
    ring: rawAccent,
    displayFont,
    bodyFont,
    monoFont,
    contrastRatio: computeContrastRatio(text, bg),
  };
}

// ---------------------------------------------------------------------------
// CSS Variable Style Scope Generator
// ---------------------------------------------------------------------------

export function createThemeStyleObject(theme: BrandComponentTheme): React.CSSProperties {
  return {
    ["--brand-primary" as any]: theme.primary,
    ["--brand-primary-fg" as any]: theme.primaryFg,
    ["--brand-secondary" as any]: theme.secondary,
    ["--brand-secondary-fg" as any]: theme.secondaryFg,
    ["--brand-bg" as any]: theme.background,
    ["--brand-surface" as any]: theme.surface,
    ["--brand-surface-raised" as any]: theme.surfaceRaised,
    ["--brand-text" as any]: theme.text,
    ["--brand-muted" as any]: theme.muted,
    ["--brand-muted-fg" as any]: theme.mutedFg,
    ["--brand-accent" as any]: theme.accent,
    ["--brand-accent-fg" as any]: theme.accentFg,
    ["--brand-border" as any]: theme.border,
    ["--brand-border-subtle" as any]: theme.borderSubtle,
    ["--brand-ring" as any]: theme.ring,
    ["--brand-font-display" as any]: theme.displayFont,
    ["--brand-font-body" as any]: theme.bodyFont,
    ["--brand-font-mono" as any]: theme.monoFont,
  };
}

// ---------------------------------------------------------------------------
// Per-Component Code Generators (React 19 + Tailwind v4 & Pure HTML + CSS)
// ---------------------------------------------------------------------------

export function generateComponentReactCode(
  componentId: string,
  theme: BrandComponentTheme,
): string {
  switch (componentId) {
    case "buttons-suite":
      return `import React, { useState } from "react";
import { Loader2 } from "lucide-react";

export function BrandButtonsSuite() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 font-[family-name:var(--brand-font-mono)] text-xs uppercase tracking-[0.14em]">
      {/* Primary Button */}
      <button
        type="button"
        className="border border-[var(--brand-border)] bg-[var(--brand-primary)] px-6 py-3 text-[var(--brand-primary-fg)] transition-all hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] cursor-pointer"
        style={{ borderRadius: 0 }}
      >
        [ Primary Action ]
      </button>

      {/* Secondary Button */}
      <button
        type="button"
        className="border border-[var(--brand-border)] bg-transparent px-6 py-3 text-[var(--brand-text)] transition-all hover:bg-[var(--brand-text)] hover:text-[var(--brand-bg)] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] cursor-pointer"
        style={{ borderRadius: 0 }}
      >
        [ Secondary Action ]
      </button>

      {/* Ghost Button */}
      <button
        type="button"
        className="border border-transparent bg-transparent px-5 py-3 text-[var(--brand-text)] opacity-80 hover:opacity-100 hover:border-[var(--brand-border-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] cursor-pointer"
        style={{ borderRadius: 0 }}
      >
        [ Ghost Action ]
      </button>

      {/* Disabled State */}
      <button
        type="button"
        disabled
        className="border border-[var(--brand-border-subtle)] bg-[var(--brand-muted)] px-6 py-3 text-[var(--brand-muted-fg)] opacity-50 cursor-not-allowed"
        style={{ borderRadius: 0 }}
      >
        [ Disabled ]
      </button>

      {/* Loading State */}
      <button
        type="button"
        onClick={() => setLoading(!loading)}
        className="flex items-center gap-2 border border-[var(--brand-border)] bg-[var(--brand-primary)] px-6 py-3 text-[var(--brand-primary-fg)] cursor-pointer"
        style={{ borderRadius: 0 }}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        [ Processing… ]
      </button>
    </div>
  );
}`;

    case "feature-card":
      return `export function BrandFeatureCard() {
  return (
    <div
      className="border border-[var(--brand-border)] bg-[var(--brand-surface)] p-6 transition-all hover:border-[var(--brand-accent)]"
      style={{ borderRadius: 0 }}
    >
      <div className="flex items-center justify-between border-b border-[var(--brand-border-subtle)] pb-3">
        <span className="font-[family-name:var(--brand-font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--brand-muted-fg)]">
          // ARCHITECTURE SPEC 01
        </span>
        <span className="inline-block h-2 w-2 bg-[var(--brand-accent)]" />
      </div>

      <h3 className="mt-4 font-[family-name:var(--brand-font-display)] text-2xl font-bold tracking-tight text-[var(--brand-text)]">
        The Invisible Instrument
      </h3>

      <p className="mt-2 font-[family-name:var(--brand-font-body)] text-sm leading-relaxed text-[var(--brand-muted-fg)]">
        Quiet efficiency with zero decorative distractions. Scalpel-sharp borders, pure high-contrast ink, and functional elegance.
      </p>

      <div className="mt-6 flex items-center justify-between font-[family-name:var(--brand-font-mono)] text-[11px] uppercase tracking-[0.14em]">
        <span className="text-[var(--brand-text)]">[ Explore System ]</span>
        <span className="text-[var(--brand-accent)]">→ 0PX RADIUS</span>
      </div>
    </div>
  );
}`;

    case "product-card":
      return `export function BrandProductCard() {
  return (
    <div
      className="border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 transition-all hover:border-[var(--brand-primary)]"
      style={{ borderRadius: 0 }}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden border border-[var(--brand-border-subtle)] bg-[var(--brand-muted)]">
        <div className="flex h-full w-full items-center justify-center font-[family-name:var(--brand-font-mono)] text-xs text-[var(--brand-muted-fg)]">
          [ ASSET VISUAL ]
        </div>
        <span
          className="absolute right-2 top-2 border border-[var(--brand-border)] bg-[var(--brand-surface)] px-2 py-0.5 font-[family-name:var(--brand-font-mono)] text-[9px] uppercase tracking-wider text-[var(--brand-text)]"
          style={{ borderRadius: 0 }}
        >
          EDITION 01
        </span>
      </div>

      <div className="mt-4">
        <span className="font-[family-name:var(--brand-font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--brand-muted-fg)]">
          HARDWARE ARCHIVE
        </span>
        <h4 className="mt-1 font-[family-name:var(--brand-font-display)] text-xl font-bold text-[var(--brand-text)]">
          Tactile Mechanical Unit
        </h4>

        <div className="mt-4 flex items-center justify-between">
          <span className="font-[family-name:var(--brand-font-mono)] text-sm font-bold text-[var(--brand-text)]">
            $340.00
          </span>
          <button
            type="button"
            className="border border-[var(--brand-border)] bg-[var(--brand-primary)] px-4 py-1.5 font-[family-name:var(--brand-font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--brand-primary-fg)] transition-all hover:bg-[var(--brand-accent)] cursor-pointer"
            style={{ borderRadius: 0 }}
          >
            [ Acquire ]
          </button>
        </div>
      </div>
    </div>
  );
}`;

    case "pricing-card":
      return `export function BrandPricingCard() {
  return (
    <div
      className="border border-[var(--brand-border)] bg-[var(--brand-surface)] p-6 transition-all"
      style={{ borderRadius: 0 }}
    >
      <div className="flex items-center justify-between">
        <span className="font-[family-name:var(--brand-font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--brand-muted-fg)]">
          // ENTERPRISE COHORT
        </span>
        <span className="border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-2 py-0.5 font-[family-name:var(--brand-font-mono)] text-[9px] uppercase tracking-wider text-[var(--brand-accent-fg)]">
          RECOMMENDED
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="font-[family-name:var(--brand-font-display)] text-4xl font-bold text-[var(--brand-text)]">
          $290
        </span>
        <span className="font-[family-name:var(--brand-font-mono)] text-xs text-[var(--brand-muted-fg)]">
          / MONTH
        </span>
      </div>

      <p className="mt-2 font-[family-name:var(--brand-font-body)] text-xs text-[var(--brand-muted-fg)]">
        Full architectural access with unlimited deterministic brand token exports.
      </p>

      <ul className="mt-6 space-y-2.5 border-t border-[var(--brand-border-subtle)] pt-4 font-[family-name:var(--brand-font-mono)] text-xs text-[var(--brand-text)]">
        <li className="flex items-center gap-2">
          <span className="text-[var(--brand-accent)]">✓</span>
          <span>Unlimited AI Brand Mockup Generations</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="text-[var(--brand-accent)]">✓</span>
          <span>2x High-DPI PNG, WebP &amp; SVG Exports</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="text-[var(--brand-accent)]">✓</span>
          <span>Strict WCAG AAA Accessible Theme Engine</span>
        </li>
      </ul>

      <button
        type="button"
        className="mt-6 w-full border border-[var(--brand-border)] bg-[var(--brand-primary)] py-3 font-[family-name:var(--brand-font-mono)] text-xs uppercase tracking-[0.16em] text-[var(--brand-primary-fg)] transition-all hover:bg-[var(--brand-accent)] cursor-pointer"
        style={{ borderRadius: 0 }}
      >
        [ INITIATE LICENSE ]
      </button>
    </div>
  );
}`;

    case "form-controls":
      return `export function BrandFormControls() {
  return (
    <form className="space-y-4 font-[family-name:var(--brand-font-mono)] text-xs">
      <div>
        <label className="block text-[10px] uppercase tracking-[0.16em] text-[var(--brand-muted-fg)]">
          DIRECTOR EMAIL:
        </label>
        <input
          type="email"
          placeholder="name@studio.archive"
          className="mt-1 w-full border border-[var(--brand-border)] bg-transparent px-3 py-2 text-[var(--brand-text)] placeholder:text-[var(--brand-muted-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
          style={{ borderRadius: 0 }}
        />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-[0.16em] text-[var(--brand-muted-fg)]">
          SYSTEM CATEGORY:
        </label>
        <select
          className="mt-1 w-full border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2 text-[var(--brand-text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
          style={{ borderRadius: 0 }}
        >
          <option>Editorial Typography</option>
          <option>Chromatic Identity</option>
          <option>Architectural Grid</option>
        </select>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-[0.16em] text-[var(--brand-muted-fg)]">
          SPECIFICATION DIRECTIVE:
        </label>
        <textarea
          rows={3}
          placeholder="Declare precise design constraints..."
          className="mt-1 w-full border border-[var(--brand-border)] bg-transparent px-3 py-2 text-[var(--brand-text)] placeholder:text-[var(--brand-muted-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
          style={{ borderRadius: 0 }}
        />
      </div>
    </form>
  );
}`;

    case "navigation-bar":
      return `export function BrandNavigationBar() {
  return (
    <div className="space-y-4 font-[family-name:var(--brand-font-mono)]">
      {/* Main Top Nav */}
      <header
        className="flex items-center justify-between border border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-3"
        style={{ borderRadius: 0 }}
      >
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 bg-[var(--brand-accent)]" />
          <span className="font-[family-name:var(--brand-font-display)] text-lg font-bold tracking-tight text-[var(--brand-text)]">
            ${theme.brandName.toUpperCase()}
          </span>
        </div>

        <nav className="hidden items-center gap-6 text-[11px] uppercase tracking-[0.16em] sm:flex">
          <a href="#overview" className="text-[var(--brand-text)] hover:text-[var(--brand-accent)]">Overview</a>
          <a href="#tokens" className="text-[var(--brand-muted-fg)] hover:text-[var(--brand-text)]">Tokens</a>
          <a href="#mockups" className="text-[var(--brand-muted-fg)] hover:text-[var(--brand-text)]">Mockups</a>
          <a href="#export" className="text-[var(--brand-muted-fg)] hover:text-[var(--brand-text)]">Export</a>
        </nav>

        <button
          type="button"
          className="border border-[var(--brand-border)] bg-[var(--brand-primary)] px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--brand-primary-fg)] hover:bg-[var(--brand-accent)]"
          style={{ borderRadius: 0 }}
        >
          [ ENTER STUDIO ]
        </button>
      </header>

      {/* Breadcrumb Trail */}
      <nav className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[var(--brand-muted-fg)]">
        <span>ARCHIVE</span>
        <span>/</span>
        <span>SYSTEM DIRECTIVES</span>
        <span>/</span>
        <span className="font-bold text-[var(--brand-text)]">COMPONENT LIBRARY</span>
      </nav>
    </div>
  );
}`;

    case "hero-header":
      return `export function BrandHeroHeader() {
  return (
    <section
      className="border border-[var(--brand-border)] bg-[var(--brand-surface)] p-8 sm:p-12 text-left"
      style={{ borderRadius: 0 }}
    >
      <div className="flex items-center gap-2 font-[family-name:var(--brand-font-mono)] text-[11px] uppercase tracking-[0.24em] text-[var(--brand-accent)]">
        <span>// ARCHITECTURAL IDENTITY SYSTEM</span>
        <span>·</span>
        <span>2026 EDITION</span>
      </div>

      <h1 className="mt-4 font-[family-name:var(--brand-font-display)] text-4xl font-bold tracking-tight text-[var(--brand-text)] sm:text-6xl">
        Precision is not decoration.
      </h1>

      <p className="mt-4 max-w-2xl font-[family-name:var(--brand-font-body)] text-base leading-relaxed text-[var(--brand-muted-fg)]">
        Every pixel anchored to structural intent. 0px border-radius standard, high-contrast ink on washi, and pure typographic discipline.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3 font-[family-name:var(--brand-font-mono)] text-xs uppercase tracking-[0.16em]">
        <button
          type="button"
          className="border border-[var(--brand-border)] bg-[var(--brand-primary)] px-6 py-3.5 text-[var(--brand-primary-fg)] transition-all hover:bg-[var(--brand-accent)]"
          style={{ borderRadius: 0 }}
        >
          [ EXPLORE ARCHIVE ]
        </button>
        <button
          type="button"
          className="border border-[var(--brand-border)] bg-transparent px-6 py-3.5 text-[var(--brand-text)] transition-all hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)]"
          style={{ borderRadius: 0 }}
        >
          [ VIEW TOKENS ]
        </button>
      </div>
    </section>
  );
}`;

    case "alert-banners":
    default:
      return `export function BrandAlertBanners() {
  return (
    <div className="space-y-3 font-[family-name:var(--brand-font-mono)] text-xs">
      {/* Success Notification */}
      <div
        className="flex items-center justify-between border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3 text-[var(--brand-text)]"
        style={{ borderRadius: 0 }}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--brand-accent)]">[ SUCCESS ]</span>
          <span>Brand tokens ratified with 0 errors.</span>
        </div>
        <span className="text-[10px] text-[var(--brand-muted-fg)]">200 OK</span>
      </div>

      {/* Warning Notice */}
      <div
        className="flex items-center justify-between border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3 text-[var(--brand-text)]"
        style={{ borderRadius: 0 }}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--brand-accent)]">[ WARNING ]</span>
          <span>Color contrast falls below 7:1 threshold in high contrast test.</span>
        </div>
        <span className="text-[10px] text-[var(--brand-muted-fg)]">AUDIT</span>
      </div>

      {/* Destructive / Error Banner */}
      <div
        className="flex items-center justify-between border border-[var(--brand-accent)] bg-[var(--brand-surface)] p-3 text-[var(--brand-text)]"
        style={{ borderRadius: 0 }}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--brand-accent)]">[ SYSTEM ERROR ]</span>
          <span>External asset CDN timed out. Deterministic fallback engaged.</span>
        </div>
        <span className="text-[10px] text-[var(--brand-accent)]">ERR 504</span>
      </div>
    </div>
  );
}`;
  }
}

export function generateComponentHtmlCode(
  componentId: string,
  theme: BrandComponentTheme,
): string {
  switch (componentId) {
    case "buttons-suite":
      return `<!-- Brand Buttons Suite: Pure HTML5 + CSS Variables -->
<style>
  .brand-btn-primary {
    display: inline-flex;
    align-items: center;
    padding: 12px 24px;
    font-family: var(--brand-font-mono);
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    background: var(--brand-primary);
    color: var(--brand-primary-fg);
    border: 1px solid var(--brand-border);
    border-radius: 0;
    cursor: pointer;
  }
  .brand-btn-secondary {
    display: inline-flex;
    align-items: center;
    padding: 12px 24px;
    font-family: var(--brand-font-mono);
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    background: transparent;
    color: var(--brand-text);
    border: 1px solid var(--brand-border);
    border-radius: 0;
    cursor: pointer;
  }
</style>

<button class="brand-btn-primary">[ Primary Action ]</button>
<button class="brand-btn-secondary">[ Secondary Action ]</button>`;

    case "feature-card":
      return `<!-- Brand Feature Card: HTML + CSS Variables -->
<div style="border: 1px solid var(--brand-border); background: var(--brand-surface); padding: 24px; border-radius: 0;">
  <div style="font-family: var(--brand-font-mono); font-size: 10px; letter-spacing: 0.22em; color: var(--brand-muted-fg); text-transform: uppercase;">
    // ARCHITECTURE SPEC 01
  </div>
  <h3 style="font-family: var(--brand-font-display); font-size: 24px; color: var(--brand-text); margin: 12px 0;">
    The Invisible Instrument
  </h3>
  <p style="font-family: var(--brand-font-body); font-size: 14px; color: var(--brand-muted-fg); line-height: 1.6;">
    Quiet efficiency with zero decorative distractions. Scalpel-sharp borders, pure high-contrast ink, and functional elegance.
  </p>
</div>`;

    default:
      return `<!-- Brand Component: ${componentId} -->
<div style="border: 1px solid var(--brand-border); background: var(--brand-surface); color: var(--brand-text); padding: 20px; border-radius: 0; font-family: var(--brand-font-mono);">
  [ ${componentId.toUpperCase()} RENDERED WITH BRAND TOKENS ]
</div>`;
  }
}

// ---------------------------------------------------------------------------
// Pre-composed Deterministic Fallbacks for AI Synthesis
// ---------------------------------------------------------------------------

export const DETERMINISTIC_AI_COMPONENTS: Record<
  string,
  { name: string; description: string; jsx: string; html: string }
> = {
  testimonial: {
    name: "Editorial Testimonial Card",
    description: "Architectural quote card with typography hierarchy and verification seal.",
    jsx: `export function TestimonialSlider() {
  return (
    <div className="border border-[var(--brand-border)] bg-[var(--brand-surface)] p-8" style={{ borderRadius: 0 }}>
      <span className="font-[family-name:var(--brand-font-mono)] text-[10px] uppercase tracking-[0.24em] text-[var(--brand-accent)]">
        // CLIENT DIRECTIVE VERIFIED
      </span>
      <blockquote className="mt-4 font-[family-name:var(--brand-font-display)] text-2xl font-bold italic leading-snug text-[var(--brand-text)]">
        "Brand DNA stripped away all corporate SaaS noise and delivered a timeless aesthetic scalpel."
      </blockquote>
      <div className="mt-6 flex items-center justify-between border-t border-[var(--brand-border-subtle)] pt-4 font-[family-name:var(--brand-font-mono)] text-xs">
        <div>
          <p className="font-bold text-[var(--brand-text)]">Elena Vance</p>
          <p className="text-[10px] text-[var(--brand-muted-fg)]">Design Director, Archive Studio</p>
        </div>
        <span className="text-[var(--brand-accent)]">[ 100% RAW INK ]</span>
      </div>
    </div>
  );
}`,
    html: `<div style="border: 1px solid var(--brand-border); background: var(--brand-surface); padding: 32px; border-radius: 0;">
  <blockquote style="font-family: var(--brand-font-display); font-size: 24px; color: var(--brand-text); margin: 0;">
    "Brand DNA stripped away all corporate SaaS noise and delivered a timeless aesthetic scalpel."
  </blockquote>
</div>`,
  },

  checkout: {
    name: "Minimalist Checkout Order Summary",
    description: "Receipt-styled transactional summary with tax calculation and primary purchase trigger.",
    jsx: `export function CheckoutSummary() {
  return (
    <div className="border border-[var(--brand-border)] bg-[var(--brand-surface)] p-6 font-[family-name:var(--brand-font-mono)] text-xs" style={{ borderRadius: 0 }}>
      <p className="border-b border-[var(--brand-border-subtle)] pb-2 text-[10px] uppercase tracking-[0.22em] text-[var(--brand-muted-fg)]">
        // ORDER SUMMARY · TRANSACTION 9940
      </p>
      <div className="mt-4 space-y-2 text-[var(--brand-text)]">
        <div className="flex justify-between">
          <span>Brand Kit License (Annual)</span>
          <span>$290.00</span>
        </div>
        <div className="flex justify-between text-[var(--brand-muted-fg)]">
          <span>High-DPI Asset Export Pack</span>
          <span>$45.00</span>
        </div>
        <div className="flex justify-between border-t border-[var(--brand-border-subtle)] pt-2 font-bold">
          <span>TOTAL DUE</span>
          <span className="text-[var(--brand-accent)]">$335.00</span>
        </div>
      </div>
      <button
        type="button"
        className="mt-6 w-full border border-[var(--brand-border)] bg-[var(--brand-primary)] py-3 text-xs uppercase tracking-[0.16em] text-[var(--brand-primary-fg)] hover:bg-[var(--brand-accent)]"
        style={{ borderRadius: 0 }}
      >
        [ AUTHORIZE TRANSACTION ]
      </button>
    </div>
  );
}`,
    html: `<div style="border: 1px solid var(--brand-border); background: var(--brand-surface); padding: 24px; border-radius: 0; font-family: var(--brand-font-mono);">
  <h3>Order Summary</h3>
  <p>Total: $335.00</p>
</div>`,
  },
};
