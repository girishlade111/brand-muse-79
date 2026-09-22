import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { StudioCanvas } from "./studio-canvas";
import {
  STUDIO_ASSET_META,
  STUDIO_ASSET_TYPES,
  STUDIO_COLOR_SCHEMES,
  STUDIO_LOGO_PLACEMENTS,
  STUDIO_TEMPLATES,
  STUDIO_TEMPLATE_META,
  buildStudioSVG,
  inlineStudioLogo,
  pickStudioLogo,
  studioFilename,
  svgToPngBlob,
  type StudioAssetType,
  type StudioColorScheme,
  type StudioKitAsset,
  type StudioKitColor,
  type StudioKitFont,
  type StudioLogoPlacement,
  type StudioTemplate,
} from "@/lib/studio";
import { generateBrandCopy, type BrandCopyResult } from "@/lib/studio.functions";
import { downloadBlob } from "@/lib/exports";
import { useAutoImportFonts } from "@/lib/font-loader";

type StudioSectionProps = {
  kitId?: string;
  kitName: string;
  colors: StudioKitColor[];
  fonts: StudioKitFont[];
  assets: StudioKitAsset[];
  defaultHeadline?: string;
  defaultBody?: string;
  defaultCta?: string;
};

const MONO = "'Courier Prime', 'JetBrains Mono', monospace";
const DISPLAY = "'Cormorant Garamond', Georgia, serif";

const SCHEME_LABEL: Record<StudioColorScheme, string> = {
  light: "Light",
  dark: "Dark",
  "hanko-accent": "Hanko Accent",
};

const PLACEMENT_LABEL: Record<StudioLogoPlacement, string> = {
  "top-left": "Top-left",
  centered: "Centered",
  watermark: "Watermark",
  "bottom-right": "Bottom-right",
};

