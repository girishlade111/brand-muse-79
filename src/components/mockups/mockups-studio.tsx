// Live AI Brand Mockups Studio — Interactive Workbench Studio Component.
// Editorial 0px border-radius design system ("The Invisible Instrument").
// Pairs Lovable AI Gateway generative image synthesis with a deterministic
// high-resolution SVG/Canvas compositor requiring zero AI credits.

import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  MOCKUP_CATEGORIES,
  MOCKUP_CATEGORY_META,
  MOCKUP_PRESETS,
  PRESETS_BY_CATEGORY,
  buildMockupSVG,
  cleanHexColor,
  downloadMockupBlob,
  svgToPngBlob,
  svgToWebpBlob,
  type BrandVariant,
  type MockupCategory,
  type MockupColorInput,
  type MockupFontInput,
  type MockupPreset,
} from "@/lib/mockups";
import {
  generateBrandMockupFn,
  saveMockupAssetFn,
  getKitMockupsFn,
  deleteKitMockupFn,
} from "@/lib/mockups.functions";
import {
  Share2,
  CreditCard,
  Shirt,
  Maximize2,
  LayoutDashboard,
  Download,
  Sparkles,
  Sun,
  Moon,
  ZoomIn,
  ZoomOut,
  Trash2,
  Copy,
  Save,
  Check,
  RotateCcw,
  Layers,
  Image as ImageIcon,
} from "lucide-react";
import { useAutoImportFonts } from "@/lib/font-loader";

export type MockupStudioProps = {
  kitId: string;
  kitName: string;
  colors?: MockupColorInput[];
  fonts?: MockupFontInput[];
  assets?: Array<{
    kind: string;
    url: string;
    storage_path?: string | null;
    storagePath?: string | null;
  }>;
  defaultHeadline?: string;
  defaultTagline?: string;
  defaultCta?: string;
  brandPositioning?: string | null;
  onMockupSaved?: () => void;
};

const CATEGORY_ICONS: Record<MockupCategory, React.ComponentType<{ className?: string }>> = {
  "social-media": Share2,
  stationery: CreditCard,
  merchandise: Shirt,
  outdoor: Maximize2,
  "saas-dashboard": LayoutDashboard,
};

