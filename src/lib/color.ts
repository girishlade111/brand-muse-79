// Color helpers — hex → RGB, contrast ratio, WCAG checks.

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace(/^#+/, "").trim();
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [0, 0, 0];
  const num = parseInt(h, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function srgbToLin(c: number) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type WcagResult = {
  ratio: number;
  aa: boolean; // 4.5
  aaLarge: boolean; // 3.0
  aaa: boolean; // 7.0
};

export function wcag(a: string, b: string): WcagResult {
  const ratio = contrastRatio(a, b);
  return {
    ratio,
    aa: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaa: ratio >= 7,
  };
}

export function isValidHex(s: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s.trim());
}

export function normalizeHex(s: string): string {
  let h = s.replace(/^#+/, "").trim().toLowerCase();
  if (h.length === 3 && /^[0-9a-f]{3}$/.test(h))
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (!/^[0-9a-f]{6}$/.test(h)) return "#000000";
  return "#" + h;
}

// ============================================================================
// HSL conversion + hue-preserving WCAG auto-fixer.
// ============================================================================

export type Hsl = { h: number; s: number; l: number };

export function hexToHsl(hex: string): Hsl {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(1, s));
  const ll = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) {
    r = c;
    g = x;
  } else if (hh < 120) {
    r = x;
    g = c;
  } else if (hh < 180) {
    g = c;
    b = x;
  } else if (hh < 240) {
    g = x;
    b = c;
  } else if (hh < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return rgbToHex(Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255));
}

export type WcagLevel = "AA" | "AAA";

export function targetRatioFor(level: WcagLevel): number {
  return level === "AAA" ? 7 : 4.5;
}

export type ContrastFix = {
  hex: string;
  ratio: number;
  // Signed lightness delta applied in HSL space (negative = darkened).
  deltaL: number;
  direction: "darken" | "lighten" | "none";
  // Hue drift introduced by 8-bit rounding, in degrees. Near zero by design.
  hueDrift: number;
};

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Automated color harmony optimizer: if `foreground` on `background` fails
// the target ratio, find the closest compliant shade by moving lightness in
// HSL space while holding hue (and saturation) fixed. Searches both darken
// and lighten directions and keeps the minimum-luminance-delta winner, so
// the underlying hue/tone never shifts — only depth does.
export function autoFixContrast(
  foreground: string,
  background: string,
  opts?: { adjust?: "foreground" | "background"; level?: WcagLevel },
): ContrastFix | null {
  const adjust = opts?.adjust ?? "foreground";
  const target = targetRatioFor(opts?.level ?? "AA");
  const fg = normalizeHex(foreground);
  const bg = normalizeHex(background);
  const current = contrastRatio(fg, bg);
  if (current >= target) {
    return { hex: fg, ratio: current, deltaL: 0, direction: "none", hueDrift: 0 };
  }

  const moving = adjust === "foreground" ? fg : bg;
  const fixed = adjust === "foreground" ? bg : fg;
  const base = hexToHsl(moving);

  // Binary-search each direction for the smallest |deltaL| reaching target.
  function search(dir: 1 | -1): { l: number; ratio: number } | null {
    let lo = 0;
    let hi = dir === 1 ? 1 - base.l : base.l;
    if (hi <= 0.0005) return null;
    let best: { l: number; ratio: number } | null = null;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const candidate = hslToHex(base.h, base.s, base.l + dir * mid);
      const ratio = adjust === "foreground" ? contrastRatio(candidate, fixed) : contrastRatio(fixed, candidate);
      if (ratio >= target) {
        best = { l: base.l + dir * mid, ratio };
        hi = mid;
      } else {
        lo = mid;
      }
    }
    return best;
  }

  const down = search(-1);
  const up = search(1);
  const candidates = [down ? { ...down, dir: "darken" as const } : null, up ? { ...up, dir: "lighten" as const } : null].filter(
    (c): c is { l: number; ratio: number; dir: "darken" | "lighten" } => c !== null,
  );
  if (!candidates.length) return null;
  candidates.sort((a, b) => Math.abs(a.l - base.l) - Math.abs(b.l - base.l));
  const win = candidates[0];
  const hex = hslToHex(base.h, base.s, win.l).toUpperCase();
  const finalRatio =
    adjust === "foreground" ? contrastRatio(hex, fixed) : contrastRatio(fixed, hex);
  return {
    hex,
    ratio: finalRatio,
    deltaL: win.l - base.l,
    direction: win.dir,
    hueDrift: hueDistance(hexToHsl(hex).h, base.h),
  };
}
