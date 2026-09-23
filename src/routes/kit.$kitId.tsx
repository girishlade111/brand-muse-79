import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { getAnonToken } from "@/lib/anon";
import { isHttpUrl } from "@/lib/utils";
import { getKit } from "@/lib/kits.functions";
import { setKitShare } from "@/lib/share.functions";
import { extractKit, generateSampleCopy, harvestMoreAssets } from "@/lib/extraction.functions";
import { generateLogoVariants, VARIANT_PRESETS } from "@/lib/logo-variants.functions";
import {
  deleteKitAsset,
  deleteKitColor,
  updateKitColor,
  updateKitColor as updateColorServerFn,
  addKitColor,
  updateKitFont,
  deleteKitFont,
  addKitFont,
  updateKitToken,
  deleteKitToken,
  addKitToken,
} from "@/lib/edits.functions";
import { fetchFontFiles, resolveGoogleFontFiles } from "@/lib/font-files.functions";
import { fetchAssetFiles } from "@/lib/asset-files.functions";
import { useAutoImportFonts, renderFamilyFor } from "@/lib/font-loader";
import { wcag, relativeLuminance, autoFixContrast } from "@/lib/color";
import {
  buildTokensJSON,
  buildCSS,
  buildTailwindTheme,
  buildTokensStudioJSON,
  buildVoiceMarkdown,
  buildBrandPDF,
  buildKitZip,
  buildShadcnGlobalsCss,
  buildTailwindConfig,
  buildFlutterTheme,
  buildReactNativeTheme,
  buildSwiftColors,
  buildFlutterBrandTheme,
  buildSwiftBrandColors,
  buildComposeColor,
  buildComposeType,
  buildReactNativeBrandTokens,
  buildDtcgTokens,
  downloadBlob,
  slug,
  buildDesignInstructionsMarkdown,
} from "@/lib/exports";
import {
  Loader2,
  Copy,
  Share2,
  Sparkles,
  Download,
  Package,
  ExternalLink,
  X,
  Pencil,
  Check,
  FileText,
  Plus,
  Smartphone,
  Globe,
  Layers,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ExtractionProgress } from "@/components/extraction-progress";
import { QuietLoader } from "@/components/quiet-loader";
import { smoothScrollTo } from "@/components/smooth-scroll";
import { StudioSection } from "@/components/studio/studio-section";
import { CvdSimulator } from "@/components/cvd-simulator";
import { ComponentSandbox } from "@/components/component-sandbox";
import { MockupsStudio } from "@/components/mockups/mockups-studio";
import { BrandComponentLibrary } from "@/components/brand-components/brand-component-library";
import { LogoVectorizerStudio } from "@/components/vectorizer/logo-vectorizer-studio";
import { GitHubSyncBadge } from "@/components/github-sync-badge";

const PENDING_EXTRACTION_PREFIX = "branddna.pendingExtraction:";

export const Route = createFileRoute("/kit/$kitId")({
  component: KitPage,
});

type KitData = Awaited<ReturnType<ReturnType<typeof useServerFn<typeof getKit>>>>;

function KitPage() {
  const { kitId } = Route.useParams();
  const { user } = useAuth();
  const fetchKit = useServerFn(getKit);
  const retryExtract = useServerFn(extractKit);
  const [data, setData] = useState<KitData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const ownerToken = user?.id ?? getAnonToken();
  const autoExtractionStarted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      try {
        const res = await fetchKit({ data: { kitId, ownerToken } });
        if (cancelled) return;
        setData(res);
        const kit = res.kit as any;
        if (kit.status === "pending" && !autoExtractionStarted.current) {
          autoExtractionStarted.current = true;
          const storageKey = `${PENDING_EXTRACTION_PREFIX}${kitId}`;
          let payload: any = null;
          try {
            const raw = sessionStorage.getItem(storageKey);
            payload = raw ? JSON.parse(raw) : null;
          } catch {
            payload = null;
          }
          if (!payload?.started) {
            setData((d) => (d ? { ...d, kit: { ...d.kit, status: "processing" } } : d));
            retryExtract({
              data: {
                kitId,
                ownerToken,
                url: payload?.url ?? kit.source_url ?? undefined,
                imageUrls: payload?.imageUrls,
                pdfTexts: payload?.pdfTexts,
              },
            }).finally(() => {
              try {
                sessionStorage.removeItem(storageKey);
              } catch {
                /* ignore */
              }
              if (!cancelled) setReloadKey((k) => k + 1);
            });
          }
        }
        if (kit.status === "processing" || kit.status === "pending") {
          pollTimer = setTimeout(load, 2000);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load kit");
      }
    }
    load();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [kitId, ownerToken, fetchKit, retryExtract, reloadKey]);

  async function retryExtraction(overrideUrl?: string) {
    let urlToUse = overrideUrl?.trim() || data?.kit?.source_url || "";
    if (urlToUse && !/^https?:\/\//i.test(urlToUse)) urlToUse = `https://${urlToUse}`;
    if (!urlToUse) {
      toast.error("This kit doesn't have a URL to retry.");
      return;
    }
    try {
      // basic URL shape check
      new URL(urlToUse);
    } catch {
      toast.error("That doesn't look like a valid URL.");
      return;
    }
    setRetrying(true);
    setData((d) => (d ? { ...d, kit: { ...d.kit, status: "processing" } } : d));
    try {
      const res = await retryExtract({
        data: { kitId, ownerToken, url: urlToUse },
      });
      if (!res.ok) throw new Error(res.error ?? "Extraction failed");
      const fresh = await fetchKit({ data: { kitId, ownerToken } });
      setData(fresh);
      setEditingUrl(false);
      toast.success("Extraction completed");
    } catch (e: any) {
      const msg = e?.message ?? "Extraction failed";
      setData((d) =>
        d
          ? { ...d, kit: { ...d.kit, status: "error", error_message: msg, source_url: urlToUse } }
          : d,
      );
      toast.error(msg);
    } finally {
      setRetrying(false);
    }
  }

  if (err) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-20">
          <FailurePanel
            eyebrow="// KIT / UNAVAILABLE"
            slug="ERR 02"
            headline="We couldn't load this kit"
            bodyLines={[err]}
            details={{ message: err }}
            primaryLabel="[ TRY AGAIN ]"
            onPrimary={() => {
              setErr(null);
              setData(null);
              setReloadKey((k) => k + 1);
            }}
          />
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-6 py-12">
          <QuietLoader label="Loading kit" />
        </main>
      </div>
    );
  }

  const kit = data.kit as any;
  const status = kit.status as string;
  const processingSince = kit.updated_at ? Date.parse(kit.updated_at) : Date.now();
  const isStalled =
    (status === "pending" || status === "processing") && Date.now() - processingSince > 90 * 1000;

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-10">
          <Link
            to="/"
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
          >
            ← New kit
          </Link>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--border-subtle)] pb-6 sm:gap-6 sm:pb-8">
            <div className="min-w-0">
              <h1 className="break-words text-4xl tracking-tight [font-family:'Cormorant_Garamond',serif] sm:text-6xl">
                {kit.name}
              </h1>
              {kit.source_url && isHttpUrl(kit.source_url) && (
                <a
                  href={kit.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block break-all font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground sm:text-xs"
                >
                  {kit.source_url}
                </a>
              )}
              {kit.source_url && !isHttpUrl(kit.source_url) && (
                <span className="mt-3 inline-block break-all font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:text-xs">
                  {kit.source_url}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <GitHubSyncBadge kitId={kit.id} kitName={kit.name} />
              <span
                className="font-mono text-[11px] uppercase tracking-[0.22em]"
                style={{ color: status === "error" ? "var(--accent)" : "var(--muted-foreground)" }}
              >
                // {status}
              </span>
            </div>
          </div>
        </div>

        {(status === "pending" || status === "processing") && !isStalled && (
          <ExtractionProgress hint={kit.source_url ? `Source: ${kit.source_url}` : undefined} />
        )}

        {(status === "error" || isStalled) && (
          <FailurePanel
            eyebrow={isStalled ? "// EXTRACTION / STALLED" : "// EXTRACTION / FAILED"}
            slug={isStalled ? "ERR 03" : "ERR 01"}
            headline={isStalled ? "Extraction stalled" : "Extraction did not complete"}
            bodyLines={
              kit.source_url
                ? [
                    isStalled
                      ? "The extraction started, then stopped reporting progress for"
                      : "We could not read a brand kit from",
                    { mono: kit.source_url as string },
                    isStalled
                      ? "Retry will restart it from this kit instead of leaving the page waiting."
                      : "The site may have blocked the request, or the page returned no usable color, type, or voice signal.",
                  ]
                : ["This kit has no source URL on file. Start a new kit to retry."]
            }
            primaryLabel={kit.source_url ? "[ RETRY EXTRACTION ]" : undefined}
            primaryBusyLabel="[ RETRYING… ]"
            onPrimary={kit.source_url ? () => retryExtraction() : undefined}
            primaryBusy={retrying}
            secondaryLabel="[ CHANGE URL ]"
            onSecondary={() => {
              setUrlDraft((kit.source_url as string) ?? "");
              setEditingUrl(true);
            }}
            urlEditor={{
              open: editingUrl,
              value: urlDraft,
              onChange: setUrlDraft,
              onSubmit: () => retryExtraction(urlDraft),
              onCancel: () => setEditingUrl(false),
              busy: retrying,
            }}
            details={{
              code: kit.error_code ?? null,
              status: kit.error_status ?? null,
              message: kit.error_message ?? null,
            }}
          />
        )}

        {status === "ready" && (
          <div className="flex gap-6 lg:gap-10">
            <KitSideNav />
            <div className="min-w-0 flex-1 space-y-12 sm:space-y-20">
              {kit.error_code === "scrape_blocked" && (
                <div className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/8 p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
                    // SOURCE / NOT READ
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {kit.error_message ??
                      "We couldn't read this site, so this kit uses generic defaults rather than its real brand."}
                  </p>
                </div>
              )}

              <QuickDownloads
                kitName={kit.name}
                colors={data.colors}
                fonts={data.fonts}
                tokens={data.tokens}
                assets={data.assets}
                voice={data.voice}
              />

              {/* Dedicated Workbench Navigation Tabs */}
              <div
                className="flex items-center overflow-x-auto border-y border-[#0A0A0A] bg-background py-2.5"
                style={{ borderRadius: 0 }}
              >
                <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em]">
                  <span className="mr-2 text-[10px] text-muted-foreground">// JUMP TO:</span>
                  {KIT_SECTIONS.map((sec) => (
                    <a
                      key={sec.id}
                      href={`#${sec.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const el = document.getElementById(sec.id);
                        if (el) {
                          smoothScrollTo(el, -96);
                          history.replaceState(null, "", `#${sec.id}`);
                        }
                      }}
                      className={`whitespace-nowrap px-3 py-1.5 transition-colors ${
                        sec.id === "mockups" || sec.id === "components" || sec.id === "vectorizer"
                          ? "border border-[#8B1A1A] bg-[#8B1A1A] font-bold text-[#F4EFE6]"
                          : "border border-[rgba(10,10,10,0.18)] bg-transparent text-muted-foreground hover:border-[#0A0A0A] hover:text-foreground"
                      }`}
                      style={{ borderRadius: 0 }}
                    >
                      {sec.id === "mockups" || sec.id === "components" || sec.id === "vectorizer"
                        ? `[ ★ ${sec.label.toUpperCase()} ]`
                        : `[ ${sec.label.toUpperCase()} ]`}
                    </a>
                  ))}
                </div>
              </div>

              <SectionAnchor id="overview" label="Overview">
                <OverviewSection assets={data.assets} colors={data.colors} fonts={data.fonts} />
              </SectionAnchor>
              <SectionAnchor id="assets" label="Logos & Assets">
                <AssetsSection
                  assets={data.assets}
                  kitId={kit.id}
                  ownerToken={ownerToken}
                  onChanged={() => setReloadKey((k) => k + 1)}
                />
              </SectionAnchor>
              <SectionAnchor id="vectorizer" label="// 02.B LOGO VECTORIZER & CLEANER STUDIO">
                <LogoVectorizerStudio
                  kitId={kit.id}
                  kitName={kit.name}
                  assets={data.assets}
                  colors={data.colors}
                  onAssetAdded={() => setReloadKey((k) => k + 1)}
                />
              </SectionAnchor>
              <SectionAnchor id="colors" label="Colors">
                <ColorsSection
                  colors={data.colors}
                  kitId={kit.id}
                  ownerToken={ownerToken}
                  isOwner={kit.user_id === (user?.id ?? "") || kit.anon_token === ownerToken}
                  onChanged={() => setReloadKey((k) => k + 1)}
                />
              </SectionAnchor>
              <SectionAnchor id="type" label="Typography">
                <div className="space-y-8">
                  <TypographyScaleSection
                    scale={(kit as any).typography_scale ?? []}
                    fonts={data.fonts}
                  />
                  <FontsSection
                    fonts={data.fonts}
                    kitId={kit.id}
                    ownerToken={ownerToken}
                    isOwner={kit.user_id === (user?.id ?? "") || kit.anon_token === ownerToken}
                    onChanged={() => setReloadKey((k) => k + 1)}
                  />
                </div>
              </SectionAnchor>
              <SectionAnchor id="tokens" label="Tokens">
                <TokensSection
                  tokens={data.tokens}
                  kitId={kit.id}
                  ownerToken={ownerToken}
                  isOwner={kit.user_id === (user?.id ?? "") || kit.anon_token === ownerToken}
                  onChanged={() => setReloadKey((k) => k + 1)}
                />
              </SectionAnchor>
              <SectionAnchor id="voice" label="Voice">
                <VoiceSection voice={data.voice} kitId={kit.id} />
              </SectionAnchor>
              <SectionAnchor id="mockups" label="// 07. LIVE AI BRAND MOCKUPS STUDIO">
                <MockupsStudio
                  kitId={kit.id}
                  kitName={kit.name}
                  colors={data.colors}
                  fonts={data.fonts}
                  assets={data.assets}
                  defaultHeadline={data.voice?.samples?.headline}
                  defaultTagline={
                    data.voice?.summary ?? ((kit as any).brandPositioning as string | undefined)
                  }
                  defaultCta={data.voice?.samples?.cta}
                  brandPositioning={(kit as any).brandPositioning as string | null}
                  onMockupSaved={() => setReloadKey((k) => k + 1)}
                />
              </SectionAnchor>
              <SectionAnchor id="components" label="// 08. INTERACTIVE BRAND UI COMPONENT LIBRARY">
                <BrandComponentLibrary
                  kitId={kit.id}
                  kitName={kit.name}
                  colors={data.colors}
                  fonts={data.fonts}
                />
              </SectionAnchor>
              <SectionAnchor id="sandbox" label="// 09. SANDBOX">
                <SandboxSection
                  kitName={kit.name}
                  colors={data.colors}
                  fonts={data.fonts}
                  assets={data.assets}
                />
              </SectionAnchor>
              {typeof kit.source_text === "string" && kit.source_text.trim() && (
                <SectionAnchor id="text" label="Source Text">
                  <SourceTextSection text={kit.source_text} />
                </SectionAnchor>
              )}
              <SectionAnchor id="export" label="Export">
                <ExportSection
                  kitId={kit.id}
                  kitName={kit.name}
                  isOwner={kit.user_id === (user?.id ?? "") || kit.anon_token === ownerToken}
                  isPublic={!!kit.is_public}
                  shareToken={kit.share_token ?? null}
                  onShareChange={(next) =>
                    setData((d) => (d ? { ...d, kit: { ...d.kit, ...next } } : d))
                  }
                  colors={data.colors}
                  fonts={data.fonts}
                  tokens={data.tokens}
                  assets={data.assets}
                  voice={data.voice}
                />
              </SectionAnchor>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function copy(s: string) {
  navigator.clipboard.writeText(s);
  toast.success("Copied");
}

const KIT_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "assets", label: "Logos & Assets" },
  { id: "vectorizer", label: "Vectorizer" },
  { id: "colors", label: "Colors" },
  { id: "type", label: "Typography" },
  { id: "tokens", label: "Tokens" },
  { id: "voice", label: "Voice" },
  { id: "mockups", label: "Mockups" },
  { id: "components", label: "Components" },
  { id: "sandbox", label: "Sandbox" },
  { id: "text", label: "Source Text" },
  { id: "export", label: "Export" },
] as const;

