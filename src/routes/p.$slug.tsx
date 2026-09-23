import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  Globe,
  KeyRound,
  Layers,
  Lock,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  Type,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getPortalData, verifyPortalPassword } from "@/lib/portal.functions";
import { contrastRatio, hexToRgb, wcag } from "@/lib/color";
import { buildCSS, buildTailwindTheme, buildTokensJSON } from "@/lib/exports";
import { isHttpUrl } from "@/lib/utils";
import JSZip from "jszip";

export const Route = createFileRoute("/p/$slug")({
  component: PublishedPortalPage,
});

function hexToHslString(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

function copyToClipboard(text: string, label: string = "Copied") {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }
}

export function PublishedPortalPage(props?: { overrideSlug?: string }) {
  let routeSlug = "";
  try {
    const params = Route.useParams();
    routeSlug = params?.slug || "";
  } catch {
    routeSlug = "";
  }
  const slug = props?.overrideSlug || routeSlug;
  const fetchPortal = useServerFn(getPortalData);
  const unlockPortal = useServerFn(verifyPortalPassword);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Security / Unlock state
  const [passwordInput, setPasswordInput] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Theme & interactive state
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssetBg, setSelectedAssetBg] = useState<Record<string, "grid" | "dark" | "light" | "brand">>({});
  const [sampleText, setSampleText] = useState("Sphinx of black quartz, judge my vow.");
  const [fontSize, setFontSize] = useState(36);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Storage key for password session
  const sessionTokenKey = `bm_portal_session_${slug}`;

  const loadData = async (token?: string) => {
    setLoading(true);
    setError(null);
    try {
      const storedToken =
        token || (typeof window !== "undefined" ? sessionStorage.getItem(sessionTokenKey) || "" : "");
      const res = await fetchPortal({
        data: {
          slug,
          passwordToken: storedToken || undefined,
        },
      });
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load Brand Guidelines portal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [slug]);

  // Handle password submission
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    setUnlocking(true);
    setPasswordError(null);
    try {
      const res = await unlockPortal({
        data: {
          slug,
          password: passwordInput.trim(),
        },
      });
      if (res?.token) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(sessionTokenKey, res.token);
        }
        await loadData(res.token);
        toast.success("Access unlocked successfully");
      }
    } catch (err: any) {
      setPasswordError(err?.message || "Incorrect password");
    } finally {
      setUnlocking(false);
    }
  };

  // 1-Click Asset Download
  const handleDownloadAsset = async (asset: any, format: "svg" | "png") => {
    try {
      toast.info(`Preparing ${format.toUpperCase()} download...`);
      const response = await fetch(asset.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-${asset.kind || "logo"}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Downloaded ${asset.kind || "logo"}.${format}`);
    } catch {
      window.open(asset.url, "_blank");
    }
  };

  // Copy raw SVG code
  const handleCopySvgCode = async (asset: any) => {
    try {
      const res = await fetch(asset.url);
      const text = await res.text();
      if (text.includes("<svg")) {
        copyToClipboard(text, "SVG code");
      } else {
        copyToClipboard(asset.url, "Asset URL");
      }
    } catch {
      copyToClipboard(asset.url, "Asset URL");
    }
  };

  // Download Complete Brand Pack ZIP
  const handleDownloadBrandPack = async () => {
    if (!data) return;
    setDownloadingZip(true);
    try {
      toast.info("Bundling brand pack archive...");
      const zip = new JSZip();
      const folder = zip.folder(`${slug}-brand-guidelines`) || zip;

      // Add Tokens JSON & CSS
      folder.file("tokens.json", buildTokensJSON(data));
      folder.file("variables.css", buildCSS(data));
      folder.file("tailwind-v4.css", buildTailwindTheme(data));

      // Add Brand Voice & Guidelines Markdown
      let guidelinesMd = `# ${data.kit.name} — Brand Guidelines\n\n`;
      if (data.kit.brandPositioning) {
        guidelinesMd += `## Brand Positioning\n${data.kit.brandPositioning}\n\n`;
      }
      if (data.voice) {
        guidelinesMd += `## Brand Voice & Tone\n`;
        if (data.voice.summary) guidelinesMd += `${data.voice.summary}\n\n`;
        if (data.voice.dos?.length) {
          guidelinesMd += `### Do's\n` + data.voice.dos.map((d: string) => `- ${d}`).join("\n") + "\n\n";
        }
        if (data.voice.donts?.length) {
          guidelinesMd += `### Don'ts\n` + data.voice.donts.map((d: string) => `- ${d}`).join("\n") + "\n\n";
        }
      }
      folder.file("GUIDELINES.md", guidelinesMd);

      // Add Assets
      const assetsFolder = folder.folder("logos-and-assets");
      if (assetsFolder && data.assets?.length) {
        await Promise.all(
          data.assets.slice(0, 15).map(async (asset: any, idx: number) => {
            try {
              const res = await fetch(asset.url);
              const blob = await res.blob();
              const ext = asset.url.endsWith(".svg") ? "svg" : "png";
              assetsFolder.file(`${asset.kind || `asset-${idx + 1}`}.${ext}`, blob);
            } catch {
              // Ignore single asset fetch failure
            }
          }),
        );
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-brand-package.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Brand package downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate brand zip");
    } finally {
      setDownloadingZip(false);
    }
  };

  // Filtered Colors, Assets, Rules by search
  const filteredColors = useMemo(() => {
    if (!data?.colors) return [];
    if (!searchQuery.trim()) return data.colors;
    const q = searchQuery.toLowerCase();
    return data.colors.filter(
      (c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q) ||
        c.hex?.toLowerCase().includes(q),
    );
  }, [data?.colors, searchQuery]);

  const filteredAssets = useMemo(() => {
    if (!data?.assets) return [];
    if (!searchQuery.trim()) return data.assets;
    const q = searchQuery.toLowerCase();
    return data.assets.filter((a: any) => a.kind?.toLowerCase().includes(q));
  }, [data?.assets, searchQuery]);

  const filteredFonts = useMemo(() => {
    if (!data?.fonts) return [];
    if (!searchQuery.trim()) return data.fonts;
    const q = searchQuery.toLowerCase();
    return data.fonts.filter(
      (f: any) => f.family?.toLowerCase().includes(q) || f.role?.toLowerCase().includes(q),
    );
  }, [data?.fonts, searchQuery]);

  // Dynamic Whitelabel Metadata / Head tags
  useEffect(() => {
    if (data?.portal) {
      if (data.portal.whitelabelTitle) {
        document.title = data.portal.whitelabelTitle;
      }
      if (data.portal.whitelabelFaviconUrl) {
        let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.getElementsByTagName("head")[0].appendChild(link);
        }
        link.href = data.portal.whitelabelFaviconUrl;
      }
    }
  }, [data?.portal]);

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F4EFE6] flex items-center justify-center">
        <div className="text-center font-mono text-xs uppercase tracking-[0.24em] animate-pulse">
          // LOADING BRAND GUIDELINES PORTAL · EDGE RESOLUTION...
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F4EFE6] flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-red-900/40 bg-red-950/20 p-8 text-center rounded-xl">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-serif font-bold text-red-200">Portal Unavailable</h1>
          <p className="mt-2 text-sm font-sans text-red-300/80">{error}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => loadData()}
              className="border-red-800 text-red-200 hover:bg-red-900/30"
            >
              Retry
            </Button>
            <Link to="/">
              <Button className="bg-[#F4EFE6] text-[#0A0A0A] hover:bg-white">Go Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Expired Portal State
  if (data?.isExpired) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F4EFE6] flex items-center justify-center p-6">
        <div className="max-w-lg w-full border border-[#262626] bg-[#141414] p-10 text-center rounded-2xl shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 mb-6">
            <Lock className="h-7 w-7" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-500">
            // ACCESS WINDOW EXPIRED
          </span>
          <h1 className="mt-2 font-[family-name:var(--font-cormorant)] text-3xl font-bold">
            {data.portal.name} Guidelines Access Expired
          </h1>
          <p className="mt-3 text-sm text-neutral-400 font-sans leading-relaxed">
            Confidential pre-launch access to these brand guidelines expired on{" "}
            <span className="text-neutral-200 font-medium">
              {new Date(data.portal.expiresAt).toLocaleDateString()}
            </span>
            . Please contact the brand custodian or media team for an updated link.
          </p>
          {!data.portal.whitelabelRemoveBadge && (
            <div className="mt-10 border-t border-[#262626] pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              POWERED BY BRAND DNA EDGE
            </div>
          )}
        </div>
      </div>
    );
  }

  // Password Protection Gate
  if (data?.isLocked) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F4EFE6] flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-[#262626] bg-[#141414] p-8 sm:p-10 rounded-2xl shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-800 text-neutral-200 mb-6">
            <KeyRound className="h-7 w-7" />
          </div>
          <div className="text-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-neutral-400">
              // CONFIDENTIAL REBRAND
            </span>
            <h1 className="mt-2 font-[family-name:var(--font-cormorant)] text-3xl font-bold">
              {data.portal.name}
            </h1>
            <p className="mt-2 text-xs font-sans text-neutral-400">
              This brand guidelines website is protected. Please enter the passphrase to view the live brand
              specifications.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="mt-8 space-y-4">
            <div>
              <Input
                type="password"
                placeholder="Enter access passphrase..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
                className="bg-neutral-900 border-neutral-700 text-[#F4EFE6] placeholder:text-neutral-500 h-11 text-center font-mono tracking-widest"
              />
              {data.portal.hint && (
                <p className="mt-2 text-[11px] font-sans text-neutral-400 text-center italic">
                  Hint: {data.portal.hint}
                </p>
              )}
              {passwordError && (
                <p className="mt-2 text-xs text-red-400 text-center font-sans font-medium">
                  {passwordError}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={unlocking || !passwordInput.trim()}
              className="w-full bg-[#F4EFE6] hover:bg-white text-[#0A0A0A] font-mono text-xs uppercase tracking-[0.16em] h-11"
            >
              {unlocking ? "Verifying..." : "Unlock Brand Guidelines"}
            </Button>
          </form>

          {!data.portal.whitelabelRemoveBadge && (
            <div className="mt-8 border-t border-[#222] pt-5 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-600">
              SECURED BY BRAND DNA ENTERPRISE
            </div>
          )}
        </div>
      </div>
    );
  }

  const { kit, colors, fonts, tokens, assets, voice, portal } = data;
  const primaryColor = colors.find((c: any) => c.role === "primary") || colors[0];

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        theme === "dark" ? "bg-[#0A0A0A] text-[#F4EFE6]" : "bg-[#FBF9F5] text-[#0A0A0A]"
      }`}
    >
      {/* 1. Global Navigation Bar */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md ${
          theme === "dark" ? "border-neutral-800 bg-[#0A0A0A]/85" : "border-neutral-200 bg-[#FBF9F5]/85"
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight truncate">
              {kit.name}
            </span>
            <span
              className={`hidden sm:inline-block rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] border ${
                theme === "dark"
                  ? "border-neutral-700 bg-neutral-900 text-neutral-300"
                  : "border-neutral-300 bg-neutral-100 text-neutral-700"
              }`}
            >
              Guidelines v1.0
            </span>
          </div>

          {/* Quick Anchor Navigation */}
          <nav className="hidden lg:flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-400">
            <a href="#logos" className="hover:text-foreground transition-colors">
              Logos
            </a>
            <a href="#colors" className="hover:text-foreground transition-colors">
              Colors
            </a>
            <a href="#typography" className="hover:text-foreground transition-colors">
              Typography
            </a>
            <a href="#voice" className="hover:text-foreground transition-colors">
              Voice
            </a>
            <a href="#guidelines" className="hover:text-foreground transition-colors">
              Do's & Don'ts
            </a>
            <a href="#tokens" className="hover:text-foreground transition-colors">
              Tokens
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={`rounded-full h-8 w-8 p-0 ${
                theme === "dark" ? "hover:bg-neutral-800" : "hover:bg-neutral-200"
              }`}
              title="Toggle Dark / Light View"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Download Full Package */}
            <Button
              size="sm"
              onClick={handleDownloadBrandPack}
              disabled={downloadingZip}
              className={`font-mono text-[11px] uppercase tracking-[0.14em] h-8 sm:h-9 px-3 sm:px-4 ${
                theme === "dark"
                  ? "bg-[#F4EFE6] text-[#0A0A0A] hover:bg-white"
                  : "bg-[#0A0A0A] text-[#F4EFE6] hover:bg-neutral-800"
              }`}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {downloadingZip ? "Archiving..." : "Download Full Kit (.ZIP)"}
              </span>
              <span className="sm:hidden">ZIP</span>
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-8 pt-12 sm:pt-20 pb-12 border-b border-neutral-800/30">
        <div className="max-w-4xl">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-neutral-400 mb-3">
            <span>// OFFICIAL BRAND DESIGN SYSTEM</span>
            <span>·</span>
            <span>PUBLIC MICROSITE</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05]">
            {portal.whitelabelTitle || `${kit.name} Brand Guidelines`}
          </h1>

          <p className="mt-6 text-lg sm:text-xl font-sans text-neutral-400 leading-relaxed max-w-3xl">
            {portal.whitelabelMetaDescription ||
              kit.brandPositioning ||
              `A centralized, live specification of visual assets, typography hierarchy, color swatches, and editorial voice guidelines for ${kit.name}.`}
          </p>

          {/* Quick Search Bar */}
          <div className="mt-8 relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              type="text"
              placeholder="Search assets, colors (#hex, name), fonts, rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-11 h-12 rounded-xl text-sm font-sans ${
                theme === "dark"
                  ? "bg-neutral-900/90 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-neutral-600"
                  : "bg-white border-neutral-300 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400"
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. Section: Logos & Assets */}
      <section id="logos" className="mx-auto max-w-7xl px-4 sm:px-8 py-16 border-b border-neutral-800/30">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-400">
              // SECTION 01
            </span>
            <h2 className="text-3xl font-serif font-bold">Logo Assets & Packages</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Official vector SVGs and high-resolution raster assets ready for digital and print.
            </p>
          </div>
        </div>

        {filteredAssets.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 p-8 text-center text-sm text-neutral-400 font-mono">
            No assets match your search query.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAssets.map((asset: any) => {
              const bg = selectedAssetBg[asset.id] || "grid";
              const isSvg = asset.url.toLowerCase().endsWith(".svg");

              let bgStyle = "";
              if (bg === "grid") {
                bgStyle =
                  theme === "dark"
                    ? "radial-gradient(#333 1px, transparent 1px) [background-size:16px_16px] bg-[#141414]"
                    : "radial-gradient(#ddd 1px, transparent 1px) [background-size:16px_16px] bg-[#F5F5F5]";
              } else if (bg === "dark") {
                bgStyle = "bg-[#0A0A0A]";
              } else if (bg === "light") {
                bgStyle = "bg-[#FFFFFF]";
              } else if (bg === "brand") {
                bgStyle = primaryColor?.hex ? `bg-[${primaryColor.hex}]` : "bg-neutral-800";
              }

              return (
                <div
                  key={asset.id}
                  className={`rounded-2xl border overflow-hidden flex flex-col transition-all duration-200 ${
                    theme === "dark"
                      ? "border-neutral-800 bg-[#121212] hover:border-neutral-700"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  {/* Canvas Preview Area */}
                  <div
                    className={`h-52 p-8 flex items-center justify-center relative overflow-hidden transition-colors ${bgStyle}`}
                    style={bg === "brand" && primaryColor?.hex ? { backgroundColor: primaryColor.hex } : {}}
                  >
                    {isHttpUrl(asset.url) ? (
                      <img
                        src={asset.url}
                        alt={asset.kind || "Brand asset"}
                        className="max-h-full max-w-full object-contain filter drop-shadow-sm select-none"
                      />
                    ) : (
                      <span className="font-mono text-xs text-neutral-500">Preview Unavailable</span>
                    )}

                    {/* Canvas Background Controls */}
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-md p-1">
                      <button
                        onClick={() => setSelectedAssetBg((p) => ({ ...p, [asset.id]: "grid" }))}
                        className={`h-5 w-5 rounded text-[9px] font-mono flex items-center justify-center ${
                          bg === "grid" ? "bg-white/30 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                        title="Transparent checkerboard"
                      >
                        ░
                      </button>
                      <button
                        onClick={() => setSelectedAssetBg((p) => ({ ...p, [asset.id]: "dark" }))}
                        className={`h-5 w-5 rounded bg-[#0A0A0A] border border-neutral-700 ${
                          bg === "dark" ? "ring-1 ring-white" : ""
                        }`}
                        title="Dark background"
                      />
                      <button
                        onClick={() => setSelectedAssetBg((p) => ({ ...p, [asset.id]: "light" }))}
                        className={`h-5 w-5 rounded bg-white ${bg === "light" ? "ring-1 ring-black" : ""}`}
                        title="Light background"
                      />
                    </div>
                  </div>

                  {/* Metadata & Actions */}
                  <div className="p-4 flex-1 flex flex-col justify-between border-t border-neutral-800/40">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] uppercase tracking-[0.16em] font-semibold text-neutral-300">
                          {asset.kind || "Primary Mark"}
                        </span>
                        <span className="font-mono text-[10px] text-neutral-500 uppercase">
                          {isSvg ? "VECTOR SVG" : "RASTER PNG"}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-neutral-400 font-mono">
                        {asset.width && asset.height && (
                          <span>
                            {asset.width} × {asset.height} px
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-800/30 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadAsset(asset, "svg")}
                        className="flex-1 font-mono text-[10px] uppercase tracking-[0.12em] h-8"
                      >
                        <ArrowDownToLine className="mr-1.5 h-3 w-3" />
                        SVG
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadAsset(asset, "png")}
                        className="flex-1 font-mono text-[10px] uppercase tracking-[0.12em] h-8"
                      >
                        <ArrowDownToLine className="mr-1.5 h-3 w-3" />
                        PNG
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopySvgCode(asset)}
                        className="h-8 px-2"
                        title="Copy raw vector code"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Logo Clearspace & Sizing Guidelines Box */}
        <div
          className={`mt-10 rounded-2xl border p-6 sm:p-8 ${
            theme === "dark" ? "border-neutral-800 bg-[#121212]" : "border-neutral-200 bg-white"
          }`}
        >
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-400 mb-2">
            <span>// USAGE SPECIFICATION</span>
            <span>·</span>
            <span>CLEAR SPACE & MINIMUM SCALING</span>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-4 text-sm font-sans text-neutral-400">
            <div>
              <h4 className="font-semibold text-foreground text-sm font-mono uppercase tracking-wider mb-1">
                Clear Space
              </h4>
              <p className="text-xs leading-relaxed">
                Always maintain minimum clear space equivalent to 1× the height of the brand logomark around
                all sides. Do not intrude text, borders, or graphics within this safety margin.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-sm font-mono uppercase tracking-wider mb-1">
                Minimum Digital Display
              </h4>
              <p className="text-xs leading-relaxed">
                Primary mark: minimum width of <strong className="text-foreground">24px</strong> on screen.
                Full horizontal lockup: minimum width of <strong className="text-foreground">96px</strong> to
                ensure legibility on mobile viewports.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-sm font-mono uppercase tracking-wider mb-1">
                Print Reproducibility
              </h4>
              <p className="text-xs leading-relaxed">
                For offset and digital printing, render with minimum width of{" "}
                <strong className="text-foreground">15mm (0.6in)</strong> at 300 DPI. For monochrome
                applications, use high-contrast solid black or white.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Section: Color System & Swatches */}
      <section id="colors" className="mx-auto max-w-7xl px-4 sm:px-8 py-16 border-b border-neutral-800/30">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-400">
              // SECTION 02
            </span>
            <h2 className="text-3xl font-serif font-bold">Color Palette System</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Harmonious color swatches with 1-click format copying and WCAG AA/AAA contrast validation.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyToClipboard(buildCSS({ colors, fonts, tokens }), "CSS variables")}
            className="font-mono text-[11px] uppercase tracking-[0.14em]"
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copy CSS Variables
          </Button>
        </div>

        {filteredColors.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 p-8 text-center text-sm text-neutral-400 font-mono">
            No colors match your search query.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {filteredColors.map((color: any) => {
              const contrastOnWhite = wcag(color.hex, "#FFFFFF");
              const contrastOnDark = wcag(color.hex, "#0A0A0A");
              const hsl = hexToHslString(color.hex);
              const [r, g, b] = hexToRgb(color.hex);
              const rgbStr = `rgb(${r}, ${g}, ${b})`;
              const cssVarStr = `var(--color-${(color.role || color.name || "brand").toLowerCase().replace(/[^a-z0-9]+/g, "-")})`;

              return (
                <div
                  key={color.id}
                  className={`rounded-2xl border overflow-hidden flex flex-col transition-all duration-200 ${
                    theme === "dark"
                      ? "border-neutral-800 bg-[#121212] hover:border-neutral-700"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  {/* Swatch Header */}
                  <div
                    className="h-32 w-full p-4 flex flex-col justify-between transition-transform duration-300 relative group cursor-pointer"
                    style={{ backgroundColor: color.hex }}
                    onClick={() => {
                      copyToClipboard(color.hex, color.hex);
                      setCopiedKey(color.hex);
                      setTimeout(() => setCopiedKey(null), 1500);
                    }}
                    title="Click to copy HEX"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.2em] font-semibold px-2 py-0.5 rounded backdrop-blur-sm"
                        style={{
                          color: contrastOnWhite.ratio < contrastOnDark.ratio ? "#FFFFFF" : "#0A0A0A",
                          backgroundColor:
                            contrastOnWhite.ratio < contrastOnDark.ratio
                              ? "rgba(0,0,0,0.3)"
                              : "rgba(255,255,255,0.4)",
                        }}
                      >
                        {color.role || "Color"}
                      </span>
                      <div
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded backdrop-blur-sm"
                        style={{
                          backgroundColor:
                            contrastOnWhite.ratio < contrastOnDark.ratio
                              ? "rgba(0,0,0,0.4)"
                              : "rgba(255,255,255,0.5)",
                          color: contrastOnWhite.ratio < contrastOnDark.ratio ? "#FFFFFF" : "#0A0A0A",
                        }}
                      >
                        {copiedKey === color.hex ? (
                          <Check className="h-3.5 w-3.5 text-green-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Swatch Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-serif text-lg font-bold truncate">{color.name || color.hex}</h3>

                      {/* 1-Click Values */}
                      <div className="mt-3 space-y-1.5 font-mono text-xs">
                        <button
                          onClick={() => copyToClipboard(color.hex, "HEX")}
                          className="w-full flex items-center justify-between p-1.5 rounded hover:bg-neutral-800/40 text-left transition-colors"
                        >
                          <span className="text-neutral-500 uppercase text-[10px]">HEX</span>
                          <span className="font-semibold text-foreground">{color.hex.toUpperCase()}</span>
                        </button>
                        <button
                          onClick={() => copyToClipboard(rgbStr, "RGB")}
                          className="w-full flex items-center justify-between p-1.5 rounded hover:bg-neutral-800/40 text-left transition-colors"
                        >
                          <span className="text-neutral-500 uppercase text-[10px]">RGB</span>
                          <span className="text-neutral-300 text-[11px]">{rgbStr}</span>
                        </button>
                        <button
                          onClick={() => copyToClipboard(hsl, "HSL")}
                          className="w-full flex items-center justify-between p-1.5 rounded hover:bg-neutral-800/40 text-left transition-colors"
                        >
                          <span className="text-neutral-500 uppercase text-[10px]">HSL</span>
                          <span className="text-neutral-300 text-[11px]">{hsl}</span>
                        </button>
                        <button
                          onClick={() => copyToClipboard(cssVarStr, "CSS Var")}
                          className="w-full flex items-center justify-between p-1.5 rounded hover:bg-neutral-800/40 text-left transition-colors truncate"
                          title={cssVarStr}
                        >
                          <span className="text-neutral-500 uppercase text-[10px]">VAR</span>
                          <span className="text-neutral-400 text-[10px] truncate max-w-[140px]">
                            {cssVarStr}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* WCAG Contrast Ratings */}
                    <div className="mt-4 pt-3 border-t border-neutral-800/40 flex items-center justify-between text-[10px] font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-500">Dark:</span>
                        <span
                          className={`font-semibold ${
                            contrastOnDark.ratio >= 4.5
                              ? "text-emerald-400"
                              : contrastOnDark.ratio >= 3.0
                                ? "text-amber-400"
                                : "text-neutral-500"
                          }`}
                        >
                          {contrastOnDark.ratio.toFixed(1)}:1 {contrastOnDark.aaa ? "AAA" : contrastOnDark.aa ? "AA" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-500">Light:</span>
                        <span
                          className={`font-semibold ${
                            contrastOnWhite.ratio >= 4.5
                              ? "text-emerald-400"
                              : contrastOnWhite.ratio >= 3.0
                                ? "text-amber-400"
                                : "text-neutral-500"
                          }`}
                        >
                          {contrastOnWhite.ratio.toFixed(1)}:1 {contrastOnWhite.aaa ? "AAA" : contrastOnWhite.aa ? "AA" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Section: Typography & Interactive Specimen */}
      <section id="typography" className="mx-auto max-w-7xl px-4 sm:px-8 py-16 border-b border-neutral-800/30">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-400">
              // SECTION 03
            </span>
            <h2 className="text-3xl font-serif font-bold">Typography System</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Font hierarchy, interactive specimen playground, and direct provider download links.
            </p>
          </div>
        </div>

        {/* Interactive Specimen Playground */}
        <div
          className={`mb-10 rounded-2xl border p-6 sm:p-8 ${
            theme === "dark" ? "border-neutral-800 bg-[#121212]" : "border-neutral-200 bg-white"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800/40 pb-4 mb-6">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-400">
              <Type className="h-3.5 w-3.5" />
              <span>// LIVE SPECIMEN TESTER</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-neutral-400">{fontSize}px</span>
              <input
                type="range"
                min="16"
                max="72"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                className="w-32 accent-foreground cursor-pointer"
              />
            </div>
          </div>

          <Input
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            placeholder="Type custom text to test font rendering..."
            className="mb-6 font-mono text-xs bg-transparent border-neutral-800"
          />

          <div className="space-y-6">
            {fonts.map((f: any) => (
              <div key={f.id} className="border-b border-neutral-800/20 pb-6 last:border-none">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-400 mb-2">
                  <span>
                    {f.role ? f.role.toUpperCase() : "FONT"} · {f.family}
                  </span>
                  <span>{f.googleFont ? "Google Fonts CDN" : f.provider || "System Font"}</span>
                </div>
                <p
                  style={{
                    fontFamily: `"${f.family}", ${f.role === "mono" ? "monospace" : "serif"}`,
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.2,
                  }}
                  className="font-normal tracking-tight break-words"
                >
                  {sampleText || "The quick brown fox jumps over the lazy dog."}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Font Family Cards & Download Links */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFonts.map((f: any) => (
            <div
              key={f.id}
              className={`rounded-2xl border p-6 flex flex-col justify-between ${
                theme === "dark" ? "border-neutral-800 bg-[#121212]" : "border-neutral-200 bg-white"
              }`}
            >
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  {f.role || "Primary"} Font
                </span>
                <h3 className="mt-1 text-2xl font-bold font-serif">{f.family}</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(f.weights || ["400", "700"]).map((w: string) => (
                    <span
                      key={w}
                      className="px-2 py-0.5 rounded font-mono text-[10px] border border-neutral-800 bg-neutral-900/50 text-neutral-300"
                    >
                      W{w}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-neutral-400 leading-relaxed font-sans">
                  {f.licenseNote || (f.googleFont ? "Open Font License (OFL) · Free for commercial use." : "Standard Brand License.")}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-neutral-800/40 flex items-center justify-between">
                {f.googleFont ? (
                  <a
                    href={`https://fonts.google.com/specimen/${encodeURIComponent(f.family)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-[11px] text-neutral-300 hover:text-foreground transition-colors uppercase tracking-wider"
                  >
                    <Globe className="h-3 w-3" />
                    Google Fonts <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ) : f.providerUrl ? (
                  <a
                    href={f.providerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-[11px] text-neutral-300 hover:text-foreground transition-colors uppercase tracking-wider"
                  >
                    <Download className="h-3 w-3" />
                    Download Font <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ) : (
                  <span className="font-mono text-[10px] text-neutral-500 uppercase">System Distributed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Section: Brand Voice, Tone & Messaging */}
      {voice && (
        <section id="voice" className="mx-auto max-w-7xl px-4 sm:px-8 py-16 border-b border-neutral-800/30">
          <div className="mb-8">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-400">
              // SECTION 04
            </span>
            <h2 className="text-3xl font-serif font-bold">Brand Voice & Messaging Guide</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Core personality, tone spectrum, lexicon guidance, and approved boilerplates for communications.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Personality Summary & Tone */}
            <div
              className={`rounded-2xl border p-6 sm:p-8 flex flex-col justify-between ${
                theme === "dark" ? "border-neutral-800 bg-[#121212]" : "border-neutral-200 bg-white"
              }`}
            >
              <div>
                <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-400 mb-2">
                  // BRAND POSITIONING & VOICE
                </h3>
                <p className="font-serif text-xl sm:text-2xl leading-relaxed text-foreground italic">
                  "{voice.summary || kit.brandPositioning || "Bold, thoughtful, and unmistakably authentic."}"
                </p>

                {/* Tone Spectrum Matrix */}
                <div className="mt-8 space-y-4">
                  <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">
                    Tone Spectrum
                  </h4>
                  <div className="space-y-3 font-mono text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1 text-neutral-400">
                        <span>Formal</span>
                        <span className="text-foreground font-semibold">Balanced & Modern</span>
                        <span>Conversational</span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                        <div className="h-full bg-foreground rounded-full w-[65%]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1 text-neutral-400">
                        <span>Serious</span>
                        <span className="text-foreground font-semibold">Witty & Elevated</span>
                        <span>Playful</span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                        <div className="h-full bg-foreground rounded-full w-[45%]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1 text-neutral-400">
                        <span>Technical</span>
                        <span className="text-foreground font-semibold">Accessible Excellence</span>
                        <span>Simple</span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                        <div className="h-full bg-foreground rounded-full w-[55%]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Approved Elevator Pitch */}
              {voice.samples?.headline && (
                <div className="mt-8 pt-6 border-t border-neutral-800/40">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                    <span>Approved Elevator Pitch</span>
                    <button
                      onClick={() => copyToClipboard(voice.samples.headline, "Elevator pitch")}
                      className="hover:text-foreground inline-flex items-center gap-1"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                  <p className="text-sm font-sans text-neutral-300">{voice.samples.headline}</p>
                </div>
              )}
            </div>

            {/* Lexicon: Words We Love vs Words We Avoid */}
            <div
              className={`rounded-2xl border p-6 sm:p-8 flex flex-col justify-between ${
                theme === "dark" ? "border-neutral-800 bg-[#121212]" : "border-neutral-200 bg-white"
              }`}
            >
              <div>
                <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-400 mb-4">
                  // BRAND LEXICON
                </h3>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400 flex items-center gap-1.5 mb-2">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Words We Embrace
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(voice.vocabulary?.length
                        ? voice.vocabulary
                        : ["Visionary", "Crafted", "Precision", "Resilient", "Seamless", "Human"]
                      ).map((w: string) => (
                        <span
                          key={w}
                          className="px-2.5 py-1 rounded-md bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 font-sans text-xs"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-400 flex items-center gap-1.5 mb-2">
                      <XCircle className="h-3.5 w-3.5" /> Words We Avoid
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {["Cheap", "Disruptive", "Synergy", "Viral", "Basic", "Rockstar"].map((w) => (
                        <span
                          key={w}
                          className="px-2.5 py-1 rounded-md bg-red-950/20 border border-red-900/30 text-red-300/80 font-sans text-xs line-through"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 7. Section: Rules — Do's & Don'ts */}
      <section id="guidelines" className="mx-auto max-w-7xl px-4 sm:px-8 py-16 border-b border-neutral-800/30">
        <div className="mb-8">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-400">
            // SECTION 05
          </span>
          <h2 className="text-3xl font-serif font-bold">Brand Rules: Do's & Don'ts</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Clear visual standards to preserve brand consistency and visual integrity.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* DO's Card */}
          <div
            className={`rounded-2xl border p-6 sm:p-8 ${
              theme === "dark" ? "border-emerald-900/40 bg-emerald-950/10" : "border-emerald-200 bg-emerald-50/50"
            }`}
          >
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs uppercase tracking-[0.2em] mb-4">
              <CheckCircle2 className="h-4 w-4" />
              <span>Approved Usage (Do's)</span>
            </div>
            <ul className="space-y-3 font-sans text-sm text-neutral-300">
              {(voice?.dos?.length
                ? voice.dos
                : [
                    "Preserve aspect ratio and proportions when resizing all logos.",
                    "Use approved contrasting backgrounds with minimum 4.5:1 WCAG ratio.",
                    "Allow 1× clearspace margin around all brand elements.",
                    "Use official typography scale for headers and body copy.",
                    "Pair primary dark mark on light washi paper and light mark on dark backgrounds.",
                  ]
              ).map((rule: string, i: number) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* DON'T's Card */}
          <div
            className={`rounded-2xl border p-6 sm:p-8 ${
              theme === "dark" ? "border-red-900/40 bg-red-950/10" : "border-red-200 bg-red-50/50"
            }`}
          >
            <div className="flex items-center gap-2 text-red-400 font-mono text-xs uppercase tracking-[0.2em] mb-4">
              <XCircle className="h-4 w-4" />
              <span>Anti-Patterns (Don'ts)</span>
            </div>
            <ul className="space-y-3 font-sans text-sm text-neutral-300">
              {(voice?.donts?.length
                ? voice.donts
                : [
                    "Never stretch, rotate, or distort logo marks or letterforms.",
                    "Do not place logos directly over busy, high-frequency photography.",
                    "Do not apply unapproved drop shadows, gradient fills, or outer glows.",
                    "Do not alter brand colors or substitute unauthorized accent hues.",
                    "Do not crowd the mark or violate the 1× safety margin boundary.",
                  ]
              ).map((rule: string, i: number) => (
                <li key={i} className="flex items-start gap-2.5">
                  <X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 8. Section: Code & Design Tokens */}
      <section id="tokens" className="mx-auto max-w-7xl px-4 sm:px-8 py-16 border-b border-neutral-800/30">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-400">
              // SECTION 06
            </span>
            <h2 className="text-3xl font-serif font-bold">Design Tokens & Code Export</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Production-ready token specifications for Web, React, Tailwind v4, and Figma.
            </p>
          </div>
        </div>

        <div
          className={`rounded-2xl border overflow-hidden ${
            theme === "dark" ? "border-neutral-800 bg-[#121212]" : "border-neutral-200 bg-white"
          }`}
        >
          <div className="p-4 border-b border-neutral-800/40 flex items-center justify-between">
            <span className="font-mono text-xs text-neutral-400">// CSS VARIABLES (PURE CSS)</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(buildCSS({ colors, fonts, tokens }), "CSS variables")}
              className="font-mono text-[10px] uppercase tracking-wider h-7"
            >
              <Copy className="mr-1 h-3 w-3" /> Copy CSS
            </Button>
          </div>
          <pre className="p-6 font-mono text-xs overflow-x-auto text-neutral-300 max-h-72 leading-relaxed">
            <code>{buildCSS({ colors, fonts, tokens })}</code>
          </pre>
        </div>
      </section>

      {/* 9. Footer & Whitelabeling */}
      <footer className="mx-auto max-w-7xl px-4 sm:px-8 py-12 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-neutral-500">
        <div>
          <span>© {new Date().getFullYear()} {kit.name}. All Rights Reserved.</span>
        </div>

        {/* Whitelabel Check: If remove badge is FALSE, display subtle watermark */}
        {!portal.whitelabelRemoveBadge && (
          <div className="flex items-center gap-1.5 text-neutral-400">
            <span>Powered by</span>
            <a
              href="https://branddna.app"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-foreground hover:underline"
            >
              Brand Muse / Brand DNA
            </a>
          </div>
        )}
      </footer>
    </div>
  );
}
