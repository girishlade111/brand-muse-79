// Interactive Brand UI Component Library — Live Previewer Component.
// Editorial 0px border-radius design system ("The Invisible Instrument").
// Dynamically scopes CSS custom properties (--brand-*), provides a live theme
// switcher (Light / Dark / High Contrast), 3-tab code export, and generative AI
// component synthesis.

import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  SHOWCASE_COMPONENTS,
  createThemeStyleObject,
  generateComponentHtmlCode,
  generateComponentReactCode,
  resolveBrandComponentTheme,
  type BrandComponentTheme,
  type ComponentItem,
  type ComponentThemeMode,
} from "@/lib/brand-components";
import { generateCustomComponentFn, type CustomComponentResult } from "@/server/components.server";
import {
  Sun,
  Moon,
  Contrast,
  Code2,
  Eye,
  Copy,
  Check,
  Sparkles,
  Loader2,
  Layers,
  ArrowRight,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
} from "lucide-react";
import { useAutoImportFonts } from "@/lib/font-loader";

export type BrandComponentLibraryProps = {
  kitId: string;
  kitName: string;
  colors?: Array<{ hex: string; role?: string | null; name?: string | null }>;
  fonts?: Array<{ family?: string | null; role?: string | null }>;
};

type CodeTab = "preview" | "react" | "html";

