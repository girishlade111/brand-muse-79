import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeftRight, Check, Loader2, Minus, Trophy } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import {
  HueStrip,
  RadarChart,
  TypeDnaBar,
  VoiceSpectrumRow,
  WarmCoolBar,
} from "@/components/intelligence-charts";
import { getAnonToken, getAnonTokenHistory } from "@/lib/anon";
import { readKitsCache, writeKitsCache } from "@/lib/kits-cache";
import { useAutoImportFonts, renderFamilyFor } from "@/lib/font-loader";
import { getKit, listKitsByOwner } from "@/lib/kits.functions";
import { analyzeMarketNiche } from "@/lib/intelligence.functions";
import { contrastRatio, isValidHex, normalizeHex, relativeLuminance } from "@/lib/color";
import {
  SERIES_INK,
  analyzeKitColors,
  analyzeKitType,
  analyzeKitVoice,
  buildComparisonMatrix,
  type ComparedKit,
} from "@/lib/intelligence";
import type { MarketNiche } from "@/server/ai.server";

export const Route = createFileRoute("/compare")({
  component: ComparePage,
  validateSearch: (search: Record<string, unknown>): { a?: string; b?: string; c?: string; d?: string } => {
    const out: { a?: string; b?: string; c?: string; d?: string } = {};
    if (typeof search.a === "string" && search.a) out.a = search.a;
    if (typeof search.b === "string" && search.b) out.b = search.b;
    if (typeof search.c === "string" && search.c) out.c = search.c;
    if (typeof search.d === "string" && search.d) out.d = search.d;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Compare kits — Brand Kit" },
      {
        name: "description",
        content:
          "Put two brand kits side by side and compare palette, typography and design tokens to see which system is stronger.",
      },
    ],
  }),
});

type KitSummary = {
  id: string;
  name: string;
  source_url: string | null;
  status: string;
  primaryHex: string | null;
};

type ColorRow = { hex: string; name: string | null; role: string | null };
type FontRow = {
  family: string | null;
  source_family?: string | null;
  role: string | null;
  weights?: string[] | null;
  google_font?: boolean | null;
  file_urls?: Array<{ url: string; weight?: string; style?: string; format?: string }> | null;
  license?: string | null;
  is_substitute?: boolean | null;
};
type TokenRow = { category: string; name: string; value: string };

type FullKit = {
  kit: { id: string; name: string; source_url: string | null; status: string };
  colors: ColorRow[];
  fonts: FontRow[];
  tokens: TokenRow[];
};

const eyebrow = "font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground";
const mono = "font-mono text-[11px] uppercase tracking-[0.16em]";
const ghostBtn =
  "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-muted disabled:opacity-40";
const hairline = "1px solid rgba(10,10,10,0.12)";

const INK = "#0A0A0A";
const PAPER = "#F4EFE6";
const REF_COLORS = [INK, PAPER, "#FFFFFF"];

function round(n: number, dp = 1): number {
  return Number(n.toFixed(dp));
}

function hexLuma(hex: string): number | null {
  try {
    if (!isValidHex(hex)) return null;
    return relativeLuminance(normalizeHex(hex));
  } catch {
    return null;
  }
}

function hexContrast(a: string, b: string): number | null {
  try {
    if (!isValidHex(a) || !isValidHex(b)) return null;
    return contrastRatio(normalizeHex(a), normalizeHex(b));
  } catch {
    return null;
  }
}
// ---------- scoring: palette ----------

function uniqueColors(colors: ColorRow[]): ColorRow[] {
  const seen = new Set<string>();
  return colors.filter((c) => {
    const h = (c.hex ?? "").trim().toLowerCase();
    if (!h || seen.has(h)) return false;
    seen.add(h);
    return true;
  });
}

function colorDistance(a: string, b: string): number {
  const la = hexLuma(a);
  const lb = hexLuma(b);
  if (la === null || lb === null) return 0.5;
  return Math.abs(la - lb);
}

