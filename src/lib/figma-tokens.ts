// Figma Design Tokens & Variables Formatter.
// Generates W3C Design Tokens Community Group (DTCG) specification structures and
// Figma Local Variables JSON payloads (Colors, Spacing, Radius, Typography Text Styles, and Logo Vectors),
// with deterministic content hashing for 2-way diff synchronization.

import { cleanHexColor } from "@/lib/mockups";
import { slug } from "@/lib/exports";

export type ColorToken = {
  hex: string;
  role?: string | null;
  name?: string | null;
};

export type FontToken = {
  family: string;
  role?: string | null;
  weights?: string[] | null;
};

export type DesignToken = {
  category: string;
  name: string;
  value: string;
  description?: string | null;
};

export type AssetToken = {
  id?: string;
  kind: string;
  url: string;
  storagePath?: string | null;
  storage_path?: string | null;
};

export type RgbaFloat = { r: number; g: number; b: number; a: number };

export type FigmaVariable = {
  name: string;
  type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  valuesByMode: Record<string, RgbaFloat | number | string | boolean>;
  description?: string;
  scopes?: string[];
  hex?: string;
};

export type FigmaVariableCollection = {
  name: string;
  modes: string[];
  variables: FigmaVariable[];
};

export type FigmaTextStyle = {
  name: string;
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  lineHeight?: { unit: "PERCENT" | "PIXELS"; value: number };
  letterSpacing?: { unit: "PERCENT" | "PIXELS"; value: number };
};

export type FigmaVariablesPayload = {
  collections: FigmaVariableCollection[];
  textStyles: FigmaTextStyle[];
  logos: Array<{ kind: string; url: string; name: string }>;
};