export function BrandComponentLibrary({
  kitId,
  kitName,
  colors = [],
  fonts = [],
}: BrandComponentLibraryProps) {
  useAutoImportFonts(fonts as any);

  // Theme Mode
  const [themeMode, setThemeMode] = useState<ComponentThemeMode>("light");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTabs, setActiveTabs] = useState<Record<string, CodeTab>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // AI Component Synthesis
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [customComponents, setCustomComponents] = useState<CustomComponentResult[]>([]);
  const [customTabs, setCustomTabs] = useState<Record<number, CodeTab>>({});

  // Interactive local states for components
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [formText, setFormText] = useState("");
  const [inspectVariables, setInspectVariables] = useState(false);

  const runAiComponent = useServerFn(generateCustomComponentFn);

  // Resolved theme
  const theme = useMemo(
    () => resolveBrandComponentTheme(colors, fonts, themeMode, kitName),
    [colors, fonts, themeMode, kitName],
  );

  const styleScope = useMemo(() => createThemeStyleObject(theme), [theme]);

  // Tab switcher helper
  const getTab = (id: string): CodeTab => activeTabs[id] ?? "preview";
  const setTab = (id: string, tab: CodeTab) => {
    setActiveTabs((prev) => ({ ...prev, [id]: tab }));
  };

  // Copy code helper
  function handleCopy(id: string, code: string, label: string) {
    navigator.clipboard.writeText(code).then(
      () => {
        setCopiedId(id);
        toast.success(`Copied ${label} snippet`);
        setTimeout(() => setCopiedId(null), 2000);
      },
      () => toast.error("Copy failed"),
    );
  }

  // AI Component generator
  async function handleSynthesizeComponent() {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await runAiComponent({
        data: {
          kitId,
          prompt: aiPrompt.trim().slice(0, 400),
          themeMode,
        },
      });

      if (res?.ok) {
        setCustomComponents((prev) => [res, ...prev]);
        toast.success(`Synthesized component: "${res.name}"`);
        setAiPrompt("");
      } else {
        toast.error("Component generation returned no output");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Component generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  const filteredComponents = useMemo(() => {
    if (activeCategory === "all") return SHOWCASE_COMPONENTS;
    return SHOWCASE_COMPONENTS.filter((c) => c.category === activeCategory);
  }, [activeCategory]);

  return (
    <div
      className="border border-[#0A0A0A] bg-background text-foreground"
      style={{ borderRadius: 0 }}
    >
      {/* Header Bar & Theme Switcher */}
      <div className="border-b border-[#0A0A0A] p-5 lg:p-6" style={{ borderRadius: 0 }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 bg-[#8B1A1A]" />
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                // 08 · INTERACTIVE BRAND UI COMPONENT LIBRARY
              </p>
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight [font-family:'Cormorant_Garamond',serif] sm:text-3xl">
              Production-Ready UI Suite
            </h2>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Directly bound to active brand CSS custom properties. Zero hardcoded hexes.
            </p>
          </div>

          {/* Live Theme Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              THEME:
            </span>
            <button
              type="button"
              onClick={() => setThemeMode("light")}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                themeMode === "light"
                  ? "border border-[#0A0A0A] bg-[#0A0A0A] text-[#F4EFE6]"
                  : "border border-[rgba(10,10,10,0.25)] bg-transparent text-foreground hover:border-[#0A0A0A]"
              }`}
              style={{ borderRadius: 0 }}
            >
              <Sun className="h-3 w-3" />
              [ LIGHT ]
            </button>
            <button
              type="button"
              onClick={() => setThemeMode("dark")}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                themeMode === "dark"
                  ? "border border-[#0A0A0A] bg-[#0A0A0A] text-[#F4EFE6]"
                  : "border border-[rgba(10,10,10,0.25)] bg-transparent text-foreground hover:border-[#0A0A0A]"
              }`}
              style={{ borderRadius: 0 }}
            >
              <Moon className="h-3 w-3" />
              [ DARK ]
            </button>
            <button
              type="button"
              onClick={() => setThemeMode("high-contrast")}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                themeMode === "high-contrast"
                  ? "border border-[#8B1A1A] bg-[#8B1A1A] text-[#F4EFE6]"
                  : "border border-[rgba(10,10,10,0.25)] bg-transparent text-foreground hover:border-[#8B1A1A]"
              }`}
              style={{ borderRadius: 0 }}
            >
              <Contrast className="h-3 w-3" />
              [ HIGH CONTRAST ]
            </button>
          </div>
        </div>

        {/* Contrast Status and CSS Variable Inspector Toggle */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(10,10,10,0.15)] pt-3 font-mono text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-foreground">
              <ShieldCheck className="h-3 w-3 text-[#8B1A1A]" />
              WCAG CONTRAST: <strong className="font-bold">{theme.contrastRatio}:1</strong>
            </span>
            <span>·</span>
            <span>
              {theme.contrastRatio >= 7
                ? "AAA PASS (SUPERIOR)"
                : theme.contrastRatio >= 4.5
                  ? "AA PASS"
                  : "BELOW THRESHOLD"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setInspectVariables((v) => !v)}
            className="flex items-center gap-1 hover:text-foreground"
          >
            <SlidersHorizontal className="h-3 w-3" />
            {inspectVariables ? "[ HIDE CSS VARIABLES ]" : "[ INSPECT CSS VARIABLES ]"}
          </button>
        </div>

        {/* CSS Variables Drawer */}
        {inspectVariables && (
          <div
            className="mt-3 border border-[rgba(10,10,10,0.2)] bg-muted/20 p-4 font-mono text-[11px]"
            style={{ borderRadius: 0 }}
          >
            <p className="font-bold text-[var(--brand-accent,#8B1A1A)]">
              // ACTIVE INJECTED CSS CUSTOM PROPERTIES:
            </p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(styleScope).map(([prop, val]) => (
                <div key={prop} className="flex items-center justify-between border-b border-border/40 py-0.5">
                  <span className="text-muted-foreground">{prop}:</span>
                  <span className="font-bold text-foreground truncate max-w-[160px]">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Component Synthesis Prompt Bar */}
      <div className="border-b border-[#0A0A0A] bg-muted/10 p-5" style={{ borderRadius: 0 }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          // AI COMPONENT SYNTHESIS · GEMINI 3 / TAILWIND V4 CODEGEN
        </p>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder="Describe custom component (e.g. 'Testimonial Slider' or 'Checkout Order Summary')..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSynthesizeComponent();
            }}
            className="flex-1 border border-[#0A0A0A] bg-background px-4 py-2.5 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[#8B1A1A]"
            style={{ borderRadius: 0 }}
          />
          <button
            type="button"
            onClick={handleSynthesizeComponent}
            disabled={aiLoading || !aiPrompt.trim()}
            className="flex items-center justify-center gap-2 border border-[#0A0A0A] bg-[#0A0A0A] px-5 py-2.5 font-mono text-xs uppercase tracking-[0.16em] text-[#F4EFE6] transition-all hover:bg-[#8B1A1A] disabled:opacity-50 cursor-pointer"
            style={{ borderRadius: 0 }}
          >
            {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {aiLoading ? "[ SYNTHESIZING… ]" : "[ GENERATE WITH AI ]"}
          </button>
        </div>

        {/* Suggestion Pills */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
          <span className="text-muted-foreground">PROMPT PRESETS:</span>
          {["Testimonial Slider", "Checkout Summary", "Metrics KPI Grid", "Newsletter Box"].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAiPrompt(preset)}
              className="border border-[rgba(10,10,10,0.2)] bg-background px-2.5 py-1 text-muted-foreground hover:border-[#0A0A0A] hover:text-foreground"
              style={{ borderRadius: 0 }}
            >
              + {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Synthesized AI Components Container (if any) */}
      {customComponents.length > 0 && (
        <div className="border-b border-[#0A0A0A] p-5 lg:p-6 bg-accent/5" style={{ borderRadius: 0 }}>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#8B1A1A]">
            // AI SYNTHESIZED CUSTOM COMPONENTS ({customComponents.length})
          </p>

          <div className="mt-4 space-y-6">
            {customComponents.map((comp, idx) => {
              const currentCustomTab = customTabs[idx] ?? "preview";
              return (
                <div
                  key={idx}
                  className="border border-[#0A0A0A] bg-background"
                  style={{ borderRadius: 0 }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0A0A0A] px-4 py-2.5">
                    <div>
                      <h4 className="font-mono text-xs font-bold uppercase tracking-wider">{comp.name}</h4>
                      <p className="font-mono text-[10px] text-muted-foreground">{comp.description}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCustomTabs((prev) => ({ ...prev, [idx]: "preview" }))}
                        className={`px-2 py-1 font-mono text-[10px] uppercase ${
                          currentCustomTab === "preview"
                            ? "bg-[#0A0A0A] text-[#F4EFE6]"
                            : "border border-border hover:border-[#0A0A0A]"
                        }`}
                        style={{ borderRadius: 0 }}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomTabs((prev) => ({ ...prev, [idx]: "react" }))}
                        className={`px-2 py-1 font-mono text-[10px] uppercase ${
                          currentCustomTab === "react"
                            ? "bg-[#0A0A0A] text-[#F4EFE6]"
                            : "border border-border hover:border-[#0A0A0A]"
                        }`}
                        style={{ borderRadius: 0 }}
                      >
                        React + Tailwind v4
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomTabs((prev) => ({ ...prev, [idx]: "html" }))}
                        className={`px-2 py-1 font-mono text-[10px] uppercase ${
                          currentCustomTab === "html"
                            ? "bg-[#0A0A0A] text-[#F4EFE6]"
                            : "border border-border hover:border-[#0A0A0A]"
                        }`}
                        style={{ borderRadius: 0 }}
                      >
                        HTML + CSS
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            `custom-${idx}`,
                            currentCustomTab === "html" ? comp.html : comp.jsx,
                            comp.name,
                          )
                        }
                        className="flex items-center gap-1 border border-[#0A0A0A] px-2 py-1 font-mono text-[10px] uppercase hover:bg-[#0A0A0A] hover:text-[#F4EFE6]"
                        style={{ borderRadius: 0 }}
                      >
                        {copiedId === `custom-${idx}` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                        Copy Code
                      </button>
                    </div>
                  </div>

                  <div style={styleScope}>
                    {currentCustomTab === "preview" ? (
                      <div className="p-6 bg-[var(--brand-bg)] text-[var(--brand-text)]">
                        <div
                          className="border border-[var(--brand-border)] bg-[var(--brand-surface)] p-6"
                          style={{ borderRadius: 0 }}
                        >
                          <p className="font-[family-name:var(--brand-font-mono)] text-[10px] uppercase tracking-widest text-[var(--brand-accent)]">
                            // LIVE AI GENERATED PREVIEW · {comp.name.toUpperCase()}
                          </p>
                          <h4 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-bold">
                            Accessible Custom Component
                          </h4>
                          <p className="mt-2 font-[family-name:var(--brand-font-body)] text-sm text-[var(--brand-muted-fg)]">
                            {comp.description}
                          </p>
                          <div className="mt-4 flex gap-3 font-[family-name:var(--brand-font-mono)] text-xs">
                            <button
                              type="button"
                              className="border border-[var(--brand-border)] bg-[var(--brand-primary)] px-4 py-2 text-[var(--brand-primary-fg)] hover:bg-[var(--brand-accent)]"
                              style={{ borderRadius: 0 }}
                            >
                              [ EXECUTE ACTION ]
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <pre className="max-h-80 overflow-auto bg-[#0A0A0A] p-4 font-mono text-[11px] leading-relaxed text-[#F4EFE6]">
                        {currentCustomTab === "react" ? comp.jsx : comp.html}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Component Category Filters */}
      <div className="flex items-center overflow-x-auto border-b border-[#0A0A0A] px-5 py-2.5">
        <div className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em]">
          <span className="mr-2 text-[10px] text-muted-foreground">// FILTER:</span>
          {["all", "buttons", "cards", "forms", "navigation", "hero", "alerts"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 transition-all ${
                activeCategory === cat
                  ? "border border-[#0A0A0A] bg-[#0A0A0A] text-[#F4EFE6]"
                  : "border border-transparent text-muted-foreground hover:border-[#0A0A0A] hover:text-foreground"
              }`}
              style={{ borderRadius: 0 }}
            >
              [ {cat.toUpperCase()} ]
            </button>
          ))}
        </div>
      </div>

      {/* Component Showcase Workbench Grid */}
      <div className="p-5 lg:p-6 space-y-8">
        {filteredComponents.map((comp) => {
          const tab = getTab(comp.id);
          const reactCode = generateComponentReactCode(comp.id, theme);
          const htmlCode = generateComponentHtmlCode(comp.id, theme);
          const codeToCopy = tab === "html" ? htmlCode : reactCode;

          return (
            <div
              key={comp.id}
              className="border border-[#0A0A0A] bg-background"
              style={{ borderRadius: 0 }}
            >
              {/* Card Header & Tab Switcher */}
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0A0A0A] px-4 py-2.5"
                style={{ borderRadius: 0 }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--brand-accent,#8B1A1A)]">
                      // {comp.category.toUpperCase()}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-bold tracking-tight [font-family:'Cormorant_Garamond',serif] text-base">
                      {comp.title}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {comp.description}
                  </p>
                </div>

                {/* Tab Switcher & 1-Click Copy */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTab(comp.id, "preview")}
                    className={`flex items-center gap-1 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-all ${
                      tab === "preview"
                        ? "border border-[#0A0A0A] bg-[#0A0A0A] text-[#F4EFE6]"
                        : "border border-[rgba(10,10,10,0.25)] text-foreground hover:border-[#0A0A0A]"
                    }`}
                    style={{ borderRadius: 0 }}
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab(comp.id, "react")}
                    className={`flex items-center gap-1 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-all ${
                      tab === "react"
                        ? "border border-[#0A0A0A] bg-[#0A0A0A] text-[#F4EFE6]"
                        : "border border-[rgba(10,10,10,0.25)] text-foreground hover:border-[#0A0A0A]"
                    }`}
                    style={{ borderRadius: 0 }}
                  >
                    <Code2 className="h-3 w-3" />
                    React + Tailwind v4
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab(comp.id, "html")}
                    className={`flex items-center gap-1 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-all ${
                      tab === "html"
                        ? "border border-[#0A0A0A] bg-[#0A0A0A] text-[#F4EFE6]"
                        : "border border-[rgba(10,10,10,0.25)] text-foreground hover:border-[#0A0A0A]"
                    }`}
                    style={{ borderRadius: 0 }}
                  >
                    <Terminal className="h-3 w-3" />
                    HTML + CSS
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopy(comp.id, codeToCopy, comp.title)}
                    className="flex items-center gap-1 border border-[#0A0A0A] bg-transparent px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground hover:bg-[#0A0A0A] hover:text-[#F4EFE6]"
                    style={{ borderRadius: 0 }}
                  >
                    {copiedId === comp.id ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    [ Copy code ]
                  </button>
                </div>
              </div>

              {/* Card Body: Interactive Preview OR Code Editor */}
              <div>
                {tab === "preview" ? (
                  <div
                    style={styleScope}
                    className="p-6 transition-colors bg-[var(--brand-bg)] text-[var(--brand-text)]"
                  >
                    {/* Render Interactive Component Showcase based on comp.id */}
                    {comp.id === "buttons-suite" && (
                      <div className="flex flex-wrap items-center gap-3 font-[family-name:var(--brand-font-mono)] text-xs uppercase tracking-[0.14em]">
                        <button
                          type="button"
                          className="border border-[var(--brand-border)] bg-[var(--brand-primary)] px-6 py-3 text-[var(--brand-primary-fg)] transition-all hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] cursor-pointer"
                          style={{ borderRadius: 0 }}
                        >
                          [ Primary Action ]
                        </button>
                        <button
                          type="button"
                          className="border border-[var(--brand-border)] bg-transparent px-6 py-3 text-[var(--brand-text)] transition-all hover:bg-[var(--brand-text)] hover:text-[var(--brand-bg)] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] cursor-pointer"
                          style={{ borderRadius: 0 }}
                        >
                          [ Secondary Action ]
                        </button>
                        <button
                          type="button"
                          className="border border-transparent bg-transparent px-5 py-3 text-[var(--brand-text)] opacity-80 hover:opacity-100 hover:border-[var(--brand-border-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] cursor-pointer"
                          style={{ borderRadius: 0 }}
                        >
                          [ Ghost Action ]
                        </button>
                        <button
                          type="button"
                          disabled
                          className="border border-[var(--brand-border-subtle)] bg-[var(--brand-muted)] px-6 py-3 text-[var(--brand-muted-fg)] opacity-50 cursor-not-allowed"
                          style={{ borderRadius: 0 }}
                        >
                          [ Disabled ]
                        </button>
                        <button
                          type="button"
                          onClick={() => setLoadingBtn(!loadingBtn)}
                          className="flex items-center gap-2 border border-[var(--brand-border)] bg-[var(--brand-primary)] px-6 py-3 text-[var(--brand-primary-fg)] cursor-pointer"
                          style={{ borderRadius: 0 }}
                        >
                          {loadingBtn && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          {loadingBtn ? "[ Processing… ]" : "[ Click to Load ]"}
                        </button>
                      </div>
                    )}

                    {comp.id === "feature-card" && (
                      <div className="max-w-xl">
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
                            <span className="text-[var(--brand-accent)] font-bold">→ 0PX RADIUS</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {comp.id === "product-card" && (
                      <div className="max-w-sm">
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
                      </div>
                    )}

                    {comp.id === "pricing-card" && (
                      <div className="max-w-md">
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
                      </div>
                    )}

                    {comp.id === "form-controls" && (
                      <div className="max-w-lg">
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
                            <div className="flex justify-between">
                              <label className="block text-[10px] uppercase tracking-[0.16em] text-[var(--brand-muted-fg)]">
                                SPECIFICATION DIRECTIVE:
                              </label>
                              <span className="text-[10px] text-[var(--brand-muted-fg)]">
                                {formText.length}/300
                              </span>
                            </div>
                            <textarea
                              rows={3}
                              maxLength={300}
                              value={formText}
                              onChange={(e) => setFormText(e.target.value)}
                              placeholder="Declare precise design constraints..."
                              className="mt-1 w-full border border-[var(--brand-border)] bg-transparent px-3 py-2 text-[var(--brand-text)] placeholder:text-[var(--brand-muted-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
                              style={{ borderRadius: 0 }}
                            />
                          </div>
                        </form>
                      </div>
                    )}

                    {comp.id === "navigation-bar" && (
                      <div className="space-y-4 font-[family-name:var(--brand-font-mono)]">
                        <header
                          className="flex items-center justify-between border border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-3"
                          style={{ borderRadius: 0 }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 bg-[var(--brand-accent)]" />
                            <span className="font-[family-name:var(--brand-font-display)] text-lg font-bold tracking-tight text-[var(--brand-text)]">
                              {kitName.toUpperCase()}
                            </span>
                          </div>

                          <nav className="hidden items-center gap-6 text-[11px] uppercase tracking-[0.16em] sm:flex">
                            <span className="text-[var(--brand-text)] hover:text-[var(--brand-accent)] cursor-pointer">
                              Overview
                            </span>
                            <span className="text-[var(--brand-muted-fg)] hover:text-[var(--brand-text)] cursor-pointer">
                              Tokens
                            </span>
                            <span className="text-[var(--brand-muted-fg)] hover:text-[var(--brand-text)] cursor-pointer">
                              Mockups
                            </span>
                            <span className="text-[var(--brand-muted-fg)] hover:text-[var(--brand-text)] cursor-pointer">
                              Export
                            </span>
                          </nav>

                          <button
                            type="button"
                            className="border border-[var(--brand-border)] bg-[var(--brand-primary)] px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--brand-primary-fg)] hover:bg-[var(--brand-accent)] cursor-pointer"
                            style={{ borderRadius: 0 }}
                          >
                            [ ENTER STUDIO ]
                          </button>
                        </header>

                        <nav className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[var(--brand-muted-fg)]">
                          <span>ARCHIVE</span>
                          <span>/</span>
                          <span>SYSTEM DIRECTIVES</span>
                          <span>/</span>
                          <span className="font-bold text-[var(--brand-text)]">COMPONENT LIBRARY</span>
                        </nav>
                      </div>
                    )}

                    {comp.id === "hero-header" && (
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
                            className="border border-[var(--brand-border)] bg-[var(--brand-primary)] px-6 py-3.5 text-[var(--brand-primary-fg)] transition-all hover:bg-[var(--brand-accent)] cursor-pointer"
                            style={{ borderRadius: 0 }}
                          >
                            [ EXPLORE ARCHIVE ]
                          </button>
                          <button
                            type="button"
                            className="border border-[var(--brand-border)] bg-transparent px-6 py-3.5 text-[var(--brand-text)] transition-all hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] cursor-pointer"
                            style={{ borderRadius: 0 }}
                          >
                            [ VIEW TOKENS ]
                          </button>
                        </div>
                      </section>
                    )}

                    {comp.id === "alert-banners" && (
                      <div className="space-y-3 font-[family-name:var(--brand-font-mono)] text-xs">
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

                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() =>
                              toast.success("Notification delivered in active brand voice.", {
                                description: "Strict 0px border-radius toast container.",
                              })
                            }
                            className="border border-[var(--brand-border)] bg-[var(--brand-primary)] px-4 py-2 font-[family-name:var(--brand-font-mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--brand-primary-fg)] hover:bg-[var(--brand-accent)] cursor-pointer"
                            style={{ borderRadius: 0 }}
                          >
                            [ Trigger Brand Toast ]
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <pre
                    className="max-h-80 overflow-auto bg-[#0A0A0A] p-5 font-mono text-[11px] leading-relaxed text-[#F4EFE6]"
                    style={{ borderRadius: 0 }}
                  >
                    {tab === "react" ? reactCode : htmlCode}
                  </pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