function paletteScore(colors: ColorRow[]) {
  const unique = uniqueColors(colors).filter((c) => isValidHex(c.hex));
  const roles = new Set(unique.map((c) => (c.role ?? "").toLowerCase()).filter(Boolean));
  const roleCoverage = ["primary", "secondary", "accent", "background", "surface", "text"].filter(
    (r) => roles.has(r),
  );

  let bestPair: { fg: ColorRow; bg: ColorRow; ratio: number } | null = null;
  for (const fg of unique) {
    for (const bg of unique) {
      if (fg === bg) continue;
      const r = hexContrast(fg.hex, bg.hex);
      if (r === null) continue;
      if (!bestPair || r > bestPair.ratio) bestPair = { fg, bg, ratio: r };
    }
  }

  let minDistinct: number | null = null;
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const d = colorDistance(unique[i].hex, unique[j].hex);
      if (minDistinct === null || d < minDistinct) minDistinct = d;
    }
  }

  const rolePts = (roleCoverage.length / 6) * 30;
  const sizePts = (Math.min(unique.length, 10) / 10) * 20;
  const contrastPts =
    bestPair === null
      ? 0
      : bestPair.ratio >= 7
        ? 30
        : bestPair.ratio >= 4.5
          ? 24
          : (bestPair.ratio / 4.5) * 18;
  const distinctPts = (unique.length < 2 ? 0 : Math.min((minDistinct ?? 0) / 0.5, 1)) * 20;

  return {
    score: round(rolePts + sizePts + contrastPts + distinctPts),
    count: unique.length,
    roleCoverage,
    bestPair,
    minDistinct,
  };
}

// ---------- scoring: typography ----------

function numericWeights(weights: unknown): number[] {
  if (!Array.isArray(weights)) return [];
  return weights
    .map((w) => parseInt(String(w).replace(/[^0-9]/g, ""), 10))
    .filter((n) => Number.isFinite(n));
}

function typeScore(fonts: FontRow[]) {
  const families = fonts.filter((f) => f.family);
  const roles = new Set(families.map((f) => (f.role ?? "").toLowerCase()).filter(Boolean));
  const roleCoverage = ["display", "heading", "headline", "body", "mono"].filter((r) =>
    roles.has(r),
  );

  const weightSet = new Set<number>();
  families.forEach((f) => numericWeights(f.weights).forEach((n) => weightSet.add(n)));

  const loadable = families.filter(
    (f) => f.google_font || (Array.isArray(f.file_urls) && f.file_urls.length > 0),
  );
  const subst = families.filter((f) => f.is_substitute);

  const rolePts = (roleCoverage.length / 5) * 40;
  const weightPts = (Math.min(weightSet.size, 5) / 5) * 30;
  const loadPts = (families.length ? loadable.length / families.length : 0) * 20;
  const varietyPts = Math.min(families.length, 3) >= 2 ? 10 : families.length * 5;

  return {
    score: round(rolePts + weightPts + loadPts + varietyPts),
    count: families.length,
    roleCoverage,
    weightCount: weightSet.size,
    loadable: loadable.length,
    substitutes: subst.length,
  };
}

// ---------- scoring: tokens ----------

function tokenScore(tokens: TokenRow[]) {
  const cats = new Set(tokens.map((t) => (t.category ?? "").toLowerCase()).filter(Boolean));
  const catCoverage = ["color", "spacing", "radius", "shadow", "typography", "motion"].filter((c) =>
    cats.has(c),
  );

  const numeric = (s: string): number | null => {
    const m = String(s)
      .trim()
      .match(/^(-?\d*\.?\d+)(px|rem|em)?$/i);
    if (!m) return null;
    let v = parseFloat(m[1]);
    if (!Number.isFinite(v)) return null;
    const unit = (m[2] ?? "").toLowerCase();
    if (unit === "rem" || unit === "em") v *= 16;
    return v;
  };

  let scales = 0;
  for (const cat of cats) {
    const vals = tokens
      .filter((t) => (t.category ?? "").toLowerCase() === cat)
      .map((t) => numeric(t.value))
      .filter((v): v is number => v !== null && v > 0)
      .sort((a, b) => a - b);
    if (vals.length < 3) continue;
    let geometric = true;
    for (let i = 1; i < vals.length - 1; i++) {
      const prevStep = vals[i] / vals[i - 1];
      const nextStep = vals[i + 1] / vals[i];
      if (Math.abs(Math.log(nextStep / prevStep)) > 0.4) {
        geometric = false;
        break;
      }
    }
    if (geometric) scales += 1;
  }

  const sizePts = (Math.min(tokens.length, 30) / 30) * 50;
  const catPts = (catCoverage.length / 6) * 30;
  const scalePts = Math.min(scales, 2) * 10;

  return {
    score: round(sizePts + catPts + scalePts),
    count: tokens.length,
    catCoverage,
    scales,
  };
}

type Verdict = "a" | "b" | "tie" | "na";

function pickWinner(sa: number, sb: number): Verdict {
  if (Math.abs(sa - sb) < 4) return "tie";
  return sa > sb ? "a" : "b";
}

