// Competitive Intelligence & Design Analytics — pure analysis engine.
// Color psychology mapping, typography DNA, voice spectrum, market
// white-space discovery, and color-vision-deficiency simulation.
// No React. Fully unit-testable.

import { hexToHsl, hexToRgb, normalizeHex } from "./color";

export type KitColorLike = { hex: string; role?: string | null; name?: string | null };
export type KitFontLike = { family?: string | null; role?: string | null; weights?: unknown };
export type KitVoiceLike = {
  tone?: Array<{ label?: string }> | null;
  vocabulary?: string[] | null;
  dos?: string[] | null;
  donts?: string[] | null;
  samples?: Record<string, string> | null;
  summary?: string | null;
};

// ============================================================================
// Hue science
// ============================================================================

export const HUE_BUCKETS = [
  "Red",
  "Vermilion",
  "Orange",
  "Ochre",
  "Yellow",
  "Chartreuse",
  "Green",
  "Forest",
  "Teal",
  "Cyan",
  "Azure",
  "Blue",
  "Indigo",
  "Violet",
  "Magenta",
  "Rose",
] as const;

// 16 buckets × 22.5°. Exemplar hex per bucket for white-space suggestions.
export const BUCKET_EXEMPLARS = [
  "#C0392B",
  "#D35400",
  "#E67E22",
  "#C77B2B",
  "#D9A404",
  "#7DA82B",
  "#2E7D32",
  "#1F4D2E",
  "#0F766E",
  "#0891B2",
  "#2563EB",
  "#1E3A8A",
  "#4C1D95",
  "#7C3AED",
  "#BE185D",
  "#E11D48",
] as const;

export function hueBucket(h: number): number {
  const norm = ((h % 360) + 360) % 360;
  return Math.floor(norm / 22.5) % 16;
}

// Warm = reds through yellows + warm magentas/roses. Cool = greens through
// blues/violets. Low-saturation colors count as neutral, not warm or cool.
export function temperatureOf(hex: string): "warm" | "cool" | "neutral" {
  const { h, s } = hexToHsl(normalizeHex(hex));
  if (s < 0.14) return "neutral";
  const norm = ((h % 360) + 360) % 360;
  if (norm < 70 || norm >= 315) return "warm";
  return "cool";
}

export type KitColorProfile = {
  count: number;
  hueHistogram: number[];
  dominantBuckets: Array<{ bucket: string; share: number }>;
  avgSaturation: number;
  avgLightness: number;
  warmRatio: number;
  coolRatio: number;
  neutralRatio: number;
  vibrancy: number;
  temperature: "warm" | "cool" | "balanced" | "neutral-led";
};

