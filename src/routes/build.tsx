import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { getAnonToken } from "@/lib/anon";
import { createKit, getKit } from "@/lib/kits.functions";
import { extractKit } from "@/lib/extraction.functions";
import { uploadBrandSource } from "@/lib/uploads.functions";
import { scrapeSourceText, saveManualKit } from "@/lib/manual.functions";

export const Route = createFileRoute("/build")({
  component: BuildPage,
  head: () => ({
    meta: [
      { title: "Build a kit by hand — Brand Kit" },
      {
        name: "description",
        content:
          "Upload your own PDFs and websites, then set the palette, typography and tokens yourself to build a brand kit by hand.",
      },
      { property: "og:title", content: "Build a kit by hand — Brand Kit" },
      {
        property: "og:description",
        content:
          "Add your PDFs and site URLs, read the source text, and hand-build the palette, type and tokens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type ColorRow = { hex: string; name: string; role: string };
type FontRow = { family: string; role: string; weights: string };
type TokenRow = { category: string; name: string; value: string };

const MAX_FILES = 10;
const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.svg,image/*,application/pdf";

const labelClass = "font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground";
const sectionTitleClass = "font-mono text-[12px] uppercase tracking-[0.18em] text-foreground";
const ghostBtn =
  "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-muted disabled:opacity-40";
const solidBtn =
  "inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 font-mono text-[12px] uppercase tracking-[0.1em] text-background transition-opacity hover:opacity-90 disabled:opacity-40";

function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    new URL(withProto);
    return withProto;
  } catch {
    return null;
  }
}

function BuildPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const ownerToken = user?.id ?? getAnonToken();

  const create = useServerFn(createKit);
  const upload = useServerFn(uploadBrandSource);
  const scrape = useServerFn(scrapeSourceText);
  const save = useServerFn(saveManualKit);
  const extract = useServerFn(extractKit);
  const fetchKit = useServerFn(getKit);

  const kitIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("Untitled brand kit");
  const [urls, setUrls] = useState<string[]>([""]);
  const [files, setFiles] = useState<File[]>([]);
  const [sourceText, setSourceText] = useState("");
  const [reading, setReading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [colors, setColors] = useState<ColorRow[]>([
    { hex: "#111111", name: "Ink", role: "primary" },
  ]);
  const [fonts, setFonts] = useState<FontRow[]>([
    { family: "Inter", role: "heading", weights: "400,700" },
  ]);
  const [tokens, setTokens] = useState<TokenRow[]>([
    { category: "radius", name: "radius-md", value: "8px" },
  ]);

  async function ensureKit(): Promise<string> {
    if (kitIdRef.current) return kitIdRef.current;
    const firstUrl = urls.map(normalizeUrl).find((u): u is string => !!u);
    const { id } = await create({
      data: {
        ownerToken,
        isAuthed: !!user,
        sourceType: "manual",
        sourceUrl: firstUrl,
        name: name.trim() || "Untitled brand kit",
      },
    });
    kitIdRef.current = id;
    return id;
  }

  function addFiles(incoming: FileList | File[]) {
    const next: File[] = [];
    for (const f of Array.from(incoming)) {
      if (f.size > MAX_BYTES) {
        toast.error(`"${f.name}" exceeds 20 MB`);
        continue;
      }
      next.push(f);
    }
    setFiles((prev) => [...prev, ...next].slice(0, MAX_FILES));
  }

  async function readSources() {
    if (reading) return;
    const cleanUrls = urls.map(normalizeUrl).filter((u): u is string => !!u);
    if (!cleanUrls.length && !files.length) {
      toast.error("Add a link or a file first");
      return;
    }
    setReading(true);
    try {
      const kitId = await ensureKit();
      const chunks: string[] = [];

      if (files.length) {
        const fd = new FormData();
        fd.append("kitId", kitId);
        fd.append("ownerToken", ownerToken);
        for (const f of files) fd.append("file", f);
        const res = await upload({ data: fd });
        chunks.push(...res.pdfTexts);
        if (res.imageUrls.length) {
          chunks.push(`--- Uploaded images ---\n${res.imageUrls.join("\n")}`);
        }
      }

      if (cleanUrls.length) {
        const res = await scrape({ data: { urls: cleanUrls } });
        for (const t of res.texts) chunks.push(`--- ${t.url} ---\n${t.text}`);
        for (const e of res.errors) toast.warning(`${e.url}: ${e.message}`);
      }

      if (!chunks.length) {
        toast.error("Nothing readable came back from those sources");
      } else {
        setSourceText((prev) =>
          [prev, ...chunks]
            .filter((s) => s && s.trim())
            .join("\n\n---\n\n")
            .slice(0, 200000),
        );
        toast.success("Source text added below");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Could not read those sources");
    } finally {
      setReading(false);
    }
  }

  async function autoBuildKit() {
    if (building) return;
    const cleanUrls = urls.map(normalizeUrl).filter((u): u is string => !!u);
    if (!cleanUrls.length && !files.length) {
      toast.error("Add a link or a file first");
      return;
    }
    setBuilding(true);
    try {
      const kitId = await ensureKit();
      let imageUrls: string[] | undefined;
      let pdfTexts: string[] | undefined;
      const chunks: string[] = [];

      // Upload PDFs / images (same pipeline as the homepage ingestion).
      if (files.length) {
        const fd = new FormData();
        fd.append("kitId", kitId);
        fd.append("ownerToken", ownerToken);
        for (const f of files) fd.append("file", f);
        const res = await upload({ data: fd });
        imageUrls = res.imageUrls.length ? res.imageUrls : undefined;
        pdfTexts = res.pdfTexts.length ? res.pdfTexts : undefined;
        chunks.push(...res.pdfTexts);
        if (res.imageUrls.length)
          chunks.push(`--- Uploaded images ---\n${res.imageUrls.join("\n")}`);
      }

      // For extra links, scrape their text so the AI can use them as context.
      const extraUrls = cleanUrls.slice(1);
      if (extraUrls.length) {
        try {
          const res = await scrape({ data: { urls: extraUrls } });
          for (const t of res.texts) chunks.push(`--- ${t.url} ---\n${t.text}`);
          for (const e of res.errors) toast.warning(`${e.url}: ${e.message}`);
        } catch {
          // Extra context is optional — ignore failures.
        }
      }
      if (chunks.length) {
        setSourceText((prev) =>
          [prev, ...chunks]
            .filter((s) => s && s.trim())
            .join("\n\n---\n\n")
            .slice(0, 200000),
        );
      }

      // Run the same extraction that builds a kit on the homepage, with the
      // current manual rows passed as hints so the AI honours them.
      const manual = {
        brandName: name.trim() && name.trim() !== "Untitled brand kit" ? name.trim() : undefined,
        hexColors: colors
          .map((c) => c.hex.trim())
          .filter((h) => /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(h)),
        fontFamilies: fonts.map((f) => f.family.trim()).filter(Boolean),
      };
      const res = await extract({
        data: {
          kitId,
          ownerToken,
          url: cleanUrls[0],
          imageUrls,
          pdfTexts,
          manual:
            manual.brandName || manual.hexColors.length || manual.fontFamilies.length
              ? manual
              : undefined,
        },
      });
      if (!res.ok) throw new Error(res.error ?? "Extraction failed");
      if ("degraded" in res && res.degraded) {
        toast.warning(
          res.degradedReason ?? "Source could not be read — kit uses generic defaults.",
          {
            duration: 12000,
          },
        );
      }

      // The kit is now saved in the library — pull it back and fill the form.
      const full = await fetchKit({ data: { kitId, ownerToken } });
      if (full.kit?.name) setName(full.kit.name);
      if (full.colors?.length) {
        setColors(
          full.colors.map((c) => ({
            hex: c.hex ?? "",
            name: c.name ?? "",
            role: c.role ?? "",
          })),
        );
      }
      if (full.fonts?.length) {
        setFonts(
          full.fonts.map((f) => ({
            family: f.family ?? "",
            role: f.role ?? "",
            weights: Array.isArray(f.weights) ? f.weights.join(",") : "",
          })),
        );
      }
      if (full.tokens?.length) {
        setTokens(
          full.tokens.map((t) => ({
            category: t.category ?? "",
            name: t.name ?? "",
            value: t.value ?? "",
          })),
        );
      }
      if (full.kit?.source_text) setSourceText(full.kit.source_text);

      toast.success("Kit built and saved to your library", {
        action: {
          label: "Open kit",
          onClick: () => navigate({ to: "/kit/$kitId", params: { kitId } }),
        },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Auto-build failed");
    } finally {
      setBuilding(false);
    }
  }

  async function handleSave() {
    if (saving) return;
    const cleanColors = colors
      .map((c) => ({ ...c, hex: c.hex.trim() }))
      .filter((c) => /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c.hex));
    if (!cleanColors.length) {
      toast.error("Add at least one valid colour");
      return;
    }
    setSaving(true);
    try {
      const kitId = await ensureKit();
      const firstUrl = urls.map(normalizeUrl).find((u): u is string => !!u);
      await save({
        data: {
          kitId,
          name: name.trim() || "Untitled brand kit",
          sourceUrl: firstUrl,
          sourceText: sourceText.trim() || undefined,
          colors: cleanColors.map((c) => ({
            hex: c.hex,
            name: c.name.trim() || undefined,
            role: c.role.trim() || undefined,
          })),
          fonts: fonts
            .filter((f) => f.family.trim())
            .map((f) => ({
              family: f.family.trim(),
              role: f.role.trim() || undefined,
              weights: f.weights
                .split(",")
                .map((w) => w.trim())
                .filter(Boolean),
              google_font: true,
            })),
          tokens: tokens
            .filter((t) => t.category.trim() && t.name.trim() && t.value.trim())
            .map((t) => ({
              category: t.category.trim(),
              name: t.name.trim(),
              value: t.value.trim(),
            })),
        },
      });
      toast.success("Kit saved");
      navigate({ to: "/kit/$kitId", params: { kitId } });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the kit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-10">
          <p className={labelClass}>Manual builder</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Build a kit by hand
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Bring your own PDFs and links, read their text, then set the palette, typography and
            tokens yourself. Nothing is invented for you.
          </p>
        </header>

        {/* Name */}
        <section className="mb-10">
          <label className={labelClass} htmlFor="kit-name">
            Kit name
          </label>
          <Input
            id="kit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 max-w-md"
            placeholder="Untitled brand kit"
          />
        </section>

        {/* Sources */}
        <section className="mb-10 rounded-xl border border-border p-5">
          <h2 className={sectionTitleClass}>1 — Sources</h2>

          <div className="mt-4 space-y-2">
            {urls.map((u, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={u}
                  placeholder="https://example.com or a PDF link"
                  onChange={(e) =>
                    setUrls((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                  }
                />
                <button
                  type="button"
                  aria-label="Remove link"
                  className="rounded-full p-2 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setUrls((prev) =>
                      prev.length === 1 ? [""] : prev.filter((_, idx) => idx !== i),
                    )
                  }
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            ))}
            <button type="button" className={ghostBtn} onClick={() => setUrls((p) => [...p, ""])}>
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Add link
            </button>
          </div>

          <div className="mt-6">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className={ghostBtn}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" strokeWidth={1.5} /> Upload PDFs / images
            </button>
            {files.length > 0 && (
              <ul className="mt-3 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={solidBtn}
              onClick={readSources}
              disabled={reading || building}
            >
              {reading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {reading ? "Reading" : "Read sources"}
            </button>
            <button
              type="button"
              className={ghostBtn}
              onClick={autoBuildKit}
              disabled={reading || building}
            >
              {building ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
              {building ? "Building kit" : "Auto-build with AI"}
            </button>
            <span className="text-xs text-muted-foreground">
              {building
                ? "Scraping your sources, extracting the brand and saving it to your library — the fields below will fill in when it's done."
                : "Read sources pulls the text without changing your choices. Auto-build runs the full extraction, saves it to your library, and fills the fields below for you to tweak."}
            </span>
          </div>

          <div className="mt-6">
            <label className={labelClass} htmlFor="source-text">
              Source text
            </label>
            <textarea
              id="source-text"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              rows={10}
              placeholder="Text from your PDFs and links appears here. You can edit or paste your own."
              className="mt-2 w-full resize-y rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </section>

        {/* Palette */}
        <section className="mb-10 rounded-xl border border-border p-5">
          <h2 className={sectionTitleClass}>2 — Palette</h2>
          <div className="mt-4 space-y-2">
            {colors.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  aria-label={`Colour ${i + 1} swatch`}
                  value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "#000000"}
                  onChange={(e) =>
                    setColors((prev) =>
                      prev.map((v, idx) => (idx === i ? { ...v, hex: e.target.value } : v)),
                    )
                  }
                  className="h-9 w-12 cursor-pointer rounded border border-border bg-background"
                />
                <Input
                  value={c.hex}
                  aria-label={`Colour ${i + 1} hex`}
                  placeholder="#FC3D21"
                  className="w-32 font-mono"
                  onChange={(e) =>
                    setColors((prev) =>
                      prev.map((v, idx) => (idx === i ? { ...v, hex: e.target.value } : v)),
                    )
                  }
                />
                <Input
                  value={c.name}
                  aria-label={`Colour ${i + 1} name`}
                  placeholder="Name"
                  className="w-40"
                  onChange={(e) =>
                    setColors((prev) =>
                      prev.map((v, idx) => (idx === i ? { ...v, name: e.target.value } : v)),
                    )
                  }
                />
                <Input
                  value={c.role}
                  aria-label={`Colour ${i + 1} role`}
                  placeholder="primary / accent / neutral"
                  className="w-48"
                  onChange={(e) =>
                    setColors((prev) =>
                      prev.map((v, idx) => (idx === i ? { ...v, role: e.target.value } : v)),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label="Remove colour"
                  className="rounded-full p-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setColors((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={`${ghostBtn} mt-3`}
            onClick={() => setColors((p) => [...p, { hex: "#000000", name: "", role: "" }])}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Add colour
          </button>
        </section>

        {/* Typography */}
        <section className="mb-10 rounded-xl border border-border p-5">
          <h2 className={sectionTitleClass}>3 — Typography</h2>
          <div className="mt-4 space-y-2">
            {fonts.map((f, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  value={f.family}
                  aria-label={`Font ${i + 1} family`}
                  placeholder="Font family"
                  className="w-56"
                  onChange={(e) =>
                    setFonts((prev) =>
                      prev.map((v, idx) => (idx === i ? { ...v, family: e.target.value } : v)),
                    )
                  }
                />
                <Input
                  value={f.role}
                  aria-label={`Font ${i + 1} role`}
                  placeholder="heading / body / mono"
                  className="w-48"
                  onChange={(e) =>
                    setFonts((prev) =>
                      prev.map((v, idx) => (idx === i ? { ...v, role: e.target.value } : v)),
                    )
                  }
                />
                <Input
                  value={f.weights}
                  aria-label={`Font ${i + 1} weights`}
                  placeholder="400,700"
                  className="w-40 font-mono"
                  onChange={(e) =>
                    setFonts((prev) =>
                      prev.map((v, idx) => (idx === i ? { ...v, weights: e.target.value } : v)),
                    )
                  }
                />
                <span
                  className="px-2 text-lg"
                  style={{ fontFamily: f.family ? `'${f.family}', sans-serif` : undefined }}
                >
                  Ag
                </span>
                <button
                  type="button"
                  aria-label="Remove font"
                  className="rounded-full p-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setFonts((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={`${ghostBtn} mt-3`}
            onClick={() => setFonts((p) => [...p, { family: "", role: "body", weights: "400" }])}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Add font
          </button>
        </section>

        {/* Tokens */}
        <section className="mb-10 rounded-xl border border-border p-5">
          <h2 className={sectionTitleClass}>4 — Tokens</h2>
          <div className="mt-4 space-y-2">
            {tokens.map((t, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  value={t.category}
                  aria-label={`Token ${i + 1} category`}
                  placeholder="radius / spacing / shadow"
                  className="w-48"
                  onChange={(e) =>
                    setTokens((prev) =>
                      prev.map((v, idx) => (idx === i ? { ...v, category: e.target.value } : v)),
                    )
                  }
                />
                <Input
                  value={t.name}
                  aria-label={`Token ${i + 1} name`}
                  placeholder="radius-md"
                  className="w-48 font-mono"
                  onChange={(e) =>
                    setTokens((prev) =>
                      prev.map((v, idx) => (idx === i ? { ...v, name: e.target.value } : v)),
                    )
                  }
                />
                <Input
                  value={t.value}
                  aria-label={`Token ${i + 1} value`}
                  placeholder="8px"
                  className="w-40 font-mono"
                  onChange={(e) =>
                    setTokens((prev) =>
                      prev.map((v, idx) => (idx === i ? { ...v, value: e.target.value } : v)),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label="Remove token"
                  className="rounded-full p-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setTokens((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={`${ghostBtn} mt-3`}
            onClick={() => setTokens((p) => [...p, { category: "spacing", name: "", value: "" }])}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Add token
          </button>
        </section>

        <div className="sticky bottom-4 flex items-center gap-3 rounded-full border border-border bg-background/90 px-4 py-3 backdrop-blur">
          <button
            type="button"
            className={solidBtn}
            onClick={handleSave}
            disabled={saving || building}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Saving" : "Save kit"}
          </button>
          <span className="text-xs text-muted-foreground">
            Saves to your library and opens the kit page.
          </span>
        </div>
      </main>
    </div>
  );
}