type Analysis = {
  palette: {
    a: ReturnType<typeof paletteScore>;
    b: ReturnType<typeof paletteScore>;
    winner: Verdict;
  };
  type: { a: ReturnType<typeof typeScore>; b: ReturnType<typeof typeScore>; winner: Verdict };
  token: {
    a: ReturnType<typeof tokenScore>;
    b: ReturnType<typeof tokenScore>;
    winner: Verdict;
  };
  overall: { a: number; b: number; winner: Verdict };
};

// ---------- page ----------

function ComparePage() {
  const ownerToken = typeof window !== "undefined" ? getAnonToken() : "";
  const navigate = useNavigate();
  const search = Route.useSearch();
  const list = useServerFn(listKitsByOwner);
  const fetchKit = useServerFn(getKit);

  const [kits, setKits] = useState<KitSummary[]>([]);
  const [loadingKits, setLoadingKits] = useState(true);
  const [aId, setAId] = useState<string | undefined>(search.a);
  const [bId, setBId] = useState<string | undefined>(search.b);
  const [aKit, setAKit] = useState<FullKit | null>(null);
  const [bKit, setBKit] = useState<FullKit | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  useEffect(() => {
    if (!ownerToken) return;
    const cached = readKitsCache();
    if (cached && cached.length > 0) {
      setKits(
        cached.map((k) => ({
          id: k.id,
          name: k.name,
          source_url: k.source_url ?? null,
          status: k.status ?? "ready",
          primaryHex: k.primaryHex ?? null,
        })),
      );
      setLoadingKits(false);
    }
    (async () => {
      try {
        const res = await list({
          data: { ownerToken, ownerTokens: getAnonTokenHistory() },
        });
        const rows: KitSummary[] = (res.kits ?? []).map((k) => ({
          id: k.id,
          name: k.name,
          source_url: k.source_url ?? null,
          status: k.status ?? "ready",
          primaryHex: k.primaryHex ?? null,
        }));
        if (rows.length > 0 || (cached?.length ?? 0) === 0) {
          setKits(rows);
          writeKitsCache(res.kits ?? []);
        }
      } catch (e) {
        if (!cached?.length) toast.error(e instanceof Error ? e.message : "Failed to load kits");
      } finally {
        setLoadingKits(false);
      }
    })();
  }, [ownerToken, list]);

  // Load full data for each selected side.
  useEffect(() => {
    if (!aId || !ownerToken) {
      setAKit(null);
      return;
    }
    let cancelled = false;
    setLoadingA(true);
    fetchKit({ data: { kitId: aId, ownerToken } })
      .then((res) => {
        if (cancelled) return;
        setAKit({
          kit: res.kit,
          colors: res.colors ?? [],
          fonts: res.fonts ?? [],
          tokens: res.tokens ?? [],
        });
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load kit A");
      })
      .finally(() => {
        if (!cancelled) setLoadingA(false);
      });
    return () => {
      cancelled = true;
    };
  }, [aId, ownerToken, fetchKit]);

  useEffect(() => {
    if (!bId || !ownerToken) {
      setBKit(null);
      return;
    }
    let cancelled = false;
    setLoadingB(true);
    fetchKit({ data: { kitId: bId, ownerToken } })
      .then((res) => {
        if (cancelled) return;
        setBKit({
          kit: res.kit,
          colors: res.colors ?? [],
          fonts: res.fonts ?? [],
          tokens: res.tokens ?? [],
        });
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load kit B");
      })
      .finally(() => {
        if (!cancelled) setLoadingB(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bId, ownerToken, fetchKit]);

  // Keep the URL shareable.
  useEffect(() => {
    if (search.a === (aId || undefined) && search.b === (bId || undefined)) return;
    navigate({
      to: "/compare",
      search: { a: aId || undefined, b: bId || undefined },
      replace: true,
    });
  }, [aId, bId, navigate, search.a, search.b]);

  // Import real fonts for both kits so specimens render in the actual faces.
  useAutoImportFonts(
    [...(aKit?.fonts ?? []), ...(bKit?.fonts ?? [])].map((f) => ({
      family: f.family,
      source_family: f.source_family,
      google_font: f.google_font,
      weights: f.weights,
      file_urls: f.file_urls,
    })),
  );

  const analysis: Analysis | null = useMemo(() => {
    if (!aKit || !bKit) return null;
    const palette = { a: paletteScore(aKit.colors), b: paletteScore(bKit.colors) };
    const type = { a: typeScore(aKit.fonts), b: typeScore(bKit.fonts) };
    const token = { a: tokenScore(aKit.tokens), b: tokenScore(bKit.tokens) };
    const overall = {
      a: round((palette.a.score + type.a.score + token.a.score) / 3),
      b: round((palette.b.score + type.b.score + token.b.score) / 3),
    };
    return {
      palette: { ...palette, winner: pickWinner(palette.a.score, palette.b.score) },
      type: { ...type, winner: pickWinner(type.a.score, type.b.score) },
      token: { ...token, winner: pickWinner(token.a.score, token.b.score) },
      overall: { ...overall, winner: pickWinner(overall.a, overall.b) },
    };
  }, [aKit, bKit]);

  function swap() {
    const a = aId;
    setAId(bId);
    setBId(a);
  }

  const comparing = !!(aKit && bKit && aId !== bId);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10">
          <p className={eyebrow}>{"// compare"}</p>
          <h1
            className="mt-4"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 300,
              fontSize: "clamp(40px, 6vw, 72px)",
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
            }}
          >
            Two kits, side by side.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Pick two kits from your library and compare palette, typography and tokens — with
            accessibility contrast checks and a per-section verdict.
          </p>
        </div>

        {/* Pickers */}
        <div
          className="mb-10 flex flex-wrap items-end gap-4 border-y py-5"
          style={{ borderColor: "rgba(10,10,10,0.20)" }}
        >
          <SidePicker
            label="Kit A"
            kits={kits}
            value={aId}
            otherId={bId}
            onChange={setAId}
            disabled={loadingKits}
          />
          <button
            type="button"
            className={ghostBtn}
            onClick={swap}
            disabled={!aId && !bId}
            aria-label="Swap kits"
            title="Swap A and B"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            Swap
          </button>
          <SidePicker
            label="Kit B"
            kits={kits}
            value={bId}
            otherId={aId}
            onChange={setBId}
            disabled={loadingKits}
          />
          {loadingKits && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {!comparing || !aKit || !bKit ? (
          <EmptyState
            hasKits={kits.length > 0}
            loading={loadingKits}
            aId={aId}
            bId={bId}
            loadingA={loadingA}
            loadingB={loadingB}
          />
        ) : (
          <>
            {analysis && (
              <VerdictStrip
                analysis={analysis}
                aName={aKit.kit.name}
                bName={bKit.kit.name}
                aHex={kits.find((k) => k.id === aId)?.primaryHex ?? null}
                bHex={kits.find((k) => k.id === bId)?.primaryHex ?? null}
              />
            )}

            <SectionHeader
              title="01 — Palette"
              winner={analysis?.palette.winner ?? "na"}
              aName={aKit.kit.name}
              bName={bKit.kit.name}
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <PalettePanel kit={aKit} score={analysis?.palette.a} other={bKit} />
              <PalettePanel kit={bKit} score={analysis?.palette.b} other={aKit} />
            </div>
            {analysis && (
              <p className={`${mono} mt-3 text-muted-foreground`}>
                {analysis.palette.winner === "tie"
                  ? "Both palettes are equally strong."
                  : `${analysis.palette.winner === "a" ? aKit.kit.name : bKit.kit.name} wins the palette — ${
                      analysis.palette.winner === "a"
                        ? paletteReason(analysis.palette.a, analysis.palette.b)
                        : paletteReason(analysis.palette.b, analysis.palette.a)
                    }`}
              </p>
            )}

            <SectionHeader
              title="02 — Typography"
              winner={analysis?.type.winner ?? "na"}
              aName={aKit.kit.name}
              bName={bKit.kit.name}
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <TypePanel kit={aKit} score={analysis?.type.a} />
              <TypePanel kit={bKit} score={analysis?.type.b} />
            </div>
            {analysis && (
              <p className={`${mono} mt-3 text-muted-foreground`}>
                {analysis.type.winner === "tie"
                  ? "Typography is evenly matched."
                  : `${analysis.type.winner === "a" ? aKit.kit.name : bKit.kit.name} wins on typography — ${
                      analysis.type.winner === "a"
                        ? typeReason(analysis.type.a, analysis.type.b)
                        : typeReason(analysis.type.b, analysis.type.a)
                    }`}
              </p>
            )}

            <SectionHeader
              title="03 — Tokens"
              winner={analysis?.token.winner ?? "na"}
              aName={aKit.kit.name}
              bName={bKit.kit.name}
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <TokenPanel kit={aKit} score={analysis?.token.a} />
              <TokenPanel kit={bKit} score={analysis?.token.b} />
            </div>
            {analysis && (
              <p className={`${mono} mt-3 text-muted-foreground`}>
                {analysis.token.winner === "tie"
                  ? "Token systems are equally developed."
                  : `${analysis.token.winner === "a" ? aKit.kit.name : bKit.kit.name} wins on tokens — ${
                      analysis.token.winner === "a"
                        ? tokenReason(analysis.token.a, analysis.token.b)
                        : tokenReason(analysis.token.b, analysis.token.a)
                    }`}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ---------- reasons ----------

function paletteReason(w: Analysis["palette"]["a"], l: Analysis["palette"]["a"]): string {
  const parts: string[] = [];
  if (w.roleCoverage.length > l.roleCoverage.length)
    parts.push(`covers more semantic roles (${w.roleCoverage.length} vs ${l.roleCoverage.length})`);
  if ((w.bestPair?.ratio ?? 0) > (l.bestPair?.ratio ?? 0) + 0.5)
    parts.push(
      `reaches a ${round(w.bestPair?.ratio ?? 0)}:1 accessible pair vs ${round(l.bestPair?.ratio ?? 0)}:1`,
    );
  if (w.count > l.count) parts.push(`offers more colours (${w.count} vs ${l.count})`);
  if ((w.minDistinct ?? 1) > (l.minDistinct ?? 1) + 0.1)
    parts.push("its colours are easier to tell apart");
  if (!parts.length) parts.push("a slightly more balanced system overall");
  return parts.slice(0, 2).join("; ") + ".";
}

function typeReason(w: Analysis["type"]["a"], l: Analysis["type"]["a"]): string {
  const parts: string[] = [];
  if (w.roleCoverage.length > l.roleCoverage.length)
    parts.push(`covers more type roles (${w.roleCoverage.length} vs ${l.roleCoverage.length})`);
  if (w.weightCount > l.weightCount)
    parts.push(`ships more weights (${w.weightCount} vs ${l.weightCount})`);
  if (w.loadable > l.loadable) parts.push("more of its fonts are actually loadable");
  if (!parts.length) parts.push("a slightly more complete type system");
  return parts.slice(0, 2).join("; ") + ".";
}

function tokenReason(w: Analysis["token"]["a"], l: Analysis["token"]["a"]): string {
  const parts: string[] = [];
  if (w.catCoverage.length > l.catCoverage.length)
    parts.push(`spans more categories (${w.catCoverage.join(", ")})`);
  if (w.count > l.count) parts.push(`defines more tokens (${w.count} vs ${l.count})`);
  if (w.scales > l.scales) parts.push("its scales follow a more consistent progression");
  if (!parts.length) parts.push("a slightly more consistent system");
  return parts.slice(0, 2).join("; ") + ".";
}
// ---------- UI pieces ----------

function SidePicker({
  label,
  kits,
  value,
  otherId,
  onChange,
  disabled,
}: {
  label: string;
  kits: KitSummary[];
  value: string | undefined;
  otherId: string | undefined;
  onChange: (id: string | undefined) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex min-w-56 flex-1 flex-col gap-1.5">
      <span className={mono + " text-muted-foreground"}>{label}</span>
      <select
        className="h-10 w-full appearance-none rounded-none border bg-background px-3 font-mono text-[12px] text-foreground outline-none focus:border-foreground disabled:opacity-40"
        style={{ borderColor: "rgba(10,10,10,0.30)" }}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">Select a kit…</option>
        {kits.map((k) => (
          <option key={k.id} value={k.id} disabled={k.id === otherId}>
            {k.name}
            {k.id === otherId ? " (already selected)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({
  hasKits,
  loading,
  aId,
  bId,
  loadingA,
  loadingB,
}: {
  hasKits: boolean;
  loading: boolean;
  aId?: string;
  bId?: string;
  loadingA: boolean;
  loadingB: boolean;
}) {
  let msg = "Select two kits above to start the comparison.";
  if (loading) msg = "Loading your library…";
  else if (!hasKits) msg = "You have no kits yet — build one first, then come back to compare.";
  else if (aId && bId && aId === bId) msg = "Pick two different kits to compare them.";
  else if ((aId && loadingA) || (bId && loadingB)) msg = "Loading kit data…";
  return (
    <div
      className="flex flex-col items-center gap-3 border border-dashed py-24 text-center"
      style={{ borderColor: "rgba(10,10,10,0.25)" }}
    >
      {(loading || loadingA || loadingB) && (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      )}
      <p className={`${mono} text-muted-foreground`}>{msg}</p>
      {!loading && !hasKits && (
        <Link to="/" className={mono + " text-foreground underline underline-offset-4"}>
          Build your first kit
        </Link>
      )}
    </div>
  );
}

function WinnerMark({ winner, side }: { winner: Verdict; side: "a" | "b" }) {
  if (winner === side)
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground">
        <Trophy className="h-3 w-3" strokeWidth={1.5} /> Better
      </span>
    );
  if (winner === "tie")
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <Minus className="h-3 w-3" strokeWidth={1.5} /> Tie
      </span>
    );
  return null;
}

function SectionHeader({
  title,
  winner,
  aName,
  bName,
}: {
  title: string;
  winner: Verdict;
  aName: string;
  bName: string;
}) {
  return (
    <div
      className="mb-4 mt-14 flex items-baseline justify-between border-b pb-3"
      style={{ borderColor: "rgba(10,10,10,0.20)" }}
    >
      <h2 className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground">{title}</h2>
      <span className={`${mono} text-muted-foreground`}>
        {winner === "tie"
          ? "Tie"
          : winner === "na"
            ? ""
            : `Edge → ${winner === "a" ? aName : bName}`}
      </span>
    </div>
  );
}

function ScoreBadge({ score }: { score: number | undefined }) {
  if (score === undefined) return null;
  return (
    <span
      className="inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
      style={{ borderColor: "rgba(10,10,10,0.30)" }}
    >
      Score {score}
    </span>
  );
}

function PanelShell({
  kit,
  score,
  children,
}: {
  kit: FullKit;
  score: number | undefined;
  children: React.ReactNode;
}) {
  return (
    <section className="border p-5" style={{ borderColor: "rgba(10,10,10,0.20)" }}>
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/kit/$kitId"
            params={{ kitId: kit.kit.id }}
            className="truncate text-xl hover:opacity-70"
            style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 400 }}
          >
            {kit.kit.name}
          </Link>
          {kit.kit.source_url && (
            <p className={`${mono} truncate text-muted-foreground`}>
              {kit.kit.source_url.replace(/^https?:\/\//, "")}
            </p>
          )}
        </div>
        <ScoreBadge score={score} />
      </header>
      {children}
    </section>
  );
}

// ---------- palette panel ----------

function PalettePanel({
  kit,
  score,
  other,
}: {
  kit: FullKit;
  score: Analysis["palette"]["a"] | undefined;
  other: FullKit;
}) {
  const colors = uniqueColors(kit.colors).filter((c) => isValidHex(c.hex));
  const primary = colors.find((c) => (c.role ?? "").toLowerCase() === "primary") ?? colors[0];

  const wcagChecks = useMemo(() => {
    if (!primary) return [];
    return REF_COLORS.map((bg) => ({ bg, ratio: hexContrast(primary.hex, bg) })).filter(
      (x): x is { bg: string; ratio: number } => x.ratio !== null,
    );
  }, [primary]);

  const bestCross = useMemo(() => {
    if (!primary) return null;
    let best: { hex: string; ratio: number } | null = null;
    for (const c of uniqueColors(other.colors)) {
      const r = hexContrast(primary.hex, c.hex);
      if (r !== null && (!best || r > best.ratio)) best = { hex: c.hex, ratio: r };
    }
    return best;
  }, [primary, other.colors]);

  return (
    <PanelShell kit={kit} score={score?.score}>
      {colors.length === 0 ? (
        <p className={`${mono} py-8 text-center text-muted-foreground`}>No colours in this kit.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-[6px] sm:grid-cols-3">
            {colors.slice(0, 12).map((c, i) => {
              const onInk = hexContrast(c.hex, INK) ?? 0;
              const textColor = onInk >= 4.5 ? INK : PAPER;
              return (
                <div
                  key={`${c.hex}-${i}`}
                  className="flex h-16 flex-col justify-between p-2"
                  style={{ background: c.hex, border: hairline }}
                  title={`${c.name ?? c.hex}${c.role ? ` · ${c.role}` : ""}`}
                >
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.1em]"
                    style={{ color: textColor }}
                  >
                    {c.hex}
                  </span>
                  <span
                    className="truncate font-mono text-[9px] uppercase tracking-[0.08em] opacity-80"
                    style={{ color: textColor }}
                  >
                    {c.name ?? ""}
                    {c.role ? ` · ${c.role}` : ""}
                  </span>
                </div>
              );
            })}
          </div>

          {primary && (
            <div className="border-t pt-3" style={{ borderColor: "rgba(10,10,10,0.12)" }}>
              <p className={`${mono} mb-2 text-muted-foreground`}>Primary {primary.hex} on…</p>
              <div className="flex flex-wrap gap-2">
                {wcagChecks.map(({ bg, ratio }) => (
                  <span
                    key={bg}
                    className="inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em]"
                    style={{ borderColor: "rgba(10,10,10,0.20)" }}
                    title={`Contrast ${round(ratio, 2)}:1 — ${ratio >= 4.5 ? "passes WCAG AA" : ratio >= 3 ? "passes AA large text only" : "fails WCAG AA"}`}
                  >
                    <span
                      className="inline-block h-3 w-3"
                      style={{ background: bg, border: "1px solid rgba(10,10,10,0.25)" }}
                    />
                    {round(ratio)}:1
                    {ratio >= 4.5 ? (
                      <Check className="h-3 w-3" strokeWidth={2} aria-label="Passes WCAG AA" />
                    ) : null}
                  </span>
                ))}
              </div>
            </div>
          )}

          {bestCross && bestCross.ratio > 1.05 && (
            <div
              className="flex items-center gap-2 border-t pt-3"
              style={{ borderColor: "rgba(10,10,10,0.12)" }}
            >
              <span
                className="inline-flex h-6 items-center px-2 font-mono text-[10px]"
                style={{
                  background: bestCross.hex,
                  color:
                    (hexContrast(bestCross.hex, primary?.hex ?? INK) ?? 0) >= 4.5
                      ? (primary?.hex ?? INK)
                      : PAPER,
                  border: hairline,
                }}
              >
                Aa
              </span>
              <span className={`${mono} text-muted-foreground`}>
                Best cross-pair vs other kit: {round(bestCross.ratio)}:1 on {bestCross.hex}
              </span>
            </div>
          )}
        </div>
      )}
    </PanelShell>
  );
}

// ---------- typography panel ----------

function TypePanel({ kit, score }: { kit: FullKit; score: Analysis["type"]["a"] | undefined }) {
  const fonts = kit.fonts.filter((f) => f.family);
  return (
    <PanelShell kit={kit} score={score?.score}>
      {fonts.length === 0 ? (
        <p className={`${mono} py-8 text-center text-muted-foreground`}>No fonts in this kit.</p>
      ) : (
        <div className="space-y-5">
          {fonts.slice(0, 4).map((f, i) => {
            const family = renderFamilyFor(f);
            const weights = numericWeights(f.weights);
            return (
              <div
                key={`${f.family}-${i}`}
                className="border-b pb-4 last:border-0 last:pb-0"
                style={{ borderColor: "rgba(10,10,10,0.10)" }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`${mono} text-foreground`}>
                    {f.family}
                    {f.is_substitute ? " (substitute)" : ""}
                  </span>
                  <span className={`${mono} text-muted-foreground`}>
                    {f.role ?? ""}
                    {weights.length ? ` · ${weights.join("/")}` : ""}
                  </span>
                </div>
                <p
                  className="mt-2 truncate"
                  style={{
                    fontFamily: family ? `'${family}', sans-serif` : undefined,
                    fontSize: 30,
                    lineHeight: 1.15,
                    fontWeight: 400,
                  }}
                >
                  The quick brown fox jumps over the lazy dog
                </p>
                <p
                  className="truncate text-muted-foreground"
                  style={{
                    fontFamily: family ? `'${family}', sans-serif` : undefined,
                    fontSize: 14,
                    lineHeight: 1.4,
                  }}
                >
                  AaBbCcDdEeFfGg — 0123456789 — Brand voice reads clearly at text sizes.
                </p>
              </div>
            );
          })}
          {score && (
            <p className={`${mono} text-muted-foreground`}>
              {score.count} font{score.count === 1 ? "" : "s"} · roles:{" "}
              {score.roleCoverage.length ? score.roleCoverage.join(", ") : "none labelled"} ·{" "}
              {score.loadable} loadable
            </p>
          )}
        </div>
      )}
    </PanelShell>
  );
}

// ---------- token panel ----------

function TokenPanel({ kit, score }: { kit: FullKit; score: Analysis["token"]["a"] | undefined }) {
  const tokens = kit.tokens;
  const byCat = useMemo(() => {
    const map = new Map<string, TokenRow[]>();
    for (const t of tokens) {
      const cat = (t.category || "misc").toLowerCase();
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    }
    return Array.from(map.entries());
  }, [tokens]);

  return (
    <PanelShell kit={kit} score={score?.score}>
      {tokens.length === 0 ? (
        <p className={`${mono} py-8 text-center text-muted-foreground`}>No tokens in this kit.</p>
      ) : (
        <div className="space-y-5">
          {byCat.slice(0, 5).map(([cat, rows]) => (
            <div key={cat}>
              <p className={`${mono} mb-2 text-muted-foreground`}>{cat}</p>
              {cat === "radius" || cat === "radii" ? (
                <div className="flex flex-wrap items-end gap-3">
                  {rows.slice(0, 8).map((t, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-1"
                      title={`${t.name}: ${t.value}`}
                    >
                      <span
                        className="inline-block h-10 w-10 border-2 border-foreground/70"
                        style={{ borderRadius: t.value }}
                      />
                      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                        {t.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : cat === "shadow" ? (
                <div className="flex flex-wrap gap-3">
                  {rows.slice(0, 6).map((t, i) => (
                    <div
                      key={i}
                      className="flex h-12 w-20 items-center justify-center bg-background font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground"
                      style={{ boxShadow: t.value, border: hairline }}
                      title={`${t.name}: ${t.value}`}
                    >
                      {t.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {rows.slice(0, 8).map((t, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-[11px] text-foreground">{t.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{t.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {score && (
            <p className={`${mono} text-muted-foreground`}>
              {score.count} token{score.count === 1 ? "" : "s"} · categories:{" "}
              {score.catCoverage.length ? score.catCoverage.join(", ") : "custom"} · {score.scales}{" "}
              consistent scale{score.scales === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}
    </PanelShell>
  );
}

// ---------- verdict strip ----------

function VerdictStrip({
  analysis,
  aName,
  bName,
  aHex,
  bHex,
}: {
  analysis: Analysis;
  aName: string;
  bName: string;
  aHex: string | null;
  bHex: string | null;
}) {
  const rows: Array<{ label: string; a: number; b: number; winner: Verdict }> = [
    {
      label: "Palette",
      a: analysis.palette.a.score,
      b: analysis.palette.b.score,
      winner: analysis.palette.winner,
    },
    {
      label: "Typography",
      a: analysis.type.a.score,
      b: analysis.type.b.score,
      winner: analysis.type.winner,
    },
    {
      label: "Tokens",
      a: analysis.token.a.score,
      b: analysis.token.b.score,
      winner: analysis.token.winner,
    },
    {
      label: "Overall",
      a: analysis.overall.a,
      b: analysis.overall.b,
      winner: analysis.overall.winner,
    },
  ];
  return (
    <div className="border" style={{ borderColor: "rgba(10,10,10,0.25)" }}>
      <div
        className="flex items-center justify-between gap-3 border-b px-5 py-3"
        style={{ borderColor: "rgba(10,10,10,0.15)" }}
      >
        <span className={mono + " text-foreground"}>Verdict</span>
        <span className={`${mono} text-muted-foreground`}>
          {analysis.overall.winner === "tie"
            ? "Overall: tie"
            : `Overall edge → ${analysis.overall.winner === "a" ? aName : bName}`}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 px-5 py-4">
        <span
          className="truncate font-mono text-[11px] uppercase tracking-[0.12em]"
          style={{ color: aHex ?? INK }}
        >
          {aName}
        </span>
        <span />
        <span
          className="truncate text-right font-mono text-[11px] uppercase tracking-[0.12em]"
          style={{ color: bHex ?? INK }}
        >
          {bName}
        </span>

        {rows.map((r) => (
          <ScoreRow key={r.label} {...r} />
        ))}
      </div>
    </div>
  );
}

function ScoreRow({
  label,
  a,
  b,
  winner,
}: {
  label: string;
  a: number;
  b: number;
  winner: Verdict;
}) {
  const total = Math.max(a + b, 1);
  const aPct = Math.round((a / total) * 100);
  return (
    <>
      <div className="flex items-center justify-end gap-2 py-1.5">
        <WinnerMark winner={winner} side="a" />
        <span className="w-8 text-right font-mono text-[11px]">{a}</span>
      </div>
      <div className="py-1.5">
        <p className={`${mono} mb-1 text-center text-muted-foreground`}>{label}</p>
        <div
          className="flex h-1.5 w-full overflow-hidden"
          style={{ background: "rgba(10,10,10,0.08)" }}
        >
          <div style={{ width: `${aPct}%`, background: INK }} />
        </div>
      </div>
      <div className="flex items-center gap-2 py-1.5">
        <span className="w-8 font-mono text-[11px]">{b}</span>
        <WinnerMark winner={winner} side="b" />
      </div>
    </>
  );
}