function SectionAnchor({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-6 border-b border-[color:var(--border-subtle)] pb-3">
        <h2 className="text-2xl tracking-tight [font-family:'Cormorant_Garamond',serif]">
          {label}
        </h2>
      </div>
      {children}
    </section>
  );
}

function SourceTextSection({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          // text read from the source · {words.toLocaleString()} words
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => copy(text)}>
            <Copy className="mr-2 h-3.5 w-3.5" /> Copy text
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Collapse" : "Expand"}
          </Button>
        </div>
      </div>
      <div
        className={`relative overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-foreground/[0.02] p-5 sm:p-6 ${
          expanded ? "" : "max-h-96"
        }`}
      >
        <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground/80">
          {text}
        </pre>
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent"
            aria-label="Expand full text"
          />
        )}
      </div>
    </div>
  );
}

function KitSideNav() {
  const [active, setActive] = useState<string>(KIT_SECTIONS[0].id);
  const lockRef = useRef<{ id: string; until: number } | null>(null);
  useEffect(() => {
    const els = KIT_SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => !!el,
    );
    if (!els.length) return;
    // Activation line should sit just below where sections land after a
    // click-scroll (target lands at ~96px from top). 200 gives a comfortable
    // buffer so the clicked section reliably wins over the previous one.
    const ACTIVATION_OFFSET = 200; // px from viewport top
    let raf = 0;
    const update = () => {
      raf = 0;
      // While a click-jump is in flight, hold the clicked section active so
      // the scroll handler doesn't briefly highlight the previous one.
      if (lockRef.current && performance.now() < lockRef.current.until) {
        setActive(lockRef.current.id);
        return;
      }
      let current = els[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top - ACTIVATION_OFFSET <= 0) {
          current = el.id;
        } else {
          break;
        }
      }
      // Bottom of page → force last section active
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = els[els.length - 1].id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <nav className="sticky top-24 hidden h-fit w-44 shrink-0 lg:block">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
        // contents
      </div>
      <ul className="space-y-1">
        {KIT_SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(s.id);
                  if (el) {
                    lockRef.current = { id: s.id, until: performance.now() + 1100 };
                    smoothScrollTo(el, -96);
                    history.replaceState(null, "", `#${s.id}`);
                    setActive(s.id);
                  }
                }}
                className={`block px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  isActive
                    ? "border-l-2 border-[#8B1A1A] bg-foreground/[0.06] text-foreground pl-2.5 font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ borderRadius: 0 }}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function OverviewSection({
  assets,
  colors,
  fonts,
}: {
  assets: any[];
  colors: any[];
  fonts: any[];
}) {
  const r2PublicUrl = (import.meta as any).env?.VITE_R2_PUBLIC_URL as string | undefined;
  const publicFor = (path: string | null | undefined) =>
    path && r2PublicUrl ? `${r2PublicUrl}/${path}` : null;
  const logoPriority = ["logo", "logo-mark", "logomark", "wordmark", "icon", "favicon"];
  const logo =
    [...assets]
      .filter((a) => logoPriority.includes(a.kind))
      .sort((a, b) => logoPriority.indexOf(a.kind) - logoPriority.indexOf(b.kind))[0] ?? null;

  const swatches = colors.slice(0, 8);
  const display =
    fonts.find((f) => f.role === "display" || f.role === "heading") ?? fonts[0] ?? null;
  const body = fonts.find((f) => f.role === "body" || f.role === "text") ?? null;

  return (
    <div className="glass flex flex-wrap items-center gap-6 rounded-2xl px-5 py-4">
      <div className="flex h-[72px] w-[140px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[color:var(--border-subtle)] bg-background/60">
        {logo ? (
          <img
            src={publicFor(logo.storage_path) ?? logo.url}
            alt="Logo"
            className="max-h-full max-w-full object-contain p-2"
          />
        ) : (
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            no logo
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-6">
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            Palette
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {swatches.length === 0 && (
              <span className="font-mono text-[10px] text-muted-foreground">—</span>
            )}
            {swatches.map((c) => (
              <button
                key={c.id}
                onClick={() => copy(c.hex)}
                title={`${c.hex}${c.role ? ` · ${c.role}` : ""}`}
                className="h-7 w-7 rounded-md border border-[color:var(--border-subtle)] transition-transform hover:-translate-y-[1px]"
                style={{ background: c.hex }}
              />
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            Type
          </div>
          <div className="mt-2 flex flex-col leading-tight">
            <span
              className="truncate text-base"
              style={display ? { fontFamily: `'${display.family}', serif` } : undefined}
            >
              {display?.family ?? "—"}
            </span>
            {body && body.family !== display?.family && (
              <span
                className="truncate text-xs text-muted-foreground"
                style={{ fontFamily: `'${body.family}', sans-serif` }}
              >
                {body.family}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickDownloads(props: {
  kitName: string;
  colors: any[];
  fonts: any[];
  tokens: any[];
  assets: any[];
  voice: any;
}) {
  const fetchFonts = useServerFn(fetchFontFiles);
  const resolveGoogleFonts = useServerFn(resolveGoogleFontFiles);
  const base = slug(props.kitName);
  const [busy, setBusy] = useState<null | "zip" | "pdf" | "md">(null);
  const fetchAssets = useServerFn(fetchAssetFiles);

  async function downloadZip() {
    setBusy("zip");
    try {
      toast.message("Building bundle…");
      const urls: string[] = [];
      for (const f of props.fonts ?? []) {
        if (f?.license !== "open") continue;
        for (const file of f.file_urls ?? []) {
          if (file?.url && urls.length < 40) urls.push(file.url);
        }
        if (
          f?.google_font &&
          f?.family &&
          (!Array.isArray(f.file_urls) || f.file_urls.length === 0) &&
          urls.length < 40
        ) {
          try {
            const r = await resolveGoogleFonts({
              data: { family: f.family, weights: f.weights ?? undefined },
            });
            for (const u of r.urls) if (urls.length < 40) urls.push(u);
          } catch {}
        }
      }
      let fontFiles: any[] = [];
      if (urls.length) {
        try {
          const r = await fetchFonts({ data: { urls } });
          fontFiles = (r.files ?? []).filter((f: any) => f.ok);
        } catch {}
      }
      let assetFiles: any[] = [];
      const assetUrls = (props.assets ?? [])
        .map((a: any) => a?.url)
        .filter((u: any): u is string => typeof u === "string")
        .slice(0, 60);
      if (assetUrls.length) {
        try {
          const r = await fetchAssets({ data: { urls: assetUrls } });
          assetFiles = (r.files ?? []).filter((f: any) => f.ok);
        } catch {}
      }
      const blob = await buildKitZip({
        name: props.kitName,
        ...props,
        fontFiles,
        assetFiles,
      });
      downloadBlob(blob, `${base}-brand-kit.zip`);
    } finally {
      setBusy(null);
    }
  }

  async function downloadPDF() {
    setBusy("pdf");
    try {
      const blob = await buildBrandPDF({ name: props.kitName, ...props });
      downloadBlob(blob, `${base}-brand-guide.pdf`);
    } finally {
      setBusy(null);
    }
  }

  function downloadDesignMd() {
    setBusy("md");
    try {
      const md = buildDesignInstructionsMarkdown({
        name: props.kitName,
        colors: props.colors,
        fonts: props.fonts,
        tokens: props.tokens,
        voice: props.voice,
      });
      const blob = new Blob([md], { type: "text/markdown" });
      downloadBlob(blob, `${base}-design.md`);
    } finally {
      setBusy(null);
    }
  }

  const items: Array<{
    key: "zip" | "pdf" | "md";
    icon: typeof Package;
    title: string;
    sub: string;
    onClick: () => void;
  }> = [
    {
      key: "zip",
      icon: Package,
      title: "Download full kit",
      sub: ".zip — tokens, css, fonts, assets",
      onClick: downloadZip,
    },
    {
      key: "pdf",
      icon: Download,
      title: "Brand guide",
      sub: ".pdf — palette, type, voice",
      onClick: downloadPDF,
    },
    {
      key: "md",
      icon: FileText,
      title: "Design instructions",
      sub: ".md — full spec for designers & AI",
      onClick: downloadDesignMd,
    },
  ];

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => {
        const Icon = it.icon;
        const loading = busy === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={it.onClick}
            disabled={!!busy}
            className={
              it.key === "zip"
                ? "group flex cursor-pointer items-center gap-3 rounded-full border border-foreground bg-foreground px-5 py-3 text-left text-background shadow-sm transition-all hover:-translate-y-0.5 hover:bg-foreground/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
                : "glass group flex cursor-pointer items-center gap-3 rounded-full px-5 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:bg-foreground/5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            }
          >
            <span
              className={
                it.key === "zip"
                  ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-background/30 bg-background/10"
                  : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-background/60"
              }
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{it.title}</span>
              <span
                className={
                  it.key === "zip"
                    ? "block truncate font-mono text-[10px] uppercase tracking-[0.18em] text-background/60"
                    : "block truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                }
              >
                {it.sub}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ColorCard({
  color,
  kitId,
  ownerToken,
  canEdit,
  onChanged,
}: {
  color: any;
  kitId?: string;
  ownerToken?: string;
  canEdit: boolean;
  onChanged?: () => void;
}) {
  const updateColor = useServerFn(updateKitColor);
  const deleteColor = useServerFn(deleteKitColor);
  const [editing, setEditing] = useState(false);
  const [hex, setHex] = useState<string>(color.hex);
  const [role, setRole] = useState<string>(color.role ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHex(color.hex);
    setRole(color.role ?? "");
  }, [color.hex, color.role]);

  async function save() {
    if (!canEdit || !kitId || !ownerToken) return;
    const cleanHex = hex.trim().toUpperCase();
    if (!/^#([0-9A-F]{6}|[0-9A-F]{8})$/.test(cleanHex)) {
      toast.error("Hex must be #RRGGBB");
      return;
    }
    setBusy(true);
    try {
      await updateColor({
        data: { kitId, ownerToken, colorId: color.id, hex: cleanHex, role: role || color.role },
      });
      setEditing(false);
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!canEdit || !kitId || !ownerToken) return;
    if (!confirm(`Delete ${color.hex}?`)) return;
    setBusy(true);
    try {
      await deleteColor({ data: { kitId, ownerToken, colorId: color.id } });
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border border-[color:var(--border-subtle)] bg-card shadow-[0_1px_0_rgba(10,10,10,0.04),0_6px_18px_-14px_rgba(10,10,10,0.18)] transition-all duration-200 hover:-translate-y-[1px] hover:border-[color:rgba(10,10,10,0.35)]">
      {canEdit && !editing && (
        <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            aria-label="Edit color"
            onClick={() => setEditing(true)}
            disabled={busy}
            className="grid h-6 w-6 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Delete color"
            onClick={remove}
            disabled={busy}
            className="grid h-6 w-6 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-[color:var(--accent)] hover:text-background disabled:opacity-50"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {editing ? (
        <>
          <label className="relative block h-16 cursor-pointer" style={{ background: hex }}>
            <input
              type="color"
              value={/^#[0-9A-F]{6}$/i.test(hex) ? hex : "#000000"}
              onChange={(e) => setHex(e.target.value.toUpperCase())}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Pick color"
            />
          </label>
          <div className="space-y-2 p-3">
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="role"
              className="w-full rounded-md border border-[color:var(--border-subtle)] bg-background px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] outline-none focus:border-[color:rgba(10,10,10,0.45)]"
            />
            <input
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              placeholder="#RRGGBB"
              spellCheck={false}
              className="w-full rounded-md border border-[color:var(--border-subtle)] bg-background px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] outline-none focus:border-[color:rgba(10,10,10,0.45)]"
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md bg-foreground font-mono text-[10px] uppercase tracking-[0.18em] text-background hover:opacity-90 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setHex(color.hex);
                  setRole(color.role ?? "");
                }}
                disabled={busy}
                className="inline-flex h-7 items-center justify-center rounded-md border border-[color:var(--border-subtle)] px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => copy(color.hex)} className="block w-full text-left">
          <div className="h-16" style={{ background: color.hex }} />
          <div className="flex items-start justify-between gap-2 p-3">
            <div className="min-w-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                {color.role}
              </div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground">
                {color.hex}
              </div>
            </div>
            <Copy className="mt-0.5 h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
          </div>
        </button>
      )}
    </div>
  );
}

function ColorsSection({
  colors,
  kitId,
  ownerToken,
  isOwner,
  onChanged,
}: {
  colors: any[];
  kitId?: string;
  ownerToken?: string;
  isOwner?: boolean;
  onChanged?: () => void;
}) {
  const canEdit = !!(isOwner && kitId && ownerToken);
  const persistFix = useServerFn(updateColorServerFn);
  // Optimistic overrides: applied instantly on 1-click fix, reconciled when
  // the parent reloads (onChanged). Reverted if the server call fails.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [fixingId, setFixingId] = useState<string | null>(null);
  if (!colors.length && !canEdit) return <Empty label="No colors extracted" />;
  const effectiveColors = colors.map((c) => (overrides[c.id] ? { ...c, hex: overrides[c.id] } : c));
  // Pick light + dark mode pairs from extracted colors so we can show pairings
  // for both surfaces. Fall back to pure white/black if extraction didn't yield
  // a sufficiently light or dark neutral.
  const sortedByLum = [...effectiveColors].sort(
    (a, b) => relativeLuminance(b.hex) - relativeLuminance(a.hex),
  );
  const lightest = sortedByLum[0]?.hex ?? "#ffffff";
  const darkest = sortedByLum[sortedByLum.length - 1]?.hex ?? "#0a0a0a";
  const lightBg = relativeLuminance(lightest) > 0.7 ? lightest : "#ffffff";
  const darkBg = relativeLuminance(darkest) < 0.15 ? darkest : "#0a0a0a";
  const lightText = darkest;
  const darkText = lightest;

  async function autoFixColor(colorId: string, currentHex: string, fixedHex: string) {
    if (!canEdit || !kitId || !ownerToken || fixingId) return;
    if (fixedHex.toUpperCase() === currentHex.toUpperCase()) {
      toast.message("Already AA compliant");
      return;
    }
    setFixingId(colorId);
    setOverrides((o) => ({ ...o, [colorId]: fixedHex }));
    try {
      await persistFix({ data: { kitId, ownerToken, colorId, hex: fixedHex } });
      toast.success(`Fixed to ${fixedHex} — passes AA`);
      onChanged?.();
    } catch (e: any) {
      setOverrides((o) => {
        const next = { ...o };
        delete next[colorId];
        return next;
      });
      toast.error(e?.message ?? "Auto-fix failed — reverted");
    } finally {
      setFixingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {effectiveColors.map((c) => (
          <ColorCard
            key={c.id}
            color={c}
            kitId={kitId}
            ownerToken={ownerToken}
            canEdit={canEdit}
            onChanged={onChanged}
          />
        ))}
        {canEdit && <AddColorCard kitId={kitId!} ownerToken={ownerToken!} onAdded={onChanged} />}
      </div>

      {effectiveColors.length > 0 && (
        <>
          <PairingTable
            label="Light mode"
            colors={effectiveColors}
            bg={lightBg}
            text={lightText}
            canFix={canEdit}
            fixingId={fixingId}
            onAutoFix={autoFixColor}
          />
          <PairingTable
            label="Dark mode"
            colors={effectiveColors}
            bg={darkBg}
            text={darkText}
            canFix={canEdit}
            fixingId={fixingId}
            onAutoFix={autoFixColor}
          />
          <div>
            <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              // color vision check
            </h3>
            <CvdSimulator colors={effectiveColors} />
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="text-foreground">
            ✓
          </span>
          Do — safe for body copy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden>~</span>
          Large only — headings / icons ≥ 24px
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="text-[color:var(--accent)]">
            ×
          </span>
          Don't — decorative use only
        </span>
      </div>
    </div>
  );
}

function AddColorCard({
  kitId,
  ownerToken,
  onAdded,
}: {
  kitId: string;
  ownerToken: string;
  onAdded?: () => void;
}) {
  const addColor = useServerFn(addKitColor);
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState("#0A0A0A");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const cleanHex = hex.trim().toUpperCase();
    if (!/^#([0-9A-F]{6}|[0-9A-F]{8})$/.test(cleanHex)) {
      toast.error("Hex must be #RRGGBB");
      return;
    }
    setBusy(true);
    try {
      await addColor({
        data: { kitId, ownerToken, hex: cleanHex, role: role.trim() || undefined },
      });
      setOpen(false);
      setHex("#0A0A0A");
      setRole("");
      onAdded?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't add color");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[color:rgba(10,10,10,0.30)] font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        <Plus className="h-4 w-4" strokeWidth={1.5} />
        Add color
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[color:var(--border-subtle)] bg-card">
      <label className="relative block h-16 cursor-pointer" style={{ background: hex }}>
        <input
          type="color"
          value={/^#[0-9A-F]{6}$/i.test(hex) ? hex : "#000000"}
          onChange={(e) => setHex(e.target.value.toUpperCase())}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Pick color"
        />
      </label>
      <div className="space-y-2 p-3">
        <Input
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          className="h-7 font-mono text-[11px]"
          aria-label="Hex value"
        />
        <Input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="role (e.g. accent)"
          className="h-7 font-mono text-[10px]"
          aria-label="Color role"
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={add}
            disabled={busy}
            className="flex-1 rounded-md bg-foreground py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-background hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-[color:var(--border-subtle)] px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function PairingTable({
  label,
  colors,
  bg,
  text,
  canFix,
  fixingId,
  onAutoFix,
}: {
  label: string;
  colors: any[];
  bg: string;
  text: string;
  canFix?: boolean;
  fixingId?: string | null;
  onAutoFix?: (colorId: string, currentHex: string, fixedHex: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {label} — pairings on {bg}
      </h3>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="hidden grid-cols-[auto_1fr_1fr] gap-x-6 gap-y-0 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground sm:grid">
          <span>Color</span>
          <span>As text on {bg}</span>
          <span>As fill behind {text} text</span>
        </div>
        {colors.map((c) => {
          const r1 = wcag(c.hex, bg).ratio;
          const r2 = wcag(c.hex, text).ratio;
          // Closest AA-compliant shade for each role, hue preserved. The fix
          // always targets the palette color so it persists via updateColorServerFn.
          const fixAsText = autoFixContrast(c.hex, bg, { adjust: "foreground", level: "AA" });
          const fixAsFill = autoFixContrast(text, c.hex, { adjust: "background", level: "AA" });
          const fixing = fixingId === c.id;
          return (
            <div
              key={c.id}
              className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm sm:grid sm:grid-cols-[auto_1fr_1fr] sm:items-center sm:gap-x-6 sm:gap-y-0"
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded" style={{ background: c.hex }} />
                <span className="font-mono text-xs">{c.hex}</span>
              </span>
              <div className="flex items-center gap-2 sm:contents">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:hidden">
                  As text
                </span>
                <PairingSample
                  ratio={r1}
                  fg={c.hex}
                  bg={bg}
                  fix={
                    canFix && onAutoFix && fixAsText
                      ? {
                          fixing,
                          fixedHex: fixAsText.hex,
                          onFix: () => onAutoFix(c.id, c.hex, fixAsText.hex),
                        }
                      : undefined
                  }
                />
              </div>
              <div className="flex items-center gap-2 sm:contents">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:hidden">
                  As fill
                </span>
                <PairingSample
                  ratio={r2}
                  fg={text}
                  bg={c.hex}
                  fix={
                    canFix && onAutoFix && fixAsFill
                      ? {
                          fixing,
                          fixedHex: fixAsFill.hex,
                          onFix: () => onAutoFix(c.id, c.hex, fixAsFill.hex),
                        }
                      : undefined
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PairingSample({
  ratio,
  fg,
  bg,
  fix,
}: {
  ratio: number;
  fg: string;
  bg: string;
  fix?: { fixedHex: string; fixing: boolean; onFix: () => void };
}) {
  // WCAG: ≥4.5 passes for body text; 3–4.5 passes for large text only; <3 fails.
  const tier = ratio >= 4.5 ? "do" : ratio >= 3 ? "large" : "dont";
  const failsAA = ratio < 4.5;
  const ringClass =
    tier === "do"
      ? "ring-2 ring-foreground/70"
      : tier === "large"
        ? "ring-1 ring-foreground/25"
        : "ring-2 ring-[color:var(--accent)]/70";
  const markClass =
    tier === "do"
      ? "bg-foreground text-background"
      : tier === "large"
        ? "bg-foreground/15 text-foreground"
        : "bg-[color:var(--accent)] text-background";
  const mark = tier === "do" ? "✓" : tier === "large" ? "~" : "×";
  const ratioLabel = `${ratio.toFixed(2)}:1`;
  return (
    <div className="inline-flex w-fit items-center gap-2">
      <div
        className={`relative flex items-center gap-2 rounded-md px-2.5 py-1.5 ${ringClass}`}
        style={{ background: bg }}
        title={`Contrast ${ratioLabel}`}
      >
        <span
          className="font-serif text-base leading-none"
          style={{ color: fg, fontFamily: "'Cormorant Garamond', 'Fraunces', serif" }}
        >
          Aa
        </span>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.14em]"
          style={{ color: fg, opacity: 0.85 }}
        >
          Sample
        </span>
      </div>
      <span
        aria-hidden
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] leading-none ${markClass}`}
      >
        {mark}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {ratioLabel}
      </span>
      {failsAA && (
        <span className="inline-flex items-center border border-[color:var(--accent)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[color:var(--accent)]">
          AA fail
        </span>
      )}
      {failsAA && fix && (
        <button
          type="button"
          onClick={fix.onFix}
          disabled={fix.fixing}
          title={`Adjust to closest compliant shade ${fix.fixedHex} (hue preserved)`}
          className="inline-flex items-center border border-foreground bg-foreground px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-background hover:opacity-90 disabled:opacity-50"
        >
          {fix.fixing ? "Fixing…" : "Fix to AA"}
        </button>
      )}
    </div>
  );
}