export function analyzeKitColors(colors: KitColorLike[]): KitColorProfile {
  const hexes = (colors ?? [])
    .map((c) => normalizeHex(c.hex ?? ""))
    .filter((h) => /^#[0-9a-f]{6}$/.test(h));
  const histogram = new Array<number>(16).fill(0);
  let sat = 0;
  let light = 0;
  let warm = 0;
  let cool = 0;
  let neutral = 0;
  for (const hex of hexes) {
    const { h, s, l } = hexToHsl(hex);
    if (s < 0.14) {
      neutral += 1;
    } else {
      histogram[hueBucket(h)] += 1;
    }
    sat += s;
    light += l;
    const t = temperatureOf(hex);
    if (t === "warm") warm += 1;
    else if (t === "cool") cool += 1;
    else neutral += 0; // already counted
  }
  const n = Math.max(1, hexes.length);
  const avgS = sat / n;
  const avgL = light / n;
  const warmRatio = warm / n;
  const coolRatio = cool / n;
  const neutralRatio = Math.min(1, neutral / n);
  // Vibrancy: saturated color with mid lightness reads loudest.
  const vibrancy = Math.round(Math.max(0, Math.min(1, avgS * (1.15 - Math.abs(avgL - 0.5)))) * 100);
  const dominantBuckets = histogram
    .map((count, i) => ({ bucket: HUE_BUCKETS[i], share: count / n }))
    .filter((d) => d.share > 0)
    .sort((a, b) => b.share - a.share)
    .slice(0, 3);
  const temperature: KitColorProfile["temperature"] =
    neutralRatio >= 0.6
      ? "neutral-led"
      : warmRatio - coolRatio >= 0.25
        ? "warm"
        : coolRatio - warmRatio >= 0.25
          ? "cool"
          : "balanced";
  return {
    count: hexes.length,
    hueHistogram: histogram,
    dominantBuckets,
    avgSaturation: avgS,
    avgLightness: avgL,
    warmRatio,
    coolRatio,
    neutralRatio,
    vibrancy,
    temperature,
  };
}

// ============================================================================
// Typography DNA
// ============================================================================

const SERIF_HINTS = [
  "serif",
  "garamond",
  "cormorant",
  "baskerville",
  "georgia",
  "times",
  "playfair",
  "merriweather",
  "lora",
  "bodoni",
  "didot",
  "libre",
  "eb garamond",
  "pt serif",
  "source serif",
  "fraunces",
  "newsreader",
];

const MONO_HINTS = [
  "mono",
  "courier",
  "jetbrains",
  "consolas",
  "menlo",
  "code",
  "terminal",
  "plex mono",
  "space mono",
  "roboto mono",
  "ibm",
  "fira code",
  "source code",
  "ui-monospace",
];

export type TypeClass = "serif" | "sans-serif" | "monospace";

export function classifyFontFamily(family: string): TypeClass {
  const f = String(family ?? "").toLowerCase();
  if (MONO_HINTS.some((h) => f.includes(h))) return "monospace";
  if (SERIF_HINTS.some((h) => f.includes(h))) return "serif";
  return "sans-serif";
}

export type KitTypeProfile = {
  count: number;
  serif: number;
  sans: number;
  mono: number;
  dominant: TypeClass;
  weightCount: number;
  weights: number[];
};

export function analyzeKitType(fonts: KitFontLike[]): KitTypeProfile {
  const usable = (fonts ?? []).filter((f) => f && typeof f.family === "string" && f.family.trim());
  let serif = 0;
  let mono = 0;
  const weightSet = new Set<number>();
  for (const f of usable) {
    const cls = classifyFontFamily(f.family ?? "");
    if (cls === "serif") serif += 1;
    else if (cls === "monospace") mono += 1;
    const weights = Array.isArray(f.weights) ? f.weights : [];
    for (const w of weights) {
      const num = parseInt(String(w).replace(/[^0-9]/g, ""), 10);
      if (Number.isFinite(num) && num > 0) weightSet.add(num);
    }
  }
  const n = Math.max(1, usable.length);
  const serifShare = serif / n;
  const monoShare = mono / n;
  const sansShare = Math.max(0, 1 - serifShare - monoShare);
  const dominant: TypeClass =
    serifShare >= sansShare && serifShare >= monoShare
      ? "serif"
      : monoShare > sansShare
        ? "monospace"
        : "sans-serif";
  return {
    count: usable.length,
    serif: serifShare,
    sans: sansShare,
    mono: monoShare,
    dominant,
    weightCount: weightSet.size,
    weights: [...weightSet].sort((a, b) => a - b),
  };
}

// ============================================================================
// Voice & sentiment spectrum (-1 .. 1 per axis)
// ============================================================================

const AXIS_LEXICONS: Record<string, { pos: string[]; neg: string[] }> = {
  formalCasual: {
    pos: [
      "formal",
      "professional",
      "authoritative",
      "corporate",
      "precise",
      "luxury",
      "editorial",
      "sophisticated",
      "refined",
      "institutional",
      "trust",
      "expert",
    ],
    neg: [
      "casual",
      "friendly",
      "playful",
      "witty",
      "warm",
      "bold",
      "edgy",
      "youthful",
      "approachable",
      "fun",
      "quirky",
      "irreverent",
    ],
  },
  technicalConversational: {
    pos: [
      "technical",
      "engineering",
      "data",
      "systematic",
      "analytical",
      "detailed",
      "scientific",
      "developer",
      "precise",
      "specification",
    ],
    neg: [
      "conversational",
      "story",
      "human",
      "simple",
      "plain",
      "everyday",
      "relatable",
      "narrative",
      "emotional",
    ],
  },
  minimalExpressive: {
    pos: ["minimal", "concise", "terse", "restrained", "quiet", "sparse", "direct", "short", "spare"],
    neg: [
      "expressive",
      "vivid",
      "rich",
      "evocative",
      "dramatic",
      "elaborate",
      "poetic",
      "lush",
      "ornate",
    ],
  },
};

function voiceCorpus(voice: KitVoiceLike | null | undefined): { labels: string; body: string } {
  if (!voice) return { labels: "", body: "" };
  const labels = Array.isArray(voice.tone)
    ? voice.tone.map((t) => String(t?.label ?? "")).join(" ")
    : "";
  const body = [
    ...(voice.vocabulary ?? []),
    ...(voice.dos ?? []),
    ...(voice.donts ?? []),
    ...Object.values(voice.samples ?? {}),
    voice.summary ?? "",
  ]
    .map((s) => String(s ?? ""))
    .join(" ");
  return { labels: labels.toLowerCase(), body: body.toLowerCase() };
}

function scoreAxis(labels: string, body: string, pos: string[], neg: string[]): number {
  let p = 0;
  let q = 0;
  for (const w of pos) {
    if (labels.includes(w)) p += 2;
    else if (body.includes(w)) p += 1;
  }
  for (const w of neg) {
    if (labels.includes(w)) q += 2;
    else if (body.includes(w)) q += 1;
  }
  if (p + q === 0) return 0;
  return (p - q) / (p + q);
}

export type KitVoiceProfile = {
  formalCasual: number;
  technicalConversational: number;
  minimalExpressive: number;
  signal: number;
  formalLabel: string;
  technicalLabel: string;
  minimalLabel: string;
};

function axisLabel(v: number, pos: string, neg: string): string {
  if (v >= 0.4) return pos;
  if (v <= -0.4) return neg;
  return "Balanced";
}

export function analyzeKitVoice(voice: KitVoiceLike | null | undefined): KitVoiceProfile {
  const { labels, body } = voiceCorpus(voice);
  const formalCasual = scoreAxis(labels, body, AXIS_LEXICONS.formalCasual.pos, AXIS_LEXICONS.formalCasual.neg);
  const technicalConversational = scoreAxis(
    labels,
    body,
    AXIS_LEXICONS.technicalConversational.pos,
    AXIS_LEXICONS.technicalConversational.neg,
  );
  const minimalExpressive = scoreAxis(
    labels,
    body,
    AXIS_LEXICONS.minimalExpressive.pos,
    AXIS_LEXICONS.minimalExpressive.neg,
  );
  const signal =
    Math.abs(formalCasual) + Math.abs(technicalConversational) + Math.abs(minimalExpressive);
  return {
    formalCasual,
    technicalConversational,
    minimalExpressive,
    signal,
    formalLabel: axisLabel(formalCasual, "Formal", "Casual"),
    technicalLabel: axisLabel(technicalConversational, "Technical", "Conversational"),
    minimalLabel: axisLabel(minimalExpressive, "Minimal", "Expressive"),
  };
}

// ============================================================================
// Comparison matrix (radar-ready, normalized 0..1)
// ============================================================================

export type ComparedKit = {
  id: string;
  name: string;
  colors: KitColorLike[];
  fonts: KitFontLike[];
  voice: KitVoiceLike | null;
};

export const RADAR_AXES = [
  "Warmth",
  "Vibrancy",
  "Saturation",
  "Hue spread",
  "Type range",
  "Voice signal",
] as const;

export function buildComparisonMatrix(kits: ComparedKit[]): {
  axes: string[];
  series: Array<{ id: string; name: string; values: number[] }>;
} {
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const series = kits.map((k) => {
    const c = analyzeKitColors(k.colors);
    const t = analyzeKitType(k.fonts);
    const v = analyzeKitVoice(k.voice);
    const occupied = c.hueHistogram.filter((n) => n > 0).length;
    return {
      id: k.id,
      name: k.name,
      values: [
        clamp01(c.warmRatio),
        clamp01(c.vibrancy / 100),
        clamp01(c.avgSaturation),
        clamp01(occupied / 16),
        clamp01(t.weightCount / 8),
        clamp01(v.signal / 3),
      ],
    };
  });
  return { axes: [...RADAR_AXES], series };
}

// ============================================================================
// Market white-space discovery (deterministic core; AI enriches it)
// ============================================================================

export type WhiteSpaceReport = {
  saturatedBands: Array<{ band: string; exemplar: string; kitShare: number; exampleHexes: string[] }>;
  openTerritory: Array<{ band: string; exemplar: string; suggestion: string }>;
  vectors: string[];
  temperatureNote: string;
};

const OPEN_TERRITORY_COPY: Record<string, string> = {
  Red: "Signal red is unowned here — a sharp error/CTA accent with no competition.",
  Vermilion: "Burnt vermilion is completely unutilized — earthy energy nobody claims.",
  Orange: "No brand owns orange — the loudest acquisition color in the cohort is free.",
  Ochre: "High-contrast ochre is unutilized — premium warmth without a claimant.",
  Yellow: "Yellow is absent — high-visibility highlight territory is wide open.",
  Chartreuse: "Acid chartreuse is untouched — the disruptive edge nobody dares take.",
  Green: "Fresh green is unclaimed — growth and go-signal associations are free.",
  Forest: "Deep forest green is completely unutilized — quiet authority, zero competition.",
  Teal: "Teal is open water — technical trust without the blue cliché.",
  Cyan: "Electric cyan is unowned — digital-native signal with no rival.",
  Azure: "Bright azure is free — optimism at full saturation, unclaimed.",
  Blue: "True blue is surprisingly open — own the category default before a rival does.",
  Indigo: "Deep indigo is unutilized — intellectual depth with no claimant.",
  Violet: "Violet is untouched — creative-AI associations are yours to take.",
  Magenta: "Magenta is unclaimed — maximum shelf-shout with zero cohort competition.",
  Rose: "Rose is open — human warmth in a field of cold systems.",
};

export function analyzeWhiteSpace(kits: ComparedKit[]): WhiteSpaceReport {
  const total = Math.max(1, kits.length);
  const profiles = kits.map((k) => ({ kit: k, profile: analyzeKitColors(k.colors) }));
  const saturatedBands: WhiteSpaceReport["saturatedBands"] = [];
  const openTerritory: WhiteSpaceReport["openTerritory"] = [];
  for (let i = 0; i < 16; i++) {
    const using = profiles.filter((p) => p.profile.hueHistogram[i] > 0);
    const share = using.length / total;
    const exampleHexes = using
      .flatMap((p) =>
        p.kit.colors
          .map((c) => normalizeHex(c.hex ?? ""))
          .filter((h) => /^#[0-9a-f]{6}$/.test(h) && hexToHsl(h).s >= 0.14 && hueBucket(hexToHsl(h).h) === i),
      )
      .slice(0, 3);
    if (share >= 0.5) {
      saturatedBands.push({
        band: HUE_BUCKETS[i],
        exemplar: BUCKET_EXEMPLARS[i],
        kitShare: share,
        exampleHexes,
      });
    } else if (using.length === 0) {
      openTerritory.push({
        band: HUE_BUCKETS[i],
        exemplar: BUCKET_EXEMPLARS[i],
        suggestion: OPEN_TERRITORY_COPY[HUE_BUCKETS[i]] ?? `${HUE_BUCKETS[i]} is unclaimed.`,
      });
    }
  }
  saturatedBands.sort((a, b) => b.kitShare - a.kitShare);

  const vectors: string[] = [];
  for (const band of openTerritory.slice(0, 3)) {
    vectors.push(`Own ${band.band} (${band.exemplar}) — ${band.suggestion}`);
  }
  // Temperature gap.
  const warmLed = profiles.filter((p) => p.profile.temperature === "warm").length;
  const coolLed = profiles.filter((p) => p.profile.temperature === "cool").length;
  let temperatureNote: string;
  if (coolLed >= total - 1 && total > 1) {
    temperatureNote = "The cohort skews cold — nearly every palette is cool-led. A warm-led identity would stand apart on sight.";
    vectors.push("Go warm-led while rivals stay cold — instant shelf separation.");
  } else if (warmLed >= total - 1 && total > 1) {
    temperatureNote = "The cohort skews warm — cool precision (slate, teal, deep blue) would read as the disciplined alternative.";
    vectors.push("Go cool and restrained while rivals run warm — own the calm corner.");
  } else {
    temperatureNote = "Temperature is mixed across the cohort — differentiation must come from hue ownership, not warmth alone.";
  }
  // Type gap.
  const dominants = profiles.map((p) => analyzeKitType(p.kit.fonts).dominant);
  if (dominants.length > 1 && dominants.every((d) => d === "sans-serif")) {
    vectors.push("Every rival sets type in sans-serif — an editorial serif display face is uncontested.");
  }
  if (dominants.length > 1 && !dominants.includes("monospace")) {
    vectors.push("Nobody uses monospace as a voice — technical precision in type is free to claim.");
  }
  // Voice gap.
  const voices = profiles.map((p) => analyzeKitVoice(p.kit.voice));
  const avgFormal = voices.reduce((s, v) => s + v.formalCasual, 0) / Math.max(1, voices.length);
  if (avgFormal > 0.3) {
    vectors.push("The cohort speaks formally — a casual, direct voice would cut through the committee tone.");
  } else if (avgFormal < -0.3) {
    vectors.push("Rivals all sound casual — a formal, precise register would read as the grown-up in the room.");
  }
  if (!saturatedBands.length) {
    vectors.push("No hue band is saturated — the field is fragmented, so pick one band and own it loudly.");
  }
  return { saturatedBands, openTerritory, vectors, temperatureNote };
}

// ============================================================================
// Color vision deficiency simulation (Machado et al. 2009, severe matrices)
// ============================================================================

export const CVD_KINDS = [
  { id: "protanopia", label: "Protanopia", hint: "Red-blind" },
  { id: "deuteranopia", label: "Deuteranopia", hint: "Green-blind" },
  { id: "tritanopia", label: "Tritanopia", hint: "Blue-yellow blind" },
  { id: "achromatopsia", label: "Achromatopsia", hint: "Monochromacy" },
] as const;

export type CvdKind = (typeof CVD_KINDS)[number]["id"];

// Row-major 3×3 matrices + SVG feColorMatrix value strings.
const CVD_MATRICES: Record<CvdKind, { m: number[]; svg: string }> = {
  protanopia: {
    m: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
    svg: "0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0",
  },
  deuteranopia: {
    m: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
    svg: "0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0",
  },
  tritanopia: {
    m: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
    svg: "0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0",
  },
  achromatopsia: {
    m: [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114],
    svg: "0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0 0 0 1 0",
  },
};

export function cvdMatrixSvg(kind: CvdKind): string {
  return CVD_MATRICES[kind].svg;
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function simulateCvdRgb(rgb: [number, number, number], kind: CvdKind): [number, number, number] {
  const m = CVD_MATRICES[kind].m;
  const [r, g, b] = rgb;
  return [
    clamp255(m[0] * r + m[1] * g + m[2] * b),
    clamp255(m[3] * r + m[4] * g + m[5] * b),
    clamp255(m[6] * r + m[7] * g + m[8] * b),
  ];
}

export function simulateCvd(hex: string, kind: CvdKind): string {
  const [r, g, b] = simulateCvdRgb(hexToRgb(normalizeHex(hex)), kind);
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export type CvdBreak = { a: string; b: string; normalRatio: number; simRatio: number };

function relLumRgb(rgb: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

function contrastRgb(a: [number, number, number], b: [number, number, number]): number {
  const la = relLumRgb(a);
  const lb = relLumRgb(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// A functional distinction "breaks" when two colors readable apart normally
// (>= 3:1, the large-text/UI floor) collapse below it under simulation.
export function cvdPairBreaks(colors: KitColorLike[], kind: CvdKind): CvdBreak[] {
  const hexes = [...new Set((colors ?? []).map((c) => normalizeHex(c.hex ?? "")).filter((h) => /^#[0-9a-f]{6}$/.test(h)))];
  const out: CvdBreak[] = [];
  for (let i = 0; i < hexes.length; i++) {
    for (let j = i + 1; j < hexes.length; j++) {
      const a = hexToRgb(hexes[i]);
      const b = hexToRgb(hexes[j]);
      const normalRatio = contrastRgb(a, b);
      if (normalRatio < 3) continue;
      const simRatio = contrastRgb(simulateCvdRgb(a, kind), simulateCvdRgb(b, kind));
      if (simRatio < 3) out.push({ a: hexes[i].toUpperCase(), b: hexes[j].toUpperCase(), normalRatio, simRatio });
    }
  }
  return out.sort((x, y) => y.normalRatio - x.normalRatio);
}

export type CvdReport = {
  kind: CvdKind;
  label: string;
  hint: string;
  brokenPairs: CvdBreak[];
  checked: number;
  severity: number;
};

export function cvdBreakageReport(colors: KitColorLike[]): CvdReport[] {
  const hexes = [...new Set((colors ?? []).map((c) => normalizeHex(c.hex ?? "")).filter((h) => /^#[0-9a-f]{6}$/.test(h)))];
  const checked = (hexes.length * (hexes.length - 1)) / 2;
  return CVD_KINDS.map((k) => {
    const brokenPairs = cvdPairBreaks(colors, k.id);
    return {
      kind: k.id,
      label: k.label,
      hint: k.hint,
      brokenPairs,
      checked,
      severity: checked === 0 ? 0 : brokenPairs.length / checked,
    };
  });
}

// Re-export for charts: stable series colors in the sumi editorial aesthetic.
export const SERIES_INK = ["#0A0A0A", "#8B1A1A", "#5F5A52", "#A39E93"];