export type FigmaSyncResponsePayload = {
  version: string;
  kitId: string;
  kitName: string;
  updatedAt: string;
  hash: string;
  dtcg: Record<string, unknown>;
  figmaVariables: FigmaVariablesPayload;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function hexToRgbaFloat(hex: string): RgbaFloat {
  const clean = cleanHexColor(hex, "#000000").replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return {
    r: Number(r.toFixed(3)),
    g: Number(g.toFixed(3)),
    b: Number(b.toFixed(3)),
    a: 1,
  };
}

export function parseDimensionPx(val: string): number {
  if (!val) return 0;
  const trimmed = String(val).trim();
  if (/rem$/i.test(trimmed)) {
    const num = parseFloat(trimmed);
    return isNaN(num) ? 0 : Math.round(num * 16);
  }
  const num = parseFloat(trimmed);
  return isNaN(num) ? 0 : Math.round(num);
}

// ---------------------------------------------------------------------------
// W3C DTCG Tokens Generator
// ---------------------------------------------------------------------------

export function buildDtcgTokensPayload(p: {
  colors: ColorToken[];
  fonts: FontToken[];
  tokens: DesignToken[];
}): Record<string, unknown> {
  const seen = new Set<string>();
  const uniqueKey = (base: string) => {
    let key = base || "unnamed";
    let i = 2;
    while (seen.has(key)) key = `${base}-${i++}`;
    seen.add(key);
    return key;
  };

  const color: Record<string, unknown> = {};
  for (const c of p.colors) {
    const key = uniqueKey(slug(c.role || c.name || c.hex));
    color[key] = {
      $value: cleanHexColor(c.hex, "#0A0A0A"),
      $type: "color",
      $description: [c.role, c.name].filter(Boolean).join(" · ") || undefined,
    };
  }

  const font: Record<string, unknown> = {};
  for (const f of p.fonts) {
    const key = uniqueKey(`font-${slug(f.role || f.family)}`);
    font[key] = {
      $value: String(f.family).replace(/["\\]/g, ""),
      $type: "fontFamily",
      $description: f.role || undefined,
    };
  }

  const dimension: Record<string, unknown> = {};
  for (const t of p.tokens) {
    const key = uniqueKey(`${slug(t.category)}-${slug(t.name)}`);
    dimension[key] = {
      $value: t.value,
      $type: "dimension",
      $description: t.description || undefined,
    };
  }

  return { color, font, dimension };
}

// ---------------------------------------------------------------------------
// Figma Variables & Styles Payload Generator
// ---------------------------------------------------------------------------

export function buildFigmaVariablesPayload(p: {
  kitName: string;
  colors: ColorToken[];
  fonts: FontToken[];
  tokens: DesignToken[];
  assets: AssetToken[];
}): FigmaVariablesPayload {
  // 1. Color Collection
  const colorVariables: FigmaVariable[] = p.colors.map((c) => {
    const roleOrName = c.role || c.name || "color";
    const variableName = `color/${slug(roleOrName)}`;
    const hex = cleanHexColor(c.hex, "#0A0A0A");
    return {
      name: variableName,
      type: "COLOR",
      valuesByMode: {
        Default: hexToRgbaFloat(hex),
      },
      hex,
      description: [c.role, c.name, hex].filter(Boolean).join(" · "),
      scopes: ["ALL_FILLS", "STROKE_COLOR"],
    };
  });

  // 2. Spacing Collection
  const spacingTokens = p.tokens.filter((t) => t.category === "spacing");
  const spacingVariables: FigmaVariable[] = (
    spacingTokens.length
      ? spacingTokens
      : [
          { category: "spacing", name: "xs", value: "4px" },
          { category: "spacing", name: "sm", value: "8px" },
          { category: "spacing", name: "md", value: "16px" },
          { category: "spacing", name: "lg", value: "24px" },
          { category: "spacing", name: "xl", value: "32px" },
          { category: "spacing", name: "2xl", value: "48px" },
        ]
  ).map((t) => ({
    name: `spacing/${slug(t.name)}`,
    type: "FLOAT",
    valuesByMode: {
      Default: parseDimensionPx(t.value),
    },
    description: `${t.value} spacing token`,
    scopes: ["GAP", "WIDTH_HEIGHT"],
  }));

  // 3. Radius Collection (Adhering to "The Invisible Instrument" 0px standard)
  const radiusTokens = p.tokens.filter((t) => t.category === "radius");
  const radiusVariables: FigmaVariable[] = (
    radiusTokens.length
      ? radiusTokens
      : [
          { category: "radius", name: "none", value: "0px" },
          { category: "radius", name: "base", value: "0px" },
          { category: "radius", name: "card", value: "0px" },
          { category: "radius", name: "button", value: "0px" },
        ]
  ).map((t) => ({
    name: `radius/${slug(t.name)}`,
    type: "FLOAT",
    valuesByMode: {
      Default: parseDimensionPx(t.value),
    },
    description: `${t.value} border-radius (The Invisible Instrument)`,
    scopes: ["CORNER_RADIUS"],
  }));

  const collections: FigmaVariableCollection[] = [
    {
      name: `${p.kitName} / Colors`,
      modes: ["Default"],
      variables: colorVariables,
    },
    {
      name: `${p.kitName} / Spacing`,
      modes: ["Default"],
      variables: spacingVariables,
    },
    {
      name: `${p.kitName} / Radius`,
      modes: ["Default"],
      variables: radiusVariables,
    },
  ];

  // 4. Text Styles
  const displayFont =
    p.fonts.find((f) => /display|heading/i.test(f.role ?? ""))?.family || "Cormorant Garamond";
  const bodyFont =
    p.fonts.find((f) => /body|text|sans/i.test(f.role ?? ""))?.family || "Libre Baskerville";
  const monoFont = p.fonts.find((f) => /mono|code/i.test(f.role ?? ""))?.family || "Courier Prime";

  const textStyles: FigmaTextStyle[] = [
    {
      name: "Display / H1 (Display)",
      fontFamily: displayFont,
      fontStyle: "Bold",
      fontSize: 48,
      lineHeight: { unit: "PERCENT", value: 110 },
      letterSpacing: { unit: "PERCENT", value: -1 },
    },
    {
      name: "Display / H2 (Section Title)",
      fontFamily: displayFont,
      fontStyle: "Bold",
      fontSize: 32,
      lineHeight: { unit: "PERCENT", value: 120 },
      letterSpacing: { unit: "PERCENT", value: 0 },
    },
    {
      name: "Body / Paragraph",
      fontFamily: bodyFont,
      fontStyle: "Regular",
      fontSize: 16,
      lineHeight: { unit: "PERCENT", value: 160 },
    },
    {
      name: "Monospace / Code & Eyebrows",
      fontFamily: monoFont,
      fontStyle: "Regular",
      fontSize: 11,
      lineHeight: { unit: "PERCENT", value: 140 },
      letterSpacing: { unit: "PERCENT", value: 14 },
    },
  ];

  // 5. Logo Variants ready for canvas placement
  const logos = p.assets
    .filter((a) => /logo|mark|wordmark/i.test(a.kind))
    .map((a) => ({
      kind: a.kind,
      url: a.url,
      name: `${p.kitName} - ${a.kind}`,
    }));

  return {
    collections,
    textStyles,
    logos,
  };
}

// ---------------------------------------------------------------------------
// 2-Way Diff Hash Computation
// ---------------------------------------------------------------------------

export function computeTokenHash(payload: {
  colors: ColorToken[];
  tokens: DesignToken[];
  fonts: FontToken[];
  kitName: string;
}): string {
  const norm = {
    name: payload.kitName,
    colors: payload.colors
      .map((c) => `${c.role}:${cleanHexColor(c.hex, "#0A0A0A")}`)
      .sort()
      .join(";"),
    tokens: payload.tokens
      .map((t) => `${t.category}:${t.name}:${t.value}`)
      .sort()
      .join(";"),
    fonts: payload.fonts
      .map((f) => `${f.role}:${f.family}`)
      .sort()
      .join(";"),
  };

  const str = JSON.stringify(norm);
  // Fast 32-bit FNV-1a hash formatted as hexadecimal string
  let h1 = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h1 ^= str.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }

  return (h1 >>> 0).toString(16).padStart(8, "0");
}