export function MockupsStudio({
  kitId,
  kitName,
  colors = [],
  fonts = [],
  assets = [],
  defaultHeadline,
  defaultTagline,
  defaultCta,
  brandPositioning,
  onMockupSaved,
}: MockupStudioProps) {
  useAutoImportFonts(fonts as any);

  // State
  const [category, setCategory] = useState<MockupCategory>("social-media");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("instagram-square");
  const [variant, setVariant] = useState<BrandVariant>("light");
  const [mode, setMode] = useState<"deterministic" | "ai">("deterministic");

  const [headline, setHeadline] = useState(defaultHeadline || "The Invisible Instrument");
  const [tagline, setTagline] = useState(
    defaultTagline ||
      (typeof brandPositioning === "string"
        ? brandPositioning
        : "Precision architecture. Zero decorative distraction."),
  );
  const [cta, setCta] = useState(defaultCta || "Explore Identity");

  const [zoom, setZoom] = useState<number>(0.65);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState<"png" | "webp" | "svg" | "save" | null>(null);

  // Saved mockups gallery
  const [savedMockups, setSavedMockups] = useState<Array<any>>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Server functions
  const runGenerate = useServerFn(generateBrandMockupFn);
  const runSave = useServerFn(saveMockupAssetFn);
  const runFetchMockups = useServerFn(getKitMockupsFn);
  const runDeleteMockup = useServerFn(deleteKitMockupFn);

  // Synchronize preset when category changes
  useEffect(() => {
    const available = PRESETS_BY_CATEGORY[category];
    if (available && available.length > 0) {
      if (!available.some((p) => p.id === selectedPresetId)) {
        setSelectedPresetId(available[0].id);
      }
    }
  }, [category, selectedPresetId]);

  // Load saved mockups on mount
  useEffect(() => {
    let cancelled = false;
    async function loadGallery() {
      if (!kitId) return;
      setLoadingSaved(true);
      try {
        const res = await runFetchMockups({ data: { kitId } });
        if (!cancelled && res?.mockups) {
          setSavedMockups(res.mockups);
        }
      } catch (e) {
        console.warn("Could not load saved mockups", e);
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    }
    loadGallery();
    return () => {
      cancelled = true;
    };
  }, [kitId, runFetchMockups]);

  // Derived color tokens
  const primaryHex = useMemo(() => {
    const byRole = colors.find((c) => String(c.role ?? "").toLowerCase() === "primary");
    return cleanHexColor(byRole?.hex ?? colors[0]?.hex, variant === "dark" ? "#F4EFE6" : "#0A0A0A");
  }, [colors, variant]);

  const secondaryHex = useMemo(() => {
    const byRole = colors.find((c) => String(c.role ?? "").toLowerCase() === "secondary");
    return cleanHexColor(byRole?.hex ?? colors[1]?.hex, variant === "dark" ? "#EDE8DE" : "#262626");
  }, [colors, variant]);

  const bgHex = useMemo(() => {
    const byRole = colors.find((c) => String(c.role ?? "").toLowerCase() === "background");
    return cleanHexColor(byRole?.hex, variant === "dark" ? "#0A0A0A" : "#F4EFE6");
  }, [colors, variant]);

  const accentHex = useMemo(() => {
    const byRole = colors.find((c) => String(c.role ?? "").toLowerCase() === "accent");
    return cleanHexColor(byRole?.hex, "#8B1A1A");
  }, [colors]);

  const headingFont = useMemo(() => {
    const h = fonts.find((f) => /heading|display/i.test(f.role ?? ""));
    return h?.family || "Cormorant Garamond";
  }, [fonts]);

  const monoFont = useMemo(() => {
    const m = fonts.find((f) => /mono|code/i.test(f.role ?? ""));
    return m?.family || "Courier Prime";
  }, [fonts]);

  const logoUrl = useMemo(() => {
    const logo =
      assets.find((a) => /logo/i.test(a.kind)) ?? assets.find((a) => /favicon|mark/i.test(a.kind));
    return logo?.url ?? null;
  }, [assets]);

  const currentPreset: MockupPreset =
    MOCKUP_PRESETS[selectedPresetId] ?? MOCKUP_PRESETS["instagram-square"];

  // Real-time deterministic SVG mockup computation
  const svg = useMemo(() => {
    return buildMockupSVG({
      presetId: currentPreset.id,
      variant,
      kitName: kitName || "Brand Muse",
      headline,
      tagline,
      cta,
      primaryColor: primaryHex,
      secondaryColor: secondaryHex,
      backgroundColor: bgHex,
      accentColor: accentHex,
      headingFont,
      monoFont,
      logoUrl,
    });
  }, [
    currentPreset.id,
    variant,
    kitName,
    headline,
    tagline,
    cta,
    primaryHex,
    secondaryHex,
    bgHex,
    accentHex,
    headingFont,
    monoFont,
    logoUrl,
  ]);

  // AI Mockup Generation trigger
  async function handleGenerateAI() {
    if (aiGenerating) return;
    setAiGenerating(true);
    setMode("ai");

    try {
      const res = await runGenerate({
        data: {
          kitId,
          category,
          presetId: currentPreset.id,
          variant,
          customHeadline: headline,
          customTagline: tagline,
          customCta: cta,
        },
      });

      if (res?.prompt) setLastPrompt(res.prompt);

      if (res.ok && res.mode === "ai" && res.imageUrl) {
        setAiImageUrl(res.imageUrl);
        toast.success("AI Mockup synthesized and stored in brand assets.");
        // Refresh saved gallery
        runFetchMockups({ data: { kitId } }).then((g) => {
          if (g?.mockups) setSavedMockups(g.mockups);
        });
        onMockupSaved?.();
      } else if (res.fallback) {
        // Graceful fallback to deterministic compositor
        setMode("deterministic");
        setAiImageUrl(null);
        if (res.rateLimited) {
          toast.warning(
            "AI Gateway rate limit (429) encountered. Switched to deterministic studio compositor without consuming credits.",
          );
        } else {
          toast.info(res.reason || "Using deterministic studio compositor.");
        }
      }
    } catch (e: any) {
      setMode("deterministic");
      toast.error(e?.message ?? "AI synthesis failed; deterministic compositor active.");
    } finally {
      setAiGenerating(false);
    }
  }

  // Export handlers
  async function handleExportPng() {
    if (exportBusy) return;
    setExportBusy("png");
    try {
      const blob = await svgToPngBlob(svg, currentPreset.width, currentPreset.height, 2);
      downloadMockupBlob(blob, `${kitName}-${currentPreset.id}-${variant}-2x.png`);
      toast.success("PNG exported at 2x resolution");
    } catch (e: any) {
      toast.error(e?.message ?? "PNG export failed");
    } finally {
      setExportBusy(null);
    }
  }

  async function handleExportWebp() {
    if (exportBusy) return;
    setExportBusy("webp");
    try {
      const blob = await svgToWebpBlob(svg, currentPreset.width, currentPreset.height, 2);
      downloadMockupBlob(blob, `${kitName}-${currentPreset.id}-${variant}.webp`);
      toast.success("WebP exported");
    } catch (e: any) {
      toast.error(e?.message ?? "WebP export failed");
    } finally {
      setExportBusy(null);
    }
  }

  function handleExportSvg() {
    if (exportBusy) return;
    setExportBusy("svg");
    try {
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      downloadMockupBlob(blob, `${kitName}-${currentPreset.id}-${variant}.svg`);
      toast.success("SVG vector exported");
    } finally {
      setExportBusy(null);
    }
  }

  // Save current mockup to kit_assets
  async function handleSaveToKitAssets() {
    if (exportBusy) return;
    setExportBusy("save");
    try {
      const blob = await svgToPngBlob(svg, currentPreset.width, currentPreset.height, 2);
      const reader = new FileReader();
      const dataUrlPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const dataUrl = await dataUrlPromise;

      const res = await runSave({
        data: {
          kitId,
          category,
          presetId: currentPreset.id,
          imageDataUrl: dataUrl,
          width: currentPreset.width,
          height: currentPreset.height,
        },
      });

      if (res?.ok) {
        toast.success("Mockup saved to kit assets table.");
        const gallery = await runFetchMockups({ data: { kitId } });
        if (gallery?.mockups) setSavedMockups(gallery.mockups);
        onMockupSaved?.();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save mockup to kit assets");
    } finally {
      setExportBusy(null);
    }
  }

  // Delete saved mockup
  async function handleDeleteSavedMockup(assetId: string) {
    try {
      await runDeleteMockup({ data: { kitId, assetId } });
      setSavedMockups((prev) => prev.filter((m) => m.id !== assetId));
      toast.success("Mockup removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete mockup");
    }
  }

  return (
    <div
      className="border border-[#0A0A0A] bg-background text-foreground"
      style={{ borderRadius: 0 }}
    >
      {/* Top Header & Category Selector */}
      <div className="border-b border-[#0A0A0A] p-5 lg:p-6" style={{ borderRadius: 0 }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 bg-[#8B1A1A]" />
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                // 07 · LIVE BRAND MOCKUPS STUDIO
              </p>
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight [font-family:'Cormorant_Garamond',serif] sm:text-3xl">
              Photorealistic &amp; Deterministic Mockups
            </h2>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Composed live with active kit colors, typography, and company positioning. 0px
              border-radius standard.
            </p>
          </div>

          {/* Variant Toggle (Light / Dark) */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              TONE:
            </span>
            <button
              type="button"
              onClick={() => setVariant("light")}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                variant === "light"
                  ? "border border-[#0A0A0A] bg-[#0A0A0A] text-[#F4EFE6]"
                  : "border border-[rgba(10,10,10,0.25)] bg-transparent text-foreground hover:border-[#0A0A0A]"
              }`}
              style={{ borderRadius: 0 }}
            >
              <Sun className="h-3 w-3" />[ LIGHT ]
            </button>
            <button
              type="button"
              onClick={() => setVariant("dark")}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                variant === "dark"
                  ? "border border-[#0A0A0A] bg-[#0A0A0A] text-[#F4EFE6]"
                  : "border border-[rgba(10,10,10,0.25)] bg-transparent text-foreground hover:border-[#0A0A0A]"
              }`}
              style={{ borderRadius: 0 }}
            >
              <Moon className="h-3 w-3" />[ DARK ]
            </button>
          </div>
        </div>

        {/* The 5 Required Categories Selector */}
        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            // SELECT CATEGORY:
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {MOCKUP_CATEGORIES.map((catKey) => {
              const meta = MOCKUP_CATEGORY_META[catKey];
              const IconComp = CATEGORY_ICONS[catKey] ?? Layers;
              const isActive = category === catKey;
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setCategory(catKey)}
                  className={`flex flex-col items-start p-3 text-left transition-all ${
                    isActive
                      ? "border border-[#0A0A0A] bg-[#0A0A0A] text-[#F4EFE6]"
                      : "border border-[rgba(10,10,10,0.2)] bg-transparent text-foreground hover:border-[#0A0A0A]"
                  }`}
                  style={{ borderRadius: 0 }}
                >
                  <div className="flex w-full items-center justify-between">
                    <IconComp
                      className={`h-4 w-4 ${isActive ? "text-[#F4EFE6]" : "text-muted-foreground"}`}
                    />
                    {isActive && (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[#8B1A1A]">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <span className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
                    {meta.label}
                  </span>
                  <span className="mt-1 line-clamp-1 font-mono text-[9px] opacity-70">
                    {meta.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Left Control Rail, Right Canvas Viewport */}
      <div className="grid gap-0 lg:grid-cols-[340px_1fr]">
        {/* Left Control Rail */}
        <div
          className="space-y-6 border-b border-[#0A0A0A] p-5 lg:border-b-0 lg:border-r"
          style={{ borderRadius: 0 }}
        >
          {/* Preset Scenes Selector within Category */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              // 01 · SCENE PRESET
            </p>
            <div className="mt-2 space-y-1.5">
              {PRESETS_BY_CATEGORY[category]?.map((p) => {
                const isSelected = selectedPresetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPresetId(p.id);
                      setMode("deterministic");
                      setAiImageUrl(null);
                    }}
                    className={`w-full p-2.5 text-left font-mono text-[11px] uppercase tracking-[0.14em] transition-all ${
                      isSelected
                        ? "border border-[#0A0A0A] bg-[#0A0A0A] text-[#F4EFE6]"
                        : "border border-[rgba(10,10,10,0.2)] bg-transparent text-foreground hover:border-[#0A0A0A]"
                    }`}
                    style={{ borderRadius: 0 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>{p.name}</span>
                      <span className="opacity-60">{p.aspectRatio}</span>
                    </div>
                    <p className="mt-1 text-[9px] normal-case opacity-70">{p.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Engine Mode Toggle */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              // 02 · RENDERING ENGINE
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setMode("deterministic")}
                className={`p-2 text-center font-mono text-[10px] uppercase tracking-[0.12em] transition-all ${
                  mode === "deterministic"
                    ? "border border-[#0A0A0A] bg-[#0A0A0A] text-[#F4EFE6]"
                    : "border border-[rgba(10,10,10,0.2)] bg-transparent text-foreground hover:border-[#0A0A0A]"
                }`}
                style={{ borderRadius: 0 }}
              >
                Instant Vector
                <br />
                <span className="text-[9px] opacity-70">[ 0 CREDITS ]</span>
              </button>
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={aiGenerating}
                className={`p-2 text-center font-mono text-[10px] uppercase tracking-[0.12em] transition-all ${
                  mode === "ai"
                    ? "border border-[#8B1A1A] bg-[#8B1A1A] text-[#F4EFE6]"
                    : "border border-[rgba(10,10,10,0.2)] bg-transparent text-foreground hover:border-[#8B1A1A]"
                }`}
                style={{ borderRadius: 0 }}
              >
                {aiGenerating ? "Generating…" : "AI Studio"}
                <br />
                <span className="text-[9px] opacity-70">[ GEMINI ]</span>
              </button>
            </div>
          </div>

          {/* Live Copy Customization */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              // 03 · LIVE COPY &amp; EDITORIAL TEXT
            </p>
            <div className="mt-2.5 space-y-3">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Headline:
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="mt-1 w-full border border-[#0A0A0A] bg-transparent px-3 py-1.5 font-mono text-xs text-foreground focus:outline-none"
                  style={{ borderRadius: 0 }}
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Tagline / Positioning:
                </label>
                <textarea
                  rows={2}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="mt-1 w-full border border-[#0A0A0A] bg-transparent px-3 py-1.5 font-mono text-xs text-foreground focus:outline-none"
                  style={{ borderRadius: 0 }}
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Call To Action (CTA):
                </label>
                <input
                  type="text"
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  className="mt-1 w-full border border-[#0A0A0A] bg-transparent px-3 py-1.5 font-mono text-xs text-foreground focus:outline-none"
                  style={{ borderRadius: 0 }}
                />
              </div>
            </div>
          </div>

          {/* Active Brand Tokens Swatches */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              // 04 · CHROMATIC HARMONY
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="group relative">
                <div
                  className="h-8 w-8 border border-[#0A0A0A]"
                  style={{ backgroundColor: primaryHex, borderRadius: 0 }}
                />
                <span className="absolute -bottom-5 left-0 hidden font-mono text-[9px] group-hover:block">
                  {primaryHex}
                </span>
              </div>
              <div className="group relative">
                <div
                  className="h-8 w-8 border border-[#0A0A0A]"
                  style={{ backgroundColor: secondaryHex, borderRadius: 0 }}
                />
                <span className="absolute -bottom-5 left-0 hidden font-mono text-[9px] group-hover:block">
                  {secondaryHex}
                </span>
              </div>
              <div className="group relative">
                <div
                  className="h-8 w-8 border border-[#0A0A0A]"
                  style={{ backgroundColor: bgHex, borderRadius: 0 }}
                />
                <span className="absolute -bottom-5 left-0 hidden font-mono text-[9px] group-hover:block">
                  {bgHex}
                </span>
              </div>
              <div className="group relative">
                <div
                  className="h-8 w-8 border border-[#0A0A0A]"
                  style={{ backgroundColor: accentHex, borderRadius: 0 }}
                />
                <span className="absolute -bottom-5 left-0 hidden font-mono text-[9px] group-hover:block">
                  {accentHex}
                </span>
              </div>

              <div className="ml-auto text-right font-mono text-[10px] text-muted-foreground">
                <span>{headingFont}</span>
                <br />
                <span>{monoFont}</span>
              </div>
            </div>
          </div>

          {/* AI Generator CTA */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleGenerateAI}
              disabled={aiGenerating}
              className="flex w-full items-center justify-center gap-2 border border-[#0A0A0A] bg-[#0A0A0A] px-4 py-2.5 font-mono text-xs uppercase tracking-[0.16em] text-[#F4EFE6] transition-all hover:bg-[#8B1A1A] disabled:opacity-50"
              style={{ borderRadius: 0 }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiGenerating ? "[ SYNTHESIZING AI MOCKUP… ]" : "[ GENERATE WITH AI ]"}
            </button>
            <p className="mt-1 text-center font-mono text-[9px] text-muted-foreground">
              Dispatches prompt to Lovable Gateway. Auto-saves to storage.
            </p>
          </div>
        </div>

        {/* Right Canvas Viewport & Export Toolbar */}
        <div className="flex flex-col">
          {/* Canvas Sub-toolbar */}
          <div
            className="flex flex-wrap items-center justify-between border-b border-[#0A0A0A] bg-[var(--surface,#EDE8DE)]/40 px-4 py-2.5"
            style={{ borderRadius: 0 }}
          >
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <span>// {currentPreset.name}</span>
              <span>·</span>
              <span>
                {currentPreset.width} × {currentPreset.height} PX
              </span>
              <span>·</span>
              <span className="text-[#8B1A1A]">
                {mode === "ai" && aiImageUrl ? "AI SYNTHESIS" : "DETERMINISTIC COMPOSITOR"}
              </span>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.1).toFixed(2))))}
                className="border border-[#0A0A0A] p-1 font-mono text-xs hover:bg-foreground/10"
                style={{ borderRadius: 0 }}
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-10 text-center font-mono text-[10px]">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(2))))}
                className="border border-[#0A0A0A] p-1 font-mono text-xs hover:bg-foreground/10"
                style={{ borderRadius: 0 }}
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(0.65)}
                className="border border-[#0A0A0A] px-2 py-1 font-mono text-[10px] uppercase hover:bg-foreground/10"
                style={{ borderRadius: 0 }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Interactive Canvas Stage */}
          <div className="flex flex-1 items-center justify-center overflow-auto bg-[#EDE8DE] p-6 dark:bg-[#121212]">
            <div
              className="border border-[#0A0A0A] bg-background shadow-2xl transition-all"
              style={{
                borderRadius: 0,
                width: Math.round(currentPreset.width * zoom),
                maxWidth: "100%",
              }}
            >
              {mode === "ai" && aiImageUrl ? (
                <div className="relative">
                  <img
                    src={aiImageUrl}
                    alt={`${kitName} AI Mockup`}
                    className="block h-auto w-full"
                    style={{ borderRadius: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => setMode("deterministic")}
                    className="absolute right-3 top-3 border border-[#0A0A0A] bg-[#0A0A0A] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[#F4EFE6] hover:bg-[#8B1A1A]"
                    style={{ borderRadius: 0 }}
                  >
                    [ VIEW VECTOR COMPOSITOR ]
                  </button>
                </div>
              ) : (
                <div
                  className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              )}
            </div>
          </div>

          {/* Bottom Export Action Bar */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-t border-[#0A0A0A] bg-background p-4"
            style={{ borderRadius: 0 }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportPng}
                disabled={!!exportBusy}
                className="flex items-center gap-1.5 border border-[#0A0A0A] bg-transparent px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:bg-[#0A0A0A] hover:text-[#F4EFE6] disabled:opacity-50"
                style={{ borderRadius: 0 }}
              >
                <Download className="h-3 w-3" />[ PNG 2X ]
              </button>

              <button
                type="button"
                onClick={handleExportWebp}
                disabled={!!exportBusy}
                className="flex items-center gap-1.5 border border-[#0A0A0A] bg-transparent px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:bg-[#0A0A0A] hover:text-[#F4EFE6] disabled:opacity-50"
                style={{ borderRadius: 0 }}
              >
                <Download className="h-3 w-3" />[ WEBP ]
              </button>

              <button
                type="button"
                onClick={handleExportSvg}
                disabled={!!exportBusy}
                className="flex items-center gap-1.5 border border-[#0A0A0A] bg-transparent px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground hover:bg-[#0A0A0A] hover:text-[#F4EFE6] disabled:opacity-50"
                style={{ borderRadius: 0 }}
              >
                <Download className="h-3 w-3" />[ SVG ]
              </button>

              <button
                type="button"
                onClick={handleSaveToKitAssets}
                disabled={!!exportBusy}
                className="flex items-center gap-1.5 border border-[#0A0A0A] bg-[#0A0A0A] px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#F4EFE6] hover:bg-[#8B1A1A] disabled:opacity-50"
                style={{ borderRadius: 0 }}
              >
                <Save className="h-3 w-3" />[ SAVE TO KIT ASSETS ]
              </button>
            </div>

            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {currentPreset.aspectRatio} · {currentPreset.width}×{currentPreset.height}
            </div>
          </div>
        </div>
      </div>

      {/* Prompt Inspector Panel */}
      {lastPrompt && (
        <div className="border-t border-[#0A0A0A] p-4 bg-muted/20" style={{ borderRadius: 0 }}>
          <details className="cursor-pointer">
            <summary className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">
              // INSPECT GENERATIVE AI PROMPT DISPATCHED TO GATEWAY
            </summary>
            <p className="mt-2 font-mono text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap border border-[rgba(10,10,10,0.15)] p-3 bg-background">
              {lastPrompt}
            </p>
          </details>
        </div>
      )}

      {/* Saved Mockups Gallery Section */}
      <div className="border-t border-[#0A0A0A] p-5 lg:p-6" style={{ borderRadius: 0 }}>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            // SAVED BRAND MOCKUPS GALLERY ({savedMockups.length})
          </p>
          <span className="font-mono text-[10px] text-muted-foreground">
            STORAGE: BUCKET "brand-assets"
          </span>
        </div>

        {savedMockups.length === 0 ? (
          <div className="mt-4 border border-dashed border-[rgba(10,10,10,0.25)] p-8 text-center font-mono text-xs text-muted-foreground">
            No saved mockups yet. Click "[ GENERATE WITH AI ]" or "[ SAVE TO KIT ASSETS ]" to store
            mockups in your brand kit repository.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {savedMockups.map((m) => (
              <div
                key={m.id}
                className="group relative border border-[#0A0A0A] bg-background p-2 transition-all hover:border-[#8B1A1A]"
                style={{ borderRadius: 0 }}
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-muted/30">
                  <img
                    src={m.url}
                    alt="Saved Mockup"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-[10px]">
                  <span className="truncate uppercase opacity-75">{m.kind}</span>
                  <div className="flex items-center gap-1">
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="p-1 hover:text-[#8B1A1A]"
                      title="Download"
                    >
                      <Download className="h-3 w-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedMockup(m.id)}
                      className="p-1 hover:text-[#8B1A1A]"
                      title="Delete Mockup"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