type ScaleRow = {
  role: string;
  font_family: string;
  font_size_px?: number | null;
  line_height?: number | null;
  letter_spacing?: string | null;
  font_weight?: number | null;
  sample_text?: string | null;
};

function TypographyScaleSection({ scale, fonts }: { scale: ScaleRow[]; fonts?: any[] }) {
  // Auto-import the actual brand fonts (Google + any discovered self-hosted
  // file_urls). Without this the scale silently falls back to serif.
  useAutoImportFonts(fonts);

  if (!Array.isArray(scale) || scale.length === 0) return null;

  // Build lookup from the kit's loadable font records. We index by both the
  // canonical loadable family ("Inter") and the original site family
  // ("TCCC Unity Head Medium") so the scale's raw font_family values resolve
  // to whatever we can actually render.
  const byName = new Map<string, any>();
  (fonts ?? []).forEach((f) => {
    if (f?.family) byName.set(String(f.family).toLowerCase(), f);
    if (f?.source_family) byName.set(String(f.source_family).toLowerCase(), f);
  });
  const headingFont =
    (fonts ?? []).find((f) => f?.role === "heading") ??
    (fonts ?? []).find((f) => f?.role === "display");
  const bodyFont = (fonts ?? []).find((f) => f?.role === "body");

  function resolveFont(role: string, rawFamily: string) {
    const match = rawFamily ? byName.get(rawFamily.toLowerCase()) : undefined;
    const roleDefault = role === "body" || role === "caption" ? bodyFont : headingFont;
    const picked = match ?? roleDefault ?? null;
    if (!picked) {
      return { renderFamily: rawFamily || "", source: rawFamily, substituted: false };
    }
    const render = renderFamilyFor(picked) ?? picked.family;
    const hasFiles = Array.isArray(picked.file_urls) && picked.file_urls.length > 0;
    return {
      renderFamily: render,
      source: picked.source_family ?? rawFamily ?? picked.family,
      substituted:
        !hasFiles &&
        (!!picked.is_substitute ||
          (!!picked.source_family &&
            picked.source_family.toLowerCase() !== picked.family.toLowerCase())),
    };
  }

  const order = ["h1", "h2", "h3", "body", "caption", "label"];
  const rows = [...scale].sort((a, b) => {
    const ai = order.indexOf(a.role);
    const bi = order.indexOf(b.role);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return (
    <div>
      <h3 className="mb-3 text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground">
        Type scale
      </h3>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((r, i) => {
          const resolved = resolveFont(r.role, r.font_family);
          const fallback = r.role === "body" || r.role === "caption" ? "sans-serif" : "serif";
          const fontFamily = resolved.renderFamily
            ? `"${resolved.renderFamily}", ${fallback}`
            : undefined;
          const sample = r.sample_text || sampleFor(r.role);
          const previewSize = Math.min(Math.max(r.font_size_px ?? defaultSize(r.role), 12), 96);
          return (
            <div
              key={`${r.role}-${i}`}
              className="grid gap-4 p-5 sm:grid-cols-[140px_1fr_220px] sm:items-baseline"
            >
              <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {r.role}
              </div>
              <div
                style={{
                  fontFamily,
                  fontSize: `${previewSize}px`,
                  lineHeight: r.line_height ?? undefined,
                  letterSpacing: r.letter_spacing ?? undefined,
                  fontWeight: r.font_weight ?? undefined,
                }}
                className="break-words text-foreground"
              >
                {sample}
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                <div className="text-foreground">{resolved.source || r.font_family || "—"}</div>
                {resolved.substituted && resolved.renderFamily && (
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    rendered as {resolved.renderFamily}
                  </div>
                )}
                <div>
                  {r.font_size_px ? `${r.font_size_px}px` : "—px"}
                  {" / "}
                  {r.line_height ?? "—"}
                  {" / "}
                  {r.font_weight ?? "—"}
                </div>
                {r.letter_spacing && <div>tracking {r.letter_spacing}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function defaultSize(role: string): number {
  switch (role) {
    case "h1":
      return 56;
    case "h2":
      return 40;
    case "h3":
      return 28;
    case "body":
      return 16;
    case "caption":
      return 13;
    case "label":
      return 12;
    default:
      return 18;
  }
}

function sampleFor(role: string): string {
  switch (role) {
    case "h1":
      return "The headline carries the brand";
    case "h2":
      return "Section heading";
    case "h3":
      return "Subsection heading";
    case "body":
      return "Body copy sets the rhythm of the page and shapes how every other element is read.";
    case "caption":
      return "Caption — supporting detail";
    case "label":
      return "LABEL TEXT";
    default:
      return "Sample";
  }
}

function FontsSection({
  fonts,
  kitId,
  ownerToken,
  isOwner,
  onChanged,
}: {
  fonts: any[];
  kitId?: string;
  ownerToken?: string;
  isOwner?: boolean;
  onChanged?: () => void;
}) {
  useAutoImportFonts(fonts);
  const canEdit = !!(isOwner && kitId && ownerToken);

  if (!fonts.length && !canEdit) return <Empty label="No fonts extracted" />;
  return (
    <div className="grid gap-4">
      {fonts.map((f) => (
        <FontCard
          key={f.id}
          font={f}
          kitId={kitId}
          ownerToken={ownerToken}
          canEdit={canEdit}
          onChanged={onChanged}
        />
      ))}
      {canEdit && <AddFontCard kitId={kitId!} ownerToken={ownerToken!} onAdded={onChanged} />}
    </div>
  );
}

function FontCard({
  font: f,
  kitId,
  ownerToken,
  canEdit,
  onChanged,
}: {
  font: any;
  kitId?: string;
  ownerToken?: string;
  canEdit?: boolean;
  onChanged?: () => void;
}) {
  const fallback = f.role === "mono" ? "monospace" : "sans-serif";
  const updateFont = useServerFn(updateKitFont);
  const deleteFont = useServerFn(deleteKitFont);
  const [editing, setEditing] = useState(false);
  const [familyDraft, setFamilyDraft] = useState<string>(f.family ?? "");
  const [roleDraft, setRoleDraft] = useState<string>(f.role ?? "");
  const [weightsDraft, setWeightsDraft] = useState<string>(
    Array.isArray(f.weights) ? f.weights.join(", ") : "",
  );
  const [editBusy, setEditBusy] = useState(false);

  useEffect(() => {
    setFamilyDraft(f.family ?? "");
    setRoleDraft(f.role ?? "");
    setWeightsDraft(Array.isArray(f.weights) ? f.weights.join(", ") : "");
  }, [f.family, f.role, f.weights]);

  async function saveFont() {
    if (!canEdit || !kitId || !ownerToken) return;
    const fam = familyDraft.trim();
    if (!fam) {
      toast.error("Family is required");
      return;
    }
    const weights = weightsDraft
      .split(/[,\s]+/)
      .map((w) => w.replace(/[^0-9]/g, ""))
      .filter(Boolean)
      .slice(0, 12);
    setEditBusy(true);
    try {
      await updateFont({
        data: {
          kitId,
          ownerToken,
          fontId: f.id,
          family: fam,
          role: roleDraft.trim() || f.role,
          weights,
        },
      });
      setEditing(false);
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save font");
    } finally {
      setEditBusy(false);
    }
  }

  async function removeFont() {
    if (!canEdit || !kitId || !ownerToken) return;
    if (!confirm(`Delete font "${f.family}"?`)) return;
    setEditBusy(true);
    try {
      await deleteFont({ data: { kitId, ownerToken, fontId: f.id } });
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't delete font");
    } finally {
      setEditBusy(false);
    }
  }

  const directFileCount = Array.isArray(f.file_urls) ? f.file_urls.length : 0;
  // Google Fonts can be downloaded on-demand via the css2 API even when no
  // file_urls were captured at extraction time.
  const canDownload = directFileCount > 0 || (!!f.google_font && !!f.family);
  const fileCount = directFileCount;
  const previewFamily = renderFamilyFor(f) ?? f.family;
  // Some sites expose CSS variables (e.g. `var(--default-mono-font-family`)
  // as the font family. Fall back to a clean role-based label in that case.
  const isCssExpr = /^(var\(|--|calc\(|env\()/i.test(String(previewFamily ?? "").trim());
  const previewLabel = isCssExpr
    ? `System ${f.role ? f.role.charAt(0).toUpperCase() + f.role.slice(1) : "Default"}`
    : previewFamily;
  const importedOriginal = directFileCount > 0 && f.source_family && f.is_substitute;
  const license: string | null = f.license ?? null;
  const isSub = !!f.is_substitute;
  const provider: string | null = f.provider ?? null;
  const fetchFiles = useServerFn(fetchFontFiles);
  const resolveGoogle = useServerFn(resolveGoogleFontFiles);
  const [downloading, setDownloading] = useState(false);

  const licenseTone =
    license === "open"
      ? "border-[color:var(--border-subtle)] text-foreground"
      : license === "commercial"
        ? "border-[color:rgba(139,26,26,0.4)] text-[color:var(--accent)]"
        : "border-[color:var(--border-subtle)] text-muted-foreground";

  const licenseLabel =
    license === "open"
      ? "OPEN LICENSE"
      : license === "commercial"
        ? "COMMERCIAL"
        : license === "unknown"
          ? "LICENSE UNKNOWN"
          : null;

  // Where the user can legitimately get this font.
  const googleHref =
    f.google_font && f.family
      ? `https://fonts.google.com/specimen/${encodeURIComponent(
          String(f.family).replace(/\s+/g, "+"),
        )}`
      : null;
  const externalHref =
    f.provider_url && isHttpUrl(f.provider_url) ? f.provider_url : (googleHref ?? null);

  // License notice shown inside the tooltip.
  const licenseNotice = (() => {
    if (license === "open")
      return f.license_note
        ? `Open license — ${f.license_note}. Always verify usage terms with the foundry.`
        : "Open license (typically OFL/Apache). Free to use; verify the specific terms before redistribution.";
    if (license === "commercial")
      return f.license_note
        ? `Commercial license required — ${f.license_note}. Purchase from the foundry before use.`
        : "Commercial font. You must purchase a license from the foundry before using or distributing it.";
    return f.license_note
      ? `License unknown — ${f.license_note}. Verify rights before any commercial use.`
      : "License is unknown. Check the foundry or source page before commercial use.";
  })();

  async function downloadFiles() {
    if (!canDownload || downloading) return;
    setDownloading(true);
    try {
      let urls: string[] =
        directFileCount > 0
          ? f.file_urls
              .slice(0, 40)
              .map((u: any) => u.url)
              .filter(Boolean)
          : [];
      if (urls.length === 0 && f.google_font && f.family) {
        const r = await resolveGoogle({
          data: { family: f.family, weights: f.weights ?? undefined },
        });
        urls = r.urls;
      }
      if (urls.length === 0) return;
      const res = await fetchFiles({ data: { urls } });
      const safeFamily = String(f.family || "font").replace(/[^a-z0-9]+/gi, "-");
      const okFiles = res.files.filter((file) => file.ok && file.base64);
      if (okFiles.length === 0) return;
      const extOf = (ct?: string) => {
        const c = ct ?? "";
        if (c.includes("woff2")) return "woff2";
        if (c.includes("woff")) return "woff";
        if (c.includes("ttf") || c.includes("truetype")) return "ttf";
        if (c.includes("otf")) return "otf";
        return "font";
      };
      const decode = (b64: string) => {
        let bin: string;
        try {
          bin = atob(b64);
        } catch {
          throw new Error("Download failed — corrupted font data.");
        }
        const bytes = new Uint8Array(bin.length);
        for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
        return bytes;
      };
      // Single file → direct download. Multiple files → bundle into one zip
      // so the browser only shows ONE save dialog (cancelling no longer
      // surfaces the next file's prompt).
      let blob: Blob;
      let filename: string;
      if (okFiles.length === 1) {
        const file = okFiles[0]!;
        blob = new Blob([decode(file.base64!)], { type: file.contentType ?? "font/woff2" });
        filename = `${safeFamily}.${extOf(file.contentType)}`;
      } else {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        okFiles.forEach((file, i) => {
          zip.file(`${safeFamily}-${i + 1}.${extOf(file.contentType)}`, decode(file.base64!));
        });
        blob = await zip.generateAsync({ type: "blob" });
        filename = `${safeFamily}.zip`;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      const { toast } = await import("sonner");
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            {f.role}
          </div>
          <div
            className="mt-1 truncate text-xl sm:text-2xl"
            style={{ fontFamily: `"${previewFamily}", ${fallback}` }}
          >
            {previewLabel}
          </div>
          {importedOriginal ? (
            <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              auto-imported from source
            </div>
          ) : isSub && f.source_family ? (
            <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              substitute for <span className="text-foreground">{f.source_family}</span>
            </div>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
          {licenseLabel && (
            <span
              className={`inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${licenseTone}`}
            >
              {licenseLabel}
            </span>
          )}
          {provider && provider !== "unknown" && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border-subtle)] bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {provider.replace("-", " ")}
            </span>
          )}
          {fileCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border-subtle)] bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {fileCount} file{fileCount === 1 ? "" : "s"}
            </span>
          )}
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                {canDownload ? (
                  <button
                    type="button"
                    onClick={downloadFiles}
                    disabled={downloading}
                    aria-label={`Download ${f.family} font files`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border-subtle)] bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-60"
                  >
                    {downloading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    {downloading ? "fetching" : "download"}
                  </button>
                ) : externalHref ? (
                  <a
                    href={externalHref}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`Get ${f.family} from ${license === "commercial" ? "foundry" : "source"}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border-subtle)] bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground hover:bg-foreground hover:text-background transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {license === "commercial" ? "buy" : "get"}
                  </a>
                ) : (
                  <span
                    aria-label="No download source"
                    className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border-subtle)] bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground opacity-60"
                  >
                    <Download className="h-3 w-3" />
                    n/a
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-left">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] mb-1">
                  {licenseLabel ?? "License"}
                </div>
                <div className="text-xs leading-snug">{licenseNotice}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {canEdit && !editing && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit font"
                disabled={editBusy}
                className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border-subtle)] bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-60"
              >
                <Pencil className="h-3 w-3" />
                edit
              </button>
              <button
                type="button"
                onClick={removeFont}
                aria-label="Delete font"
                disabled={editBusy}
                className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border-subtle)] bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-[color:var(--accent)] hover:border-[color:rgba(139,26,26,0.4)] transition-colors disabled:opacity-60"
              >
                <X className="h-3 w-3" />
                delete
              </button>
            </>
          )}
        </div>
      </div>

      {canEdit && editing && (
        <div className="mt-4 space-y-2 rounded-lg border border-[color:var(--border-subtle)] bg-background p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              value={familyDraft}
              onChange={(e) => setFamilyDraft(e.target.value)}
              className="h-8 font-mono text-[11px]"
              aria-label="Font family"
              placeholder="Family (e.g. Inter)"
            />
            <Input
              value={roleDraft}
              onChange={(e) => setRoleDraft(e.target.value)}
              className="h-8 font-mono text-[11px]"
              aria-label="Font role"
              placeholder="role (e.g. body)"
            />
            <Input
              value={weightsDraft}
              onChange={(e) => setWeightsDraft(e.target.value)}
              className="h-8 font-mono text-[11px]"
              aria-label="Font weights"
              placeholder="weights (e.g. 400, 700)"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveFont}
              disabled={editBusy}
              className="rounded-md bg-foreground px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-background hover:opacity-90 disabled:opacity-50"
            >
              {editBusy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-[color:var(--border-subtle)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div
        className="mt-5 break-words text-2xl leading-tight sm:text-3xl md:text-4xl"
        style={{ fontFamily: `"${f.family}", ${fallback}` }}
      >
        The quick brown fox jumps over the lazy dog
      </div>

      {f.weights?.length > 0 && (
        <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          weights — {f.weights.join(" / ")}
        </div>
      )}

      {(f.license_note || f.provider_url) && (
        <div className="mt-4 border-t border-[color:var(--border-subtle)] pt-3 text-[12px] [font-family:'Libre_Baskerville',serif] text-muted-foreground">
          {f.license_note}
          {f.provider_url && isHttpUrl(f.provider_url) && (
            <>
              {f.license_note ? " " : ""}
              <a
                href={f.provider_url}
                target="_blank"
                rel="noreferrer noopener"
                className="ml-1 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground underline-offset-4 hover:underline"
              >
                [ {license === "commercial" ? "buy / license" : "view source"} ]
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AddFontCard({
  kitId,
  ownerToken,
  onAdded,
}: {
  kitId: string;
  ownerToken: string;
  onAdded?: () => void;
}) {
  const addFont = useServerFn(addKitFont);
  const [open, setOpen] = useState(false);
  const [family, setFamily] = useState("");
  const [role, setRole] = useState("");
  const [weights, setWeights] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const fam = family.trim();
    if (!fam) {
      toast.error("Family is required");
      return;
    }
    const cleanWeights = weights
      .split(/[,\s]+/)
      .map((w) => w.replace(/[^0-9]/g, ""))
      .filter(Boolean)
      .slice(0, 12);
    setBusy(true);
    try {
      await addFont({
        data: {
          kitId,
          ownerToken,
          family: fam,
          role: role.trim() || undefined,
          weights: cleanWeights,
        },
      });
      setOpen(false);
      setFamily("");
      setRole("");
      setWeights("");
      onAdded?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't add font");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[color:rgba(10,10,10,0.30)] p-5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        <Plus className="h-4 w-4" strokeWidth={1.5} />
        Add font
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[color:var(--border-subtle)] bg-card p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          value={family}
          onChange={(e) => setFamily(e.target.value)}
          className="h-8 font-mono text-[11px]"
          aria-label="Font family"
          placeholder="Family (e.g. Inter)"
        />
        <Input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-8 font-mono text-[11px]"
          aria-label="Font role"
          placeholder="role (e.g. body)"
        />
        <Input
          value={weights}
          onChange={(e) => setWeights(e.target.value)}
          className="h-8 font-mono text-[11px]"
          aria-label="Font weights"
          placeholder="weights (e.g. 400, 700)"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="rounded-md bg-foreground px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-background hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-[color:var(--border-subtle)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AssetsSection({
  assets,
  kitId,
  ownerToken,
  onChanged,
}: {
  assets: any[];
  kitId: string;
  ownerToken: string;
  onChanged: () => void;
}) {
  const r2PublicUrl = (import.meta as any).env?.VITE_R2_PUBLIC_URL as string | undefined;
  const publicFor = (path: string | null | undefined) =>
    path && r2PublicUrl ? `${r2PublicUrl}/${path}` : null;

  const generate = useServerFn(generateLogoVariants);
  const [busy, setBusy] = useState<string | null>(null); // assetId currently generating
  const [busyKinds, setBusyKinds] = useState<string[]>([]);
  const [busyAll, setBusyAll] = useState(false);
  const harvest = useServerFn(harvestMoreAssets);
  const [harvesting, setHarvesting] = useState(false);
  const removeAsset = useServerFn(deleteKitAsset);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(assetId: string, label: string) {
    if (deleting) return;
    if (!confirm(`Delete "${label}"? This can't be undone.`)) return;
    setDeleting(assetId);
    try {
      await removeAsset({ data: { kitId, ownerToken, assetId } });
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't delete");
    } finally {
      setDeleting(null);
    }
  }

  async function findMore() {
    if (harvesting) return;
    setHarvesting(true);
    try {
      const res = await harvest({ data: { kitId, ownerToken } });
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't scan for more assets");
      } else if (res.added === 0) {
        toast("No new assets found");
      } else {
        toast.success(`Found ${res.added} new asset${res.added === 1 ? "" : "s"}`);
        onChanged();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Scan failed");
    } finally {
      setHarvesting(false);
    }
  }

  // Prefer assets that are cached in our own storage — original remote URLs
  // (e.g. www.starbucks.com/next_static/...) frequently 404 by the time the
  // user clicks Generate, which would fail with "Could not load source".
  const logoCandidates = assets.filter((a) => /logo/i.test(a.kind ?? ""));
  const sourceLogo =
    logoCandidates.find((a) => a.kind === "logo" && a.storage_path) ??
    logoCandidates.find((a) => a.storage_path) ??
    logoCandidates.find((a) => a.kind === "logo") ??
    logoCandidates[0];
  const existingKinds = new Set<string>(assets.map((a) => a.kind));
  const allVariantKeys = Object.keys(VARIANT_PRESETS) as Array<keyof typeof VARIANT_PRESETS>;
  const missingVariants = allVariantKeys.filter((k) => !existingKinds.has(k));

  async function runVariants(
    assetId: string,
    variants: Array<keyof typeof VARIANT_PRESETS>,
    isAll = false,
  ) {
    if (!variants.length) return;
    setBusy(assetId);
    setBusyKinds(variants as string[]);
    setBusyAll(isAll);
    try {
      const res = await generate({ data: { kitId, assetId, ownerToken, variants } });
      const okCount = res.results.filter((r) => r.ok).length;
      const failed = res.results.filter((r) => !r.ok);
      if (okCount) toast.success(`Generated ${okCount} variant${okCount === 1 ? "" : "s"}`);
      for (const f of failed) toast.error(`${f.kind}: ${f.error ?? "failed"}`);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
    } finally {
      setBusy(null);
      setBusyKinds([]);
      setBusyAll(false);
    }
  }

  if (!assets.length) {
    return (
      <div className="space-y-4">
        <Empty label="No assets found" />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={findMore}
            disabled={harvesting}
            className="glass inline-flex items-center gap-2 rounded-full px-5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {harvesting && <Loader2 className="h-3 w-3 animate-spin" />}
            Scan source for assets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          // {assets.length} asset{assets.length === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-2">
          <a
            href="#vectorizer"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById("vectorizer");
              if (el) smoothScrollTo(el, -96);
            }}
            className="border border-[#8B1A1A] bg-[#8B1A1A] text-[#F4EFE6] px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] font-bold hover:opacity-90 transition-opacity"
            style={{ borderRadius: 0 }}
          >
            ★ Vectorizer Studio
          </a>
          <button
            type="button"
            onClick={findMore}
            disabled={harvesting}
            title="Re-scan the source URL for additional logos, marks, and icons"
            className="glass inline-flex items-center gap-2 rounded-full px-5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {harvesting && <Loader2 className="h-3 w-3 animate-spin" />}
            {harvesting ? "Scanning…" : "Find more"}
          </button>
        </div>
      </div>
      {sourceLogo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-raised)] p-5">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              // logo variants
            </div>
            <div className="mt-1 text-sm text-muted-foreground [font-family:'Libre_Baskerville',serif]">
              {missingVariants.length
                ? `Generate ${missingVariants.length} missing variant${missingVariants.length === 1 ? "" : "s"} from the source logo.`
                : "All variants generated."}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {allVariantKeys.map((k) => {
              const have = existingKinds.has(k);
              const isBusy = !busyAll && busy === sourceLogo.id && busyKinds.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  disabled={!!busy || have}
                  onClick={() => runVariants(sourceLogo.id, [k])}
                  className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                  title={have ? "Already generated" : VARIANT_PRESETS[k].label}
                >
                  {isBusy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : have ? (
                    <span className="opacity-60">✓</span>
                  ) : null}
                  {VARIANT_PRESETS[k].label}
                </button>
              );
            })}
            {missingVariants.length > 0 && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => runVariants(sourceLogo.id, missingVariants, true)}
                className="inline-flex items-center gap-2 rounded-full border border-foreground bg-foreground px-5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-background transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busyAll && busy === sourceLogo.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : null}
                Generate all missing
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((a) => {
          const rehosted = publicFor(a.storage_path);
          const rawPrimary = rehosted ?? a.url;
          const primary = isHttpUrl(rawPrimary) ? rawPrimary : null;
          const showChecker =
            a.kind === "logo-mark" ||
            a.kind === "logo-on-light" ||
            a.kind === "logo-on-dark" ||
            a.kind === "logo-inverted" ||
            a.kind === "favicon" ||
            a.kind === "logo" ||
            a.kind === "logomark" ||
            a.kind === "wordmark" ||
            a.kind === "icon";
          return (
            <div
              key={a.id}
              className="group relative overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-card shadow-[0_1px_0_rgba(10,10,10,0.04),0_8px_24px_-16px_rgba(10,10,10,0.18)]"
            >
              <button
                type="button"
                aria-label="Delete asset"
                onClick={() => handleDelete(a.id, a.kind)}
                disabled={deleting === a.id}
                className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur-sm opacity-0 transition-all duration-150 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[color:var(--accent)] hover:text-background disabled:opacity-50"
              >
                {deleting === a.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </button>
              <div
                className="flex h-40 items-center justify-center p-6"
                style={{
                  background: "var(--surface)",
                  backgroundImage: showChecker
                    ? "linear-gradient(45deg, rgba(10,10,10,0.04) 25%, transparent 25%), linear-gradient(-45deg, rgba(10,10,10,0.04) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(10,10,10,0.04) 75%), linear-gradient(-45deg, transparent 75%, rgba(10,10,10,0.04) 75%)"
                    : undefined,
                  backgroundSize: "12px 12px",
                  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
                }}
              >
                {primary ? (
                  <img
                    src={primary}
                    alt={a.kind}
                    className="max-h-full max-w-full object-contain"
                    style={
                      a.kind === "favicon"
                        ? { imageRendering: "pixelated", maxHeight: 64, maxWidth: 64 }
                        : undefined
                    }
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (rehosted && isHttpUrl(a.url) && img.src !== a.url) img.src = a.url;
                      else img.style.opacity = "0.3";
                    }}
                  />
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Invalid URL
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-[color:var(--border-subtle)] p-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {a.kind}
                </span>
                {primary ? (
                  <div className="flex items-center gap-3">
                    {/logo|mark|favicon|wordmark|icon/i.test(a.kind) && (
                      <a
                        href="#vectorizer"
                        onClick={(e) => {
                          e.preventDefault();
                          const el = document.getElementById("vectorizer");
                          if (el) smoothScrollTo(el, -96);
                        }}
                        className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8B1A1A] font-bold hover:underline"
                      >
                        [ Vectorize ]
                      </a>
                    )}
                    <a
                      href={primary}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent hover:underline"
                    >
                      Download
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TokensSection({
  tokens,
  kitId,
  ownerToken,
  isOwner,
  onChanged,
}: {
  tokens: any[];
  kitId?: string;
  ownerToken?: string;
  isOwner?: boolean;
  onChanged?: () => void;
}) {
  const canEdit = !!(isOwner && kitId && ownerToken);
  if (!tokens.length && !canEdit) return <Empty label="No tokens extracted" />;
  const grouped = tokens.reduce<Record<string, any[]>>((acc, t) => {
    (acc[t.category] ||= []).push(t);
    return acc;
  }, {});
  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {cat}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((t) => (
              <TokenRow
                key={t.id}
                token={t}
                kitId={kitId}
                ownerToken={ownerToken}
                canEdit={canEdit}
                onChanged={onChanged}
              />
            ))}
          </div>
        </div>
      ))}
      {canEdit && <AddTokenCard kitId={kitId!} ownerToken={ownerToken!} onAdded={onChanged} />}
    </div>
  );
}

function TokenRow({
  token: t,
  kitId,
  ownerToken,
  canEdit,
  onChanged,
}: {
  token: any;
  kitId?: string;
  ownerToken?: string;
  canEdit?: boolean;
  onChanged?: () => void;
}) {
  const updateToken = useServerFn(updateKitToken);
  const deleteToken = useServerFn(deleteKitToken);
  const [editing, setEditing] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<string>(t.category ?? "");
  const [nameDraft, setNameDraft] = useState<string>(t.name ?? "");
  const [valueDraft, setValueDraft] = useState<string>(t.value ?? "");
  const [editBusy, setEditBusy] = useState(false);

  async function save() {
    if (!canEdit || !kitId || !ownerToken) return;
    if (!categoryDraft.trim() || !nameDraft.trim() || !valueDraft.trim()) {
      toast.error("Category, name and value are all required");
      return;
    }
    setEditBusy(true);
    try {
      await updateToken({
        data: {
          kitId,
          ownerToken,
          tokenId: t.id,
          category: categoryDraft.trim(),
          name: nameDraft.trim(),
          value: valueDraft.trim(),
        },
      });
      setEditing(false);
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save token");
    } finally {
      setEditBusy(false);
    }
  }

  async function remove() {
    if (!canEdit || !kitId || !ownerToken) return;
    if (!confirm(`Delete token "${t.name}"?`)) return;
    setEditBusy(true);
    try {
      await deleteToken({ data: { kitId, ownerToken, tokenId: t.id } });
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't delete token");
    } finally {
      setEditBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="col-span-full space-y-2 rounded-lg border border-border bg-background p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <Input
            value={categoryDraft}
            onChange={(e) => setCategoryDraft(e.target.value)}
            className="h-8 font-mono text-[11px]"
            aria-label="Token category"
            placeholder="category"
          />
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            className="h-8 font-mono text-[11px]"
            aria-label="Token name"
            placeholder="name"
          />
          <Input
            value={valueDraft}
            onChange={(e) => setValueDraft(e.target.value)}
            className="h-8 font-mono text-[11px]"
            aria-label="Token value"
            placeholder="value"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={editBusy}
            className="rounded-md bg-foreground px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-background hover:opacity-90 disabled:opacity-50"
          >
            {editBusy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <span className="min-w-0 truncate font-mono text-sm">{t.name}</span>
      <span className="shrink-0 font-mono text-sm text-muted-foreground">{t.value}</span>
      {canEdit && (
        <span className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit token ${t.name}`}
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-foreground hover:text-background"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={remove}
            aria-label={`Delete token ${t.name}`}
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-[color:var(--accent)] hover:text-background"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      )}
    </div>
  );
}

function AddTokenCard({
  kitId,
  ownerToken,
  onAdded,
}: {
  kitId: string;
  ownerToken: string;
  onAdded?: () => void;
}) {
  const addToken = useServerFn(addKitToken);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!category.trim() || !name.trim() || !value.trim()) {
      toast.error("Category, name and value are all required");
      return;
    }
    setBusy(true);
    try {
      await addToken({
        data: {
          kitId,
          ownerToken,
          category: category.trim(),
          name: name.trim(),
          value: value.trim(),
        },
      });
      setOpen(false);
      setCategory("");
      setName("");
      setValue("");
      onAdded?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't add token");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[color:rgba(10,10,10,0.30)] p-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        <Plus className="h-4 w-4" strokeWidth={1.5} />
        Add token
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-8 font-mono text-[11px]"
          aria-label="Token category"
          placeholder="category (e.g. spacing)"
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 font-mono text-[11px]"
          aria-label="Token name"
          placeholder="name (e.g. space-md)"
        />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 font-mono text-[11px]"
          aria-label="Token value"
          placeholder="value (e.g. 16px)"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="rounded-md bg-foreground px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-background hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function VoiceSection({ voice, kitId }: { voice: any; kitId: string }) {
  if (!voice) return <Empty label="No voice analysis available" />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {voice.summary && (
        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Brand summary
          </h3>
          <p className="text-lg leading-relaxed">{voice.summary}</p>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Tone
        </h3>
        <div className="flex flex-wrap gap-2">
          {(voice.tone ?? []).map((t: any, i: number) => (
            <Badge key={i} variant="secondary" className="text-sm">
              {t.label}
              {typeof t.confidence === "number" && (
                <span className="ml-2 font-mono text-xs opacity-60">
                  {Math.round(t.confidence * 100)}%
                </span>
              )}
            </Badge>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Vocabulary
        </h3>
        <div className="flex flex-wrap gap-2">
          {(voice.vocabulary ?? []).map((v: string, i: number) => (
            <Badge key={i} variant="outline">
              {v}
            </Badge>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-success">Do</h3>
        <ul className="space-y-2 text-sm">
          {(voice.dos ?? []).map((d: string, i: number) => (
            <li key={i}>· {d}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-destructive">
          Don't
        </h3>
        <ul className="space-y-2 text-sm">
          {(voice.donts ?? []).map((d: string, i: number) => (
            <li key={i}>· {d}</li>
          ))}
        </ul>
      </div>
      {voice.samples && (
        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Sample copy
          </h3>
          <div className="space-y-3">
            {Object.entries(voice.samples).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-surface p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {k.replace("_", " ")}
                </div>
                <div className="mt-1">{String(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="lg:col-span-2">
        <SampleCopyGenerator kitId={kitId} />
      </div>
    </div>
  );
}

function SampleCopyGenerator({ kitId }: { kitId: string }) {
  const gen = useServerFn(generateSampleCopy);
  const [kind, setKind] = useState<
    "headline" | "cta" | "slide_title" | "email_intro" | "social_post"
  >("headline");
  const [topic, setTopic] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!topic.trim()) return;
    setBusy(true);
    setOutput("");
    try {
      const r = await gen({ data: { kitId, kind, topic: topic.trim() } });
      setOutput(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-4 w-4" /> Generate copy in this voice
      </h3>
      <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto]">
        <Select value={kind} onValueChange={(v) => setKind(v as any)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="headline">Headline</SelectItem>
            <SelectItem value="cta">CTA button</SelectItem>
            <SelectItem value="slide_title">Slide title</SelectItem>
            <SelectItem value="email_intro">Email intro</SelectItem>
            <SelectItem value="social_post">Social post</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="What's it about? e.g. launching a new pricing plan"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <Button onClick={run} disabled={busy || !topic.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
        </Button>
      </div>
      {output && (
        <div className="mt-4 rounded-lg bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Result</Label>
            <Button size="sm" variant="ghost" onClick={() => copy(output)}>
              <Copy className="mr-1 h-3 w-3" /> Copy
            </Button>
          </div>
          <div className="text-base">{output}</div>
        </div>
      )}
    </div>
  );
}

function SandboxSection({
  kitName,
  colors,
  fonts,
  assets,
}: {
  kitName: string;
  colors: any[];
  fonts: any[];
  assets: any[];
}) {
  const r2PublicUrl = (import.meta as any).env?.VITE_R2_PUBLIC_URL as string | undefined;
  const publicFor = (path: string | null | undefined) =>
    path && r2PublicUrl ? `${r2PublicUrl}/${path}` : null;
  const priority = ["logo", "wordmark", "logo-mark", "logomark", "logo-on-light", "icon"];
  const logo =
    [...assets]
      .filter((a) => priority.includes(a.kind))
      .sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind))[0] ?? null;
  const logoUrl = logo ? (publicFor(logo.storage_path) ?? logo.url ?? null) : null;
  if (!colors.length && !fonts.length) return <Empty label="No tokens to preview yet" />;
  return <ComponentSandbox kitName={kitName} colors={colors} fonts={fonts} logoUrl={logoUrl} />;
}

function ExportSection(props: {
  kitId: string;
  kitName: string;
  isOwner: boolean;
  isPublic: boolean;
  shareToken: string | null;
  onShareChange: (next: { is_public: boolean; share_token: string | null }) => void;
  colors: any[];
  fonts: any[];
  tokens: any[];
  assets: any[];
  voice: any;
}) {
  const [activeCategory, setActiveCategory] = useState<"all" | "mobile" | "web">("all");
  const tokensJson = buildTokensJSON(props);
  const css = buildCSS(props);
  const tailwind = buildTailwindTheme(props);
  const studio = buildTokensStudioJSON(props);
  const voiceMd = buildVoiceMarkdown(props.kitName, props.voice);
  const shadcn = buildShadcnGlobalsCss(props);
  const tailwindConfig = buildTailwindConfig(props);
  const dtcg = buildDtcgTokens(props);

  // Native Mobile Token Packages
  const flutterDart = buildFlutterBrandTheme({
    name: props.kitName,
    colors: props.colors,
    fonts: props.fonts,
    tokens: props.tokens,
  });
  const swiftColors = buildSwiftBrandColors({
    name: props.kitName,
    colors: props.colors,
    fonts: props.fonts,
    tokens: props.tokens,
  });
  const composeColor = buildComposeColor({
    name: props.kitName,
    colors: props.colors,
    fonts: props.fonts,
    tokens: props.tokens,
  });
  const composeType = buildComposeType({
    name: props.kitName,
    colors: props.colors,
    fonts: props.fonts,
    tokens: props.tokens,
  });
  const reactNativeTokens = buildReactNativeBrandTokens({
    name: props.kitName,
    colors: props.colors,
    fonts: props.fonts,
    tokens: props.tokens,
  });
  const base = slug(props.kitName);
  const setShare = useServerFn(setKitShare);
  const fetchFonts = useServerFn(fetchFontFiles);
  const resolveGoogleFonts = useServerFn(resolveGoogleFontFiles);
  const fetchAssets = useServerFn(fetchAssetFiles);
  const [shareBusy, setShareBusy] = useState(false);
  const { user } = useAuth();
  const ownerToken = user?.id ?? getAnonToken();

  async function downloadPDF() {
    const blob = await buildBrandPDF({ name: props.kitName, ...props });
    downloadBlob(blob, `${base}-brand-guide.pdf`);
  }

  async function downloadZip() {
    toast.message("Building bundle…");
    // Collect downloadable font URLs from open-licensed fonts
    const urls: string[] = [];
    for (const f of props.fonts ?? []) {
      if (f?.license !== "open") continue;
      for (const file of f.file_urls ?? []) {
        if (file?.url && urls.length < 40) urls.push(file.url);
      }
      // Google Fonts without captured file_urls — resolve on demand.
      if (
        f?.google_font &&
        f?.family &&
        (!Array.isArray(f.file_urls) || f.file_urls.length === 0) &&
        urls.length < 40
      ) {
        try {
          const r = await resolveGoogleFonts({
            data: { family: f.family, weights: f.weights ?? undefined },
          });
          for (const u of r.urls) {
            if (urls.length < 40) urls.push(u);
          }
        } catch (e) {
          console.warn("google font resolve failed", e);
        }
      }
    }
    let fontFiles: any[] = [];
    if (urls.length) {
      try {
        const r = await fetchFonts({ data: { urls } });
        fontFiles = (r.files ?? []).filter((f: any) => f.ok);
      } catch (e) {
        console.warn("font file fetch failed", e);
      }
    }
    let assetFiles: any[] = [];
    const assetUrls = (props.assets ?? [])
      .map((a: any) => a?.url)
      .filter((u: any): u is string => typeof u === "string")
      .slice(0, 60);
    if (assetUrls.length) {
      try {
        const r = await fetchAssets({ data: { urls: assetUrls } });
        assetFiles = (r.files ?? []).filter((f: any) => f.ok);
      } catch (e) {
        console.warn("asset file fetch failed", e);
      }
    }
    const blob = await buildKitZip({
      name: props.kitName,
      ...props,
      fontFiles,
      assetFiles,
    });
    downloadBlob(blob, `${base}-brand-kit.zip`);
  }

  async function toggleShare(next: boolean) {
    setShareBusy(true);
    try {
      const r = await setShare({ data: { kitId: props.kitId, ownerToken, isPublic: next } });
      props.onShareChange({ is_public: r.is_public, share_token: r.share_token });
      toast.success(next ? "Public link enabled" : "Public link disabled");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update share");
    } finally {
      setShareBusy(false);
    }
  }

  const shareUrl =
    props.isPublic && props.shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/share/${props.shareToken}`
      : "";

  const mobileBlocks = [
    {
      title: "Flutter BrandTheme.dart",
      platform: "FLUTTER / DART",
      content: flutterDart,
      filename: `${base}-BrandTheme.dart`,
    },
    {
      title: "SwiftUI BrandColors.swift",
      platform: "IOS / SWIFTUI",
      content: swiftColors,
      filename: `${base}-BrandColors.swift`,
    },
    {
      title: "Android Color.kt (Compose)",
      platform: "ANDROID / KOTLIN COMPOSE",
      content: composeColor,
      filename: `${base}-Color.kt`,
    },
    {
      title: "Android Type.kt (Compose)",
      platform: "ANDROID / KOTLIN COMPOSE",
      content: composeType,
      filename: `${base}-Type.kt`,
    },
    {
      title: "React Native & Tamagui brandTokens.ts",
      platform: "REACT NATIVE / TS",
      content: reactNativeTokens,
      filename: `${base}-brandTokens.ts`,
    },
  ];

  const webBlocks = [
    {
      title: "Design tokens (W3C JSON)",
      platform: "W3C DTCG / JSON",
      content: tokensJson,
      filename: `${base}-tokens.json`,
    },
    {
      title: "Tailwind v4 theme",
      platform: "TAILWIND CSS V4",
      content: tailwind,
      filename: `${base}-tailwind.css`,
    },
    {
      title: "CSS variables",
      platform: "PURE CSS / ROOT",
      content: css,
      filename: `${base}.css`,
    },
    {
      title: "Tokens Studio (Figma)",
      platform: "FIGMA TOKENS STUDIO",
      content: studio,
      filename: `${base}-tokens-studio.json`,
    },
    {
      title: "Brand voice (.md)",
      platform: "EDITORIAL VOICE",
      content: voiceMd,
      filename: `${base}-voice.md`,
    },
    {
      title: "Shadcn UI globals.css",
      platform: "SHADCN UI / TAILWIND",
      content: shadcn,
      filename: `${base}-shadcn-globals.css`,
    },
    {
      title: "tailwind.config.js",
      platform: "TAILWIND CJS CONFIG",
      content: tailwindConfig,
      filename: `${base}-tailwind.config.js`,
    },
    {
      title: "DTCG tokens.json (Figma)",
      platform: "W3C DESIGN TOKENS",
      content: dtcg,
      filename: `${base}-tokens-dtcg.json`,
    },
  ];

  const displayedBlocks =
    activeCategory === "mobile"
      ? mobileBlocks
      : activeCategory === "web"
        ? webBlocks
        : [...mobileBlocks, ...webBlocks];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-xl border border-border bg-card p-6 sm:grid-cols-2">
        <Button size="lg" onClick={downloadZip}>
          <Package className="mr-2 h-4 w-4" /> Download full kit (.zip)
        </Button>
        <Button size="lg" variant="outline" onClick={downloadPDF}>
          <Download className="mr-2 h-4 w-4" /> Brand guide (.pdf)
        </Button>
      </div>

      {props.isOwner && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                <Share2 className="h-4 w-4" /> Public share link
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Anyone with the link can view this kit (read-only).
              </p>
            </div>
            <Switch checked={props.isPublic} onCheckedChange={toggleShare} disabled={shareBusy} />
          </div>
          {shareUrl && (
            <div className="mt-4 flex gap-2">
              <Input readOnly value={shareUrl} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => copy(shareUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Official Figma Plugin Bridge Card */}
      <div
        className="border border-[#0A0A0A] bg-card p-6 text-foreground"
        style={{ borderRadius: 0 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0A0A0A] pb-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[#8B1A1A]">
              <span>// INTEGRATION BRIDGE</span>
              <span>·</span>
              <span>REST SYNC API</span>
            </div>
            <h3 className="mt-1 font-[family-name:var(--font-cormorant)] text-2xl font-bold tracking-tight">
              Official Figma Plugin Bridge
            </h3>
            <p className="mt-1 font-[family-name:var(--font-libre)] text-xs text-muted-foreground">
              Directly synchronize Figma Local Variables (Colors, Spacing, Radius), Text Styles, and
              Vector Logos with 2-way diff tracking.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const apiEndpoint = `${window.location.origin}/api/v1/kits/${props.kitId}/tokens${props.shareToken ? `?token=${props.shareToken}` : ""}`;
                window.open(apiEndpoint, "_blank");
              }}
              className="border border-[#0A0A0A] font-mono text-[11px] uppercase tracking-[0.14em]"
              style={{ borderRadius: 0 }}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Test API Endpoint
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
              // BRAND KIT ID
            </label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={props.kitId}
                className="font-mono text-xs bg-muted/20"
                style={{ borderRadius: 0 }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(props.kitId)}
                style={{ borderRadius: 0 }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
              // SYNC ACCESS TOKEN (SHARE TOKEN)
            </label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={
                  props.shareToken ||
                  (props.isPublic
                    ? "Public Access Enabled"
                    : "Enable Public Share to generate token")
                }
                className="font-mono text-xs bg-muted/20"
                style={{ borderRadius: 0 }}
              />
              {props.shareToken && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy(props.shareToken!)}
                  style={{ borderRadius: 0 }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-border/40 pt-3 font-mono text-[10px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>
            Plugin Directory: <code className="text-foreground">/figma-plugin</code> (Import
            manifest.json in Figma Developer Mode)
          </span>
          <span className="text-[#8B1A1A]">● W3C DTCG + Figma Variables Compliant</span>
        </div>
      </div>

      {/* Automated GitHub Pull Request Dispatcher Bridge Card */}
      <div
        className="border border-[#0A0A0A] bg-card p-6 text-foreground"
        style={{ borderRadius: 0 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0A0A0A] pb-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[#8B1A1A]">
              <span>// INTEGRATION BRIDGE</span>
              <span>·</span>
              <span>GITHUB PULL REQUEST DISPATCHER</span>
            </div>
            <h3 className="mt-1 font-[family-name:var(--font-cormorant)] text-2xl font-bold tracking-tight">
              Automated GitHub Pull Request Dispatcher
            </h3>
            <p className="mt-1 font-[family-name:var(--font-libre)] text-xs text-muted-foreground">
              Directly synchronize and commit tokens.css, tailwind.config.js, and tokens.json to your repository via atomic PRs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GitHubSyncBadge kitId={props.kitId} kitName={props.kitName} />
          </div>
        </div>

        <div className="mt-4 border-t border-border/40 pt-3 font-mono text-[10px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>
            Committed Artifacts: <code className="text-foreground">tokens.css · tailwind.config.js · tokens.json</code>
          </span>
          <span className="text-green-600">● Encrypted PAT &amp; Git Data API</span>
        </div>
      </div>

      {/* Platform & Category Tab Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0A0A0A] pb-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={activeCategory === "all" ? "default" : "outline"}
            onClick={() => setActiveCategory("all")}
            className="border border-[#0A0A0A] font-mono text-[11px] uppercase tracking-[0.14em]"
            style={{ borderRadius: 0 }}
          >
            <Layers className="mr-1.5 h-3.5 w-3.5" />
            All Formats ({mobileBlocks.length + webBlocks.length})
          </Button>
          <Button
            size="sm"
            variant={activeCategory === "mobile" ? "default" : "outline"}
            onClick={() => setActiveCategory("mobile")}
            className="border border-[#0A0A0A] font-mono text-[11px] uppercase tracking-[0.14em]"
            style={{ borderRadius: 0 }}
          >
            <Smartphone className="mr-1.5 h-3.5 w-3.5" />
            Mobile & Native ({mobileBlocks.length})
          </Button>
          <Button
            size="sm"
            variant={activeCategory === "web" ? "default" : "outline"}
            onClick={() => setActiveCategory("web")}
            className="border border-[#0A0A0A] font-mono text-[11px] uppercase tracking-[0.14em]"
            style={{ borderRadius: 0 }}
          >
            <Globe className="mr-1.5 h-3.5 w-3.5" />
            Web & Design Systems ({webBlocks.length})
          </Button>
        </div>

        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {activeCategory === "mobile" && "// FLUTTER · IOS SWIFT · ANDROID COMPOSE · REACT NATIVE"}
          {activeCategory === "web" && "// W3C DTCG · TAILWIND V4 · CSS · FIGMA · SHADCN"}
          {activeCategory === "all" && "// 13 PRODUCTION HANDOFF TARGETS"}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {displayedBlocks.map((block) => (
          <ExportBlock
            key={block.filename}
            title={block.title}
            platform={block.platform}
            content={block.content}
            filename={block.filename}
          />
        ))}
      </div>
    </div>
  );
}

function ExportBlock({
  title,
  content,
  filename,
  platform,
}: {
  title: string;
  content: string;
  filename: string;
  platform?: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    copy(content);
    setCopied(true);
    toast.success(`Copied ${filename}`);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const blob = new Blob([content], { type: "text/plain" });
    downloadBlob(blob, filename);
    toast.success(`Downloaded ${filename}`);
  }

  return (
    <div
      className="min-w-0 overflow-hidden border border-[#0A0A0A] bg-card p-4 sm:p-5 flex flex-col justify-between"
      style={{ borderRadius: 0 }}
    >
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#0A0A0A]/10 pb-3">
          <div className="min-w-0">
            {platform && (
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8B1A1A] block mb-0.5">
                // {platform}
              </span>
            )}
            <h3 className="min-w-0 break-words font-mono text-sm font-semibold tracking-tight">
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="border border-[#0A0A0A] font-mono text-[11px] uppercase tracking-[0.14em]"
              style={{ borderRadius: 0 }}
            >
              {copied ? (
                <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="mr-1.5 h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              size="sm"
              onClick={download}
              className="border border-[#0A0A0A] bg-[#0A0A0A] text-[#F4EFE6] font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-[#1a1a1a]"
              style={{ borderRadius: 0 }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download File
            </Button>
          </div>
        </div>

        <div className="relative">
          <pre className="max-h-80 overflow-auto whitespace-pre bg-surface/80 p-3.5 font-mono text-[11px] leading-relaxed border border-border/40 select-all">
            {content}
          </pre>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>{filename}</span>
            <span>{content.split("\n").length} lines</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

type BodyLine = string | { mono: string };

type FailureDetails = {
  code?: string | null;
  status?: number | null;
  message?: string | null;
};

const CAUSE_LABELS: Record<string, string> = {
  scrape_failed: "Source could not be reached",
  ai_failed: "Brand model could not parse the page",
  ai_rate_limit: "Brand model rate-limited",
  ai_credits_exhausted: "Brand model credits exhausted",
  parse_failed: "Page returned no usable signal",
  unknown: "Cause unknown",
};

function FailurePanel({
  eyebrow,
  slug,
  headline,
  bodyLines,
  primaryLabel,
  primaryBusyLabel,
  onPrimary,
  primaryBusy,
  secondaryLabel,
  onSecondary,
  urlEditor,
  details,
}: {
  eyebrow: string;
  slug: string;
  headline: string;
  bodyLines: BodyLine[];
  primaryLabel?: string;
  primaryBusyLabel?: string;
  onPrimary?: () => void;
  primaryBusy?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  urlEditor?: {
    open: boolean;
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
    busy?: boolean;
  };
  details?: FailureDetails;
}) {
  const ink = "var(--ink, #0A0A0A)";
  const hair = "rgba(10,10,10,0.20)";
  const accent = "var(--accent, #8B1A1A)";
  const mono = "'Courier Prime', 'JetBrains Mono', monospace";
  const display = "'Cormorant Garamond', Georgia, serif";
  const body = "'Libre Baskerville', Georgia, serif";

  return (
    <div
      style={{
        border: `1px solid ${ink}`,
        padding: "56px 48px",
        background: "transparent",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 24,
          fontFamily: mono,
          fontSize: 11,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: ink }}>{eyebrow}</span>
        <span style={{ color: accent }}>{slug}</span>
      </div>

      <h2
        style={{
          fontFamily: display,
          fontWeight: 500,
          fontSize: 36,
          lineHeight: 1.15,
          color: ink,
          margin: "32px 0 20px",
        }}
      >
        {headline}
      </h2>

      <div
        style={{
          fontFamily: body,
          fontSize: 16,
          lineHeight: 1.6,
          color: ink,
          opacity: 0.8,
          maxWidth: 560,
        }}
      >
        {bodyLines.map((line, i) =>
          typeof line === "string" ? (
            <p key={i} style={{ margin: i === 0 ? 0 : "8px 0 0" }}>
              {line}
            </p>
          ) : (
            <p
              key={i}
              style={{
                margin: "8px 0",
                fontFamily: mono,
                fontSize: 13,
                wordBreak: "break-all",
                opacity: 1,
              }}
            >
              {line.mono}
            </p>
          ),
        )}
      </div>

      {(() => {
        const code = details?.code ?? null;
        const status = details?.status ?? null;
        const message = details?.message ?? null;
        if (!code && status == null && !message) return null;
        const causeText = code ? (CAUSE_LABELS[code] ?? "Cause unknown") : null;
        return (
          <details
            style={{
              marginTop: 32,
              borderTop: `1px solid ${hair}`,
              padding: "16px 0 0",
            }}
          >
            <summary
              style={{
                listStyle: "none",
                cursor: "pointer",
                fontFamily: mono,
                fontSize: 11,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: ink,
                transition: "opacity 150ms ease",
                userSelect: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              <span className="fp-marker fp-marker-closed" style={{ marginRight: 12 }}>
                [ + ]
              </span>
              <span className="fp-marker fp-marker-open" style={{ marginRight: 12 }}>
                [ − ]
              </span>
              What happened
            </summary>
            <div
              style={{
                marginTop: 16,
                display: "grid",
                gridTemplateColumns: "minmax(96px, max-content) 1fr",
                rowGap: 8,
                columnGap: 24,
                fontFamily: mono,
                fontSize: 13,
                color: ink,
              }}
            >
              {causeText && (
                <>
                  <span
                    style={{
                      opacity: 0.6,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      fontSize: 12,
                    }}
                  >
                    Cause
                  </span>
                  <span style={{ wordBreak: "break-word" }}>{causeText}</span>
                </>
              )}
              {status != null && (
                <>
                  <span
                    style={{
                      opacity: 0.6,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      fontSize: 12,
                    }}
                  >
                    Status
                  </span>
                  <span>{status}</span>
                </>
              )}
              {message && (
                <>
                  <span
                    style={{
                      opacity: 0.6,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      fontSize: 12,
                    }}
                  >
                    Message
                  </span>
                  <span style={{ wordBreak: "break-word" }}>{message}</span>
                </>
              )}
            </div>
            <style>{`
              .fp-marker-open { display: none; }
              details[open] > summary .fp-marker-closed { display: none; }
              details[open] > summary .fp-marker-open { display: inline; }
              summary::-webkit-details-marker { display: none; }
            `}</style>
          </details>
        );
      })()}

      {urlEditor?.open && (
        <div style={{ marginTop: 32, borderTop: `1px solid ${hair}`, paddingTop: 24 }}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: ink,
              opacity: 0.7,
              marginBottom: 12,
            }}
          >
            // NEW SOURCE URL
          </div>
          <input
            type="url"
            value={urlEditor.value}
            onChange={(e) => urlEditor.onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !urlEditor.busy) urlEditor.onSubmit();
              if (e.key === "Escape") urlEditor.onCancel();
            }}
            placeholder="https://example.com"
            autoFocus
            spellCheck={false}
            style={{
              width: "100%",
              fontFamily: mono,
              fontSize: 13,
              color: ink,
              background: "transparent",
              padding: "12px 14px",
              border: `1px solid ${hair}`,
              borderRadius: 0,
              outline: "none",
              transition: "border-color 150ms ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = ink;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = hair;
            }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
            <button
              type="button"
              onClick={urlEditor.onSubmit}
              disabled={urlEditor.busy || !urlEditor.value.trim()}
              style={{
                fontFamily: mono,
                fontSize: 13,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: ink,
                background: "transparent",
                padding: "14px 18px",
                border: `1px solid ${ink}`,
                cursor: urlEditor.busy || !urlEditor.value.trim() ? "default" : "pointer",
                opacity: urlEditor.busy || !urlEditor.value.trim() ? 0.5 : 1,
                transition: "background-color 150ms ease, color 150ms ease, opacity 150ms ease",
              }}
              onMouseEnter={(e) => {
                if (urlEditor.busy || !urlEditor.value.trim()) return;
                e.currentTarget.style.background = ink;
                e.currentTarget.style.color = "#F4EFE6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = ink;
              }}
            >
              {urlEditor.busy ? "[ RETRYING… ]" : "[ EXTRACT FROM URL ]"}
            </button>
            <button
              type="button"
              onClick={urlEditor.onCancel}
              disabled={urlEditor.busy}
              style={{
                fontFamily: mono,
                fontSize: 13,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: ink,
                background: "transparent",
                padding: "14px 18px",
                border: `1px solid ${hair}`,
                cursor: urlEditor.busy ? "default" : "pointer",
                opacity: urlEditor.busy ? 0.5 : 1,
                transition: "border-color 150ms ease",
              }}
              onMouseEnter={(e) => {
                if (!urlEditor.busy) e.currentTarget.style.borderColor = ink;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = hair;
              }}
            >
              [ CANCEL ]
            </button>
          </div>
          <p
            style={{
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: ink,
              opacity: 0.55,
              marginTop: 16,
            }}
          >
            Different source type? Use{" "}
            <Link to="/" style={{ color: ink, textDecoration: "underline" }}>
              [ START OVER ]
            </Link>{" "}
            to upload a PDF or paste image links.
          </p>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${hair}`, margin: "40px 0 24px" }} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {!urlEditor?.open && primaryLabel && onPrimary && (
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryBusy}
            style={{
              fontFamily: mono,
              fontSize: 13,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: ink,
              background: "transparent",
              padding: "14px 18px",
              border: `1px solid ${ink}`,
              cursor: primaryBusy ? "default" : "pointer",
              opacity: primaryBusy ? 0.5 : 1,
              transition: "background-color 150ms ease, color 150ms ease, opacity 150ms ease",
            }}
            onMouseEnter={(e) => {
              if (primaryBusy) return;
              e.currentTarget.style.background = ink;
              e.currentTarget.style.color = "#F4EFE6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = ink;
            }}
          >
            {primaryBusy && primaryBusyLabel ? primaryBusyLabel : primaryLabel}
          </button>
        )}
        {!urlEditor?.open && secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            style={{
              fontFamily: mono,
              fontSize: 13,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: ink,
              background: "transparent",
              padding: "14px 18px",
              border: `1px solid ${hair}`,
              cursor: "pointer",
              transition: "border-color 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = ink;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = hair;
            }}
          >
            {secondaryLabel}
          </button>
        )}
        <Link
          to="/"
          style={{
            fontFamily: mono,
            fontSize: 13,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: ink,
            padding: "14px 18px",
            border: `1px solid ${hair}`,
            textDecoration: "none",
            transition: "border-color 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = ink;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = hair;
          }}
        >
          [ START OVER ]
        </Link>
      </div>
    </div>
  );
}