function publicLogoUrl(a: StudioKitAsset): string {
  const supabaseUrl = (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_SUPABASE_URL;
  if (a.storage_path && supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/brand-assets/${a.storage_path}`;
  }
  return a.url;
}

function controlBtn(active: boolean): string {
  return active
    ? "border border-[#0A0A0A] bg-[#0A0A0A] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#F4EFE6]"
    : "border border-[rgba(10,10,10,0.25)] bg-transparent px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:border-[#0A0A0A]";
}

export function StudioSection({
  kitId,
  kitName,
  colors,
  fonts,
  assets,
  defaultHeadline,
  defaultBody,
  defaultCta,
}: StudioSectionProps) {
  useAutoImportFonts(fonts);

  const [assetType, setAssetType] = useState<StudioAssetType>("og-card");
  const [template, setTemplate] = useState<StudioTemplate>("minimalist");
  const [colorScheme, setColorScheme] = useState<StudioColorScheme>("light");
  const [logoPlacement, setLogoPlacement] = useState<StudioLogoPlacement>("top-left");
  const [headline, setHeadline] = useState(defaultHeadline || "Steal any brand.");
  const [body, setBody] = useState(
    defaultBody || "Colors. Typography. Voice. Tokens. Extracted, structured, exported.",
  );
  const [cta, setCta] = useState(defaultCta || "Explore the system");
  const [topic, setTopic] = useState("");
  const [zoom, setZoom] = useState(0.5);
  const [copy, setCopy] = useState<BrandCopyResult | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState<null | "png" | "svg">(null);

  const runCopy = useServerFn(generateBrandCopy);

  const logoUrl = useMemo(() => {
    const picked = pickStudioLogo(assets, colorScheme);
    return picked ? publicLogoUrl(picked) : null;
  }, [assets, colorScheme]);

  const svg = useMemo(
    () =>
      buildStudioSVG({
        assetType,
        template,
        colorScheme,
        logoPlacement,
        headline,
        body,
        cta,
        kitName,
        colors,
        fonts,
        logoUrl,
      }),
    [
      assetType,
      template,
      colorScheme,
      logoPlacement,
      headline,
      body,
      cta,
      kitName,
      colors,
      fonts,
      logoUrl,
    ],
  );

  async function regenerate() {
    if (!kitId) {
      toast.message("AI copy needs a saved kit — edit text by hand in preview mode.");
      return;
    }
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const res = await runCopy({
        data: { kitId, assetType, topic: topic.trim().slice(0, 300) },
      });
      setCopy(res);
      if (res.headlines[0]) setHeadline(res.headlines[0]);
      if (res.valueProps[0]) setBody(res.valueProps.join(" — "));
      if (res.ctas[0]) setCta(res.ctas[0]);
      toast.success("Copy regenerated in brand voice");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Copy generation failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function exportSvg() {
    if (exportBusy) return;
    setExportBusy("svg");
    try {
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      downloadBlob(blob, studioFilename(kitName, assetType, "svg"));
      toast.success("SVG exported");
    } finally {
      setExportBusy(null);
    }
  }

  async function exportPng() {
    if (exportBusy) return;
    setExportBusy("png");
    try {
      const meta = STUDIO_ASSET_META[assetType];
      const inlined = await inlineStudioLogo(svg, logoUrl);
      const blob = await svgToPngBlob(inlined, meta.width, meta.height, 2);
      downloadBlob(blob, studioFilename(kitName, assetType, "png"));
      toast.success("PNG exported at 2x");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PNG export failed");
    } finally {
      setExportBusy(null);
    }
  }

  function copyText(s: string) {
    navigator.clipboard.writeText(s).then(
      () => toast.success("Copied"),
      () => toast.error("Copy failed"),
    );
  }

  return (
    <div className="border border-[#0A0A0A] bg-background" style={{ borderRadius: 0 }}>
      <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
        {/* Control panel */}
        <div
          className="space-y-7 border-b border-[#0A0A0A] p-5 lg:border-b-0 lg:border-r"
          style={{ borderRadius: 0 }}
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              // 01 — asset
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {STUDIO_ASSET_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAssetType(t)}
                  className={controlBtn(assetType === t)}
                  style={{ borderRadius: 0 }}
                >
                  {assetType === t ? "[ " : ""}
                  {STUDIO_ASSET_META[t].label} — {STUDIO_ASSET_META[t].width}×
                  {STUDIO_ASSET_META[t].height}
                  {assetType === t ? " ]" : ""}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              // 02 — template
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {STUDIO_TEMPLATES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTemplate(t)}
                  className={controlBtn(template === t)}
                  style={{ borderRadius: 0 }}
                >
                  {STUDIO_TEMPLATE_META[t].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              // 03 — color scheme
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {STUDIO_COLOR_SCHEMES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setColorScheme(s)}
                  className={controlBtn(colorScheme === s)}
                  style={{ borderRadius: 0 }}
                >
                  {SCHEME_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              // 04 — logo placement
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {STUDIO_LOGO_PLACEMENTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setLogoPlacement(p)}
                  className={controlBtn(logoPlacement === p)}
                  style={{ borderRadius: 0 }}
                >
                  {PLACEMENT_LABEL[p]}
                </button>
              ))}
            </div>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {logoUrl ? "Logo variant resolved from kit assets." : "No logo in kit — text only."}
            </p>
          </div>

          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              // 05 — copy
            </p>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">Headline</span>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={120}
                spellCheck={false}
                className="mt-1 w-full border border-[#0A0A0A] bg-transparent px-3 py-2 font-mono text-[13px] outline-none"
                style={{ borderRadius: 0, fontFamily: MONO }}
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">Body</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={280}
                rows={3}
                spellCheck={false}
                className="mt-1 w-full border border-[#0A0A0A] bg-transparent px-3 py-2 font-mono text-[13px] outline-none"
                style={{ borderRadius: 0, fontFamily: MONO }}
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">CTA label</span>
              <input
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                maxLength={40}
                spellCheck={false}
                className="mt-1 w-full border border-[#0A0A0A] bg-transparent px-3 py-2 font-mono text-[13px] outline-none"
                style={{ borderRadius: 0, fontFamily: MONO }}
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
                Topic for AI copywriter
              </span>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={120}
                placeholder="e.g. launching a new pricing plan"
                spellCheck={false}
                className="mt-1 w-full border border-[rgba(10,10,10,0.25)] bg-transparent px-3 py-2 font-mono text-[13px] outline-none focus:border-[#0A0A0A]"
                style={{ borderRadius: 0, fontFamily: MONO }}
              />
            </label>
            <button
              type="button"
              onClick={regenerate}
              disabled={aiBusy}
              className="w-full border border-[#0A0A0A] bg-[#0A0A0A] px-3 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-[#F4EFE6] hover:opacity-90 disabled:opacity-50"
              style={{ borderRadius: 0, fontFamily: MONO }}
            >
              {aiBusy ? "[ WRITING… ]" : "[ AI REGENERATE COPY ]"}
            </button>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              // 06 — zoom
            </p>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Preview zoom"
                className="w-full"
              />
              <span className="font-mono text-[11px]">{Math.round(zoom * 100)}%</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              // 07 — export
            </p>
            <button
              type="button"
              onClick={exportPng}
              disabled={exportBusy !== null}
              className="w-full border border-[#0A0A0A] bg-[#0A0A0A] px-3 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-[#F4EFE6] hover:opacity-90 disabled:opacity-50"
              style={{ borderRadius: 0, fontFamily: MONO }}
            >
              {exportBusy === "png" ? "[ RENDERING… ]" : "[ EXPORT PNG · 2X ]"}
            </button>
            <button
              type="button"
              onClick={exportSvg}
              disabled={exportBusy !== null}
              className="w-full border border-[#0A0A0A] bg-transparent px-3 py-3 font-mono text-[12px] uppercase tracking-[0.18em] hover:bg-[#0A0A0A] hover:text-[#F4EFE6] disabled:opacity-50"
              style={{ borderRadius: 0, fontFamily: MONO }}
            >
              {exportBusy === "svg" ? "[ RENDERING… ]" : "[ EXPORT SVG ]"}
            </button>
          </div>
        </div>

        {/* Viewport + generated copy */}
        <div className="min-w-0 space-y-6 p-5">
          <StudioCanvas svg={svg} assetType={assetType} zoom={zoom} />

          {copy && (
            <div className="border border-[rgba(10,10,10,0.25)]" style={{ borderRadius: 0 }}>
              <div className="border-b border-[rgba(10,10,10,0.25)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                // generated copy — click to apply
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em]">Headlines</p>
                  <ul className="mt-2 space-y-2">
                    {copy.headlines.map((h, i) => (
                      <li
                        key={i}
                        className="flex items-start justify-between gap-2 border border-[rgba(10,10,10,0.2)] p-2"
                        style={{ borderRadius: 0 }}
                      >
                        <button
                          type="button"
                          onClick={() => setHeadline(h)}
                          className="text-left text-sm leading-snug"
                          style={{ fontFamily: DISPLAY }}
                        >
                          {h}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyText(h)}
                          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] underline-offset-4 hover:underline"
                          style={{ fontFamily: MONO }}
                        >
                          Copy
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em]">Value props</p>
                    <ul className="mt-2 space-y-2">
                      {copy.valueProps.map((v, i) => (
                        <li
                          key={i}
                          className="flex items-start justify-between gap-2 border border-[rgba(10,10,10,0.2)] p-2"
                          style={{ borderRadius: 0 }}
                        >
                          <span className="text-sm leading-snug">{v}</span>
                          <button
                            type="button"
                            onClick={() => setBody(copy.valueProps.join(" — "))}
                            className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] underline-offset-4 hover:underline"
                            style={{ fontFamily: MONO }}
                          >
                            Use
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em]">CTA labels</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {copy.ctas.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setCta(c)}
                          className="border border-[#0A0A0A] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em]"
                          style={{ borderRadius: 0, fontFamily: MONO }}
                        >
                          [ {c} ]
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em]">Caption</p>
                  <div
                    className="mt-2 flex items-start justify-between gap-2 border border-[rgba(10,10,10,0.2)] p-3"
                    style={{ borderRadius: 0 }}
                  >
                    <p className="text-sm leading-relaxed">{copy.caption}</p>
                    <button
                      type="button"
                      onClick={() => copyText(copy.caption)}
                      className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] underline-offset-4 hover:underline"
                      style={{ fontFamily: MONO }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
