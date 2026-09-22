// Server-side helpers — calls Lovable AI Gateway and Firecrawl.
// Never imported from client code.
import { isBlockedSourceUrl } from "./url-guard.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Transient HTTP statuses that warrant a retry. 429 (rate limit) and 5xx
// (gateway / upstream provider hiccups like 502/503/504) are retried with
// exponential backoff + jitter. 402 (out of credits) and 4xx auth errors
// are NOT retried — they need user action.
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 522, 524]);
const MAX_ATTEMPTS = 2;
const AI_TIMEOUT_MS = 10000;
const SCRAPE_TIMEOUT_MS = 8000;
const DIRECT_SCRAPE_TIMEOUT_MS = 5000;
const MAP_TIMEOUT_MS = 2500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number) {
  // 600ms, 1.2s, 2.4s, 4.8s (+/- 30% jitter)
  const base = 600 * Math.pow(2, attempt - 1);
  const jitter = base * (Math.random() * 0.6 - 0.3);
  return Math.min(15000, Math.round(base + jitter));
}

function timeoutSignal(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function attr(tag: string, name: string) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
}

function absolutize(raw: string | undefined, baseUrl: string) {
  if (!raw || raw.startsWith("data:")) return undefined;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function metaContent(html: string, key: string) {
  const re = /<meta\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const prop = attr(tag, "property") ?? attr(tag, "name");
    if (prop?.toLowerCase() === key.toLowerCase()) return attr(tag, "content");
  }
  return undefined;
}

function htmlToMarkdown(html: string, url: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const description = metaContent(html, "description") ?? metaContent(html, "og:description");
  const text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return [`# ${title || url}`, description, text.slice(0, 60000)].filter(Boolean).join("\n\n");
}

async function directScrape(url: string) {
  if (isBlockedSourceUrl(url)) throw new Error("Source URL is not allowed");
  const timeout = timeoutSignal(DIRECT_SCRAPE_TIMEOUT_MS);
  const res = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      // A real browser UA — custom bot UAs are rejected (403) by most WAFs.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Upgrade-Insecure-Requests": "1",
    },
    redirect: "follow",
    signal: timeout.signal,
  }).finally(timeout.clear);
  if (!res.ok) throw new Error(`Direct scrape failed [${res.status}]`);

  const contentType = res.headers.get("content-type") ?? "";
  const html = await res.text();
  if (!contentType.includes("html") && !/<html|<title|<body/i.test(html)) {
    throw new Error("Source did not return HTML");
  }
  const links = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)]
    .map((m) => absolutize(m[1], url))
    .filter((v): v is string => !!v)
    .slice(0, 120);
  const iconTag = html.match(
    /<link\b[^>]*rel\s*=\s*["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]*>/i,
  )?.[0];
  const logoTag = html.match(/<img\b[^>]*(?:logo|wordmark|brand)[^>]*>/i)?.[0];
  const ogImage = absolutize(
    metaContent(html, "og:image") ?? metaContent(html, "twitter:image"),
    url,
  );
  const favicon = absolutize(attr(iconTag ?? "", "href"), url);
  const logo = absolutize(attr(logoTag ?? "", "src") ?? attr(logoTag ?? "", "data-src"), url);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const description = metaContent(html, "description") ?? metaContent(html, "og:description");
  return {
    data: {
      markdown: htmlToMarkdown(html, url),
      rawHtml: html.slice(0, 250000),
      html: html.slice(0, 250000),
      links,
      branding: {
        name: title,
        summary: description,
        images: { logo, favicon, ogImage },
      },
    },
  };
}

export async function callAI(opts: {
  model?: string;
  system?: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: any }>;
  tools?: any[];
  tool_choice?: any;
  temperature?: number;
}) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");

  const messages = opts.system
    ? [{ role: "system" as const, content: opts.system }, ...opts.messages]
    : opts.messages;

  const body: any = {
    model: opts.model ?? "google/gemini-3-flash-preview",
    messages,
  };
  if (opts.tools) body.tools = opts.tools;
  if (opts.tool_choice) body.tool_choice = opts.tool_choice;
  if (opts.temperature != null) body.temperature = opts.temperature;

  const payload = JSON.stringify(body);
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    const timeout = timeoutSignal(AI_TIMEOUT_MS);
    try {
      res = await fetch(GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: payload,
        signal: timeout.signal,
      });
    } catch (err) {
      // Network-level failure (DNS, socket reset, abort). Retry.
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(backoffMs(attempt));
        continue;
      }
      const name = (err as Error)?.name;
      throw new Error(
        name === "AbortError"
          ? "AI gateway timeout"
          : `AI gateway unreachable: ${(err as Error)?.message ?? "network error"}`,
      );
    } finally {
      timeout.clear();
    }

    if (res.ok) return res.json();

    // Read body once for error context.
    const text = await res.text().catch(() => "");

    // Non-retryable terminal failures.
    if (res.status === 402) {
      throw new Error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`AI gateway auth error ${res.status}: ${text.slice(0, 200)}`);
    }

    if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_ATTEMPTS) {
      // Honor Retry-After if present, else exponential backoff.
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(15000, retryAfter * 1000)
          : backoffMs(attempt);
      console.warn(
        `[ai] gateway ${res.status} on attempt ${attempt}/${MAX_ATTEMPTS}, retrying in ${wait}ms`,
      );
      await sleep(wait);
      lastErr = new Error(`AI gateway error ${res.status}`);
      continue;
    }

    if (res.status === 429) {
      throw new Error("AI is busy right now. Please retry in a moment.");
    }
    throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 300)}`);
  }

  throw lastErr instanceof Error ? lastErr : new Error("AI gateway failed after multiple retries");
}

export async function callAIStructured<T>(opts: {
  system: string;
  user: string | any[];
  toolName: string;
  toolDescription: string;
  parameters: any;
  model?: string;
}): Promise<T> {
  const data = await callAI({
    model: opts.model,
    system: opts.system,
    messages: [{ role: "user", content: opts.user as any }],
    tools: [
      {
        type: "function",
        function: {
          name: opts.toolName,
          description: opts.toolDescription,
          parameters: opts.parameters,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: opts.toolName } },
  });
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("AI did not return structured output");
  return JSON.parse(call.function.arguments) as T;
}

const FIRECRAWL_API = "https://api.firecrawl.dev";
const FIRECRAWL_GATEWAY = "https://connector-gateway.lovable.dev/firecrawl";

// Gateway-backed connections hand out a Lovable connection key (lovc_*), which
// must be paired with LOVABLE_API_KEY and sent to the connector gateway.
// Legacy connections hand out a real Firecrawl key (fc-*) used directly.
function firecrawlRequest(path: string) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (key.startsWith("lovc_")) {
    if (!lovableKey) return null;
    return {
      url: `${FIRECRAWL_GATEWAY}${path}`,
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": key,
        "Content-Type": "application/json",
      } as Record<string, string>,
    };
  }
  return {
    url: `${FIRECRAWL_API}${path}`,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    } as Record<string, string>,
  };
}

function looksLikeDocument(url: string) {
  return /\.(pdf|docx?|pptx?)(\?|#|$)/i.test(url);
}

export async function firecrawlScrape(url: string) {
  const req = firecrawlRequest("/v2/scrape");
  if (!req) return directScrape(url);
  const isDoc = looksLikeDocument(url);

  async function apiScrape() {
    const timeout = timeoutSignal(isDoc ? 60000 : SCRAPE_TIMEOUT_MS);
    try {
      const res = await fetch(req!.url, {
        method: "POST",
        headers: req!.headers,
        body: JSON.stringify({
          url,
          formats: isDoc ? ["markdown"] : ["markdown", "rawHtml", "links", "branding", "summary"],
          onlyMainContent: false,
          timeout: isDoc ? 55000 : 7000,
        }),
        signal: timeout.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Firecrawl scrape failed [${res.status}]: ${text.slice(0, 300)}`);
      }
      return res.json();
    } finally {
      timeout.clear();
    }
  }

  // Documents (PDFs etc.) can't be parsed by the direct HTML fetch fallback.
  if (isDoc) return apiScrape();

  try {
    return await Promise.any([directScrape(url), apiScrape()]);
  } catch (e: any) {
    const errors = Array.isArray(e?.errors) ? e.errors : [];
    const best =
      errors.find((err: any) => err?.message && err.name !== "AbortError") ?? errors[0] ?? e;
    throw best;
  }
}

// Map a site to discover URLs. Returns up to `limit` links.
export async function firecrawlMap(url: string, limit = 50): Promise<string[]> {
  const req = firecrawlRequest("/v2/map");
  if (!req) return [];
  if (looksLikeDocument(url)) return [];
  try {
    const timeout = timeoutSignal(MAP_TIMEOUT_MS);
    const res = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify({ url, limit, includeSubdomains: false }),
      signal: timeout.signal,
    }).finally(timeout.clear);
    if (!res.ok) return [];
    const json: any = await res.json();
    const links: string[] = json.links ?? json.data?.links ?? [];
    return Array.isArray(links) ? links : [];
  } catch {
    return [];
  }
}

// ============================================================================
// Generative Marketing Studio — AI Brand Copywriter & Headline Generator.
// Reads the kit's extracted voice + positioning and synthesizes structured
// marketing copy strictly in that persona.
// ============================================================================

export const STUDIO_ASSET_TYPES = [
  "linkedin-banner",
  "twitter-header",
  "instagram-post",
  "og-card",
  "deck-cover",
] as const;

export type StudioAssetType = (typeof STUDIO_ASSET_TYPES)[number];

export type BrandCopy = {
  headlines: string[];
  valueProps: string[];
  ctas: string[];
  caption: string;
};

function fallbackBrandCopy(brandName: string, topic: string): BrandCopy {
  const subject = topic.trim() || "the latest release";
  const name = brandName.trim() || "Brand";
  return {
    headlines: [
      `${name} on ${subject}`,
      `A clear take on ${subject}`,
      `${subject}, in the voice of ${name}`,
    ],
    valueProps: [`Built around ${subject} with intent`, `Documented, structured, ready to use`],
    ctas: ["Explore the system", "Read the guide", "Start extracting"],
    caption: `${name} on ${subject}. Colors. Typography. Voice. Tokens. #brand #design #identity`,
  };
}

function normalizeBrandCopy(raw: unknown, brandName: string, topic: string): BrandCopy {
  const fallback = fallbackBrandCopy(brandName, topic);
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Record<string, unknown>;
  const pick = (v: unknown, n: number, fb: string[]): string[] => {
    const list = Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
    const cleaned = list
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, n);
    while (cleaned.length < n) cleaned.push(fb[cleaned.length] ?? fb[0]);
    return cleaned;
  };
  const caption =
    typeof r.caption === "string" && r.caption.trim() ? r.caption.trim() : fallback.caption;
  return {
    headlines: pick(r.headlines, 3, fallback.headlines),
    valueProps: pick(r.valueProps ?? r.value_props, 2, fallback.valueProps),
    ctas: pick(r.ctas, 3, fallback.ctas),
    caption,
  };
}

// Server function: synthesize on-brand marketing copy for a studio asset.
// Feed the extracted brand voice (tone, dos, donts, vocabulary) plus brand
// positioning so the LLM adheres strictly to the brand's persona.
export async function generateBrandCopyServerFn(input: {
  kitId: string;
  assetType: StudioAssetType | string;
  topic?: string;
}): Promise<BrandCopy> {
  const kitId = String(input.kitId ?? "");
  const assetType = String(input.assetType ?? "og-card");
  const topic = String(input.topic ?? "").slice(0, 300);

  const { db, brandKits, kitVoice } = await import("@/db/index.server");
  const { eq } = await import("drizzle-orm");
  const [voiceRows, kitRows] = await Promise.all([
    db
      .select({
        tone: kitVoice.tone,
        vocabulary: kitVoice.vocabulary,
        dos: kitVoice.dos,
        donts: kitVoice.donts,
        samples: kitVoice.samples,
        summary: kitVoice.summary,
      })
      .from(kitVoice)
      .where(eq(kitVoice.kitId, kitId))
      .limit(1),
    db
      .select({ name: brandKits.name, brandPositioning: brandKits.brandPositioning })
      .from(brandKits)
      .where(eq(brandKits.id, kitId))
      .limit(1),
  ]);
  const voice = voiceRows[0] ?? null;
  const kit = kitRows[0] ?? null;
  if (!kit) throw new Error("Kit not found");
  const brandName = String(kit.name ?? "Brand");
  const positioning = kit.brandPositioning ?? null;

  const system = [
    `You are a senior brand copywriter. Brand: ${brandName}.`,
    `Tone: ${JSON.stringify((voice as { tone?: unknown } | null)?.tone ?? [])}`,
    `Vocabulary to favor: ${JSON.stringify((voice as { vocabulary?: unknown } | null)?.vocabulary ?? [])}`,
    `DO: ${JSON.stringify((voice as { dos?: unknown } | null)?.dos ?? [])}`,
    `DON'T: ${JSON.stringify((voice as { donts?: unknown } | null)?.donts ?? [])}`,
    `Existing samples: ${JSON.stringify((voice as { samples?: unknown } | null)?.samples ?? {})}`,
    `Brand positioning: ${JSON.stringify(positioning)}`,
    "Match this voice exactly. Short sentences. No exclamation marks.",
    "No hype words (powerful, seamless, game-changing, next-level). No speed claims.",
    "Return exactly 3 headlines, 2 value props, 3 CTA labels, 1 social caption with hashtags.",
  ].join("\n");

  const user = `Write marketing copy for asset type "${assetType}" about: ${topic || "the brand itself"}`;

  try {
    const raw = await callAIStructured<unknown>({
      system,
      user,
      toolName: "save_brand_copy",
      toolDescription: "Save structured on-brand marketing copy for a social asset.",
      parameters: {
        type: "object",
        properties: {
          headlines: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 3,
          },
          valueProps: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 2,
          },
          ctas: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
          caption: { type: "string" },
        },
        required: ["headlines", "valueProps", "ctas", "caption"],
      },
    });
    return normalizeBrandCopy(raw, brandName, topic);
  } catch (e) {
    console.warn("[generateBrandCopyServerFn] AI failed, using fallback", e);
    return fallbackBrandCopy(brandName, topic);
  }
}

// ============================================================================
// Competitive Intelligence — Market White-Space Discovery.
// Compares 2-4 kits and identifies saturated color bands, unoccupied aesthetic
// territory, and GTM differentiation vectors.
// ============================================================================

export type MarketNiche = {
  saturatedBands: Array<{ band: string; detail: string }>;
  openTerritory: Array<{ band: string; exemplar: string; rationale: string }>;
  vectors: string[];
  temperatureNote: string;
};

export async function analyzeMarketNicheServerFn(input: {
  kitIds: string[];
}): Promise<MarketNiche> {
  const ids = [...new Set((input.kitIds ?? []).map((s) => String(s)).filter(Boolean))].slice(0, 4);
  if (ids.length < 2) throw new Error("Select at least two kits to analyze the market.");

  const { db, brandKits, kitColors, kitFonts, kitVoice } = await import("@/db/index.server");
  const { analyzeWhiteSpace } = await import("../lib/intelligence");
  const { asc, inArray } = await import("drizzle-orm");

  const [kits, colors, fonts, voices] = await Promise.all([
    db
      .select({
        id: brandKits.id,
        name: brandKits.name,
        brandPositioning: brandKits.brandPositioning,
      })
      .from(brandKits)
      .where(inArray(brandKits.id, ids)),
    db
      .select({
        kitId: kitColors.kitId,
        hex: kitColors.hex,
        role: kitColors.role,
        name: kitColors.name,
      })
      .from(kitColors)
      .where(inArray(kitColors.kitId, ids))
      .orderBy(asc(kitColors.position)),
    db
      .select({
        kitId: kitFonts.kitId,
        family: kitFonts.family,
        role: kitFonts.role,
        weights: kitFonts.weights,
      })
      .from(kitFonts)
      .where(inArray(kitFonts.kitId, ids))
      .orderBy(asc(kitFonts.position)),
    db
      .select({
        kitId: kitVoice.kitId,
        tone: kitVoice.tone,
        vocabulary: kitVoice.vocabulary,
        dos: kitVoice.dos,
        donts: kitVoice.donts,
        samples: kitVoice.samples,
        summary: kitVoice.summary,
      })
      .from(kitVoice)
      .where(inArray(kitVoice.kitId, ids)),
  ]);
  if (!kits || kits.length < 2) throw new Error("Could not load the selected kits.");

  const byKit = <T extends { kitId: string }>(rows: T[] | null) => {
    const map = new Map<string, Array<Record<string, unknown>>>();
    for (const r of rows ?? []) {
      const list = map.get(r.kitId) ?? [];
      list.push(r as Record<string, unknown>);
      map.set(r.kitId, list);
    }
    return map;
  };
  const colorMap = byKit(colors);
  const fontMap = byKit(fonts);
  const voiceMap = new Map((voices ?? []).map((v) => [v.kitId, v]));

  const compared = kits.map((k) => ({
    id: k.id,
    name: String(k.name ?? "Untitled"),
    colors: ((colorMap.get(k.id) ?? []) as Array<{ hex: string; role?: string | null }>) ?? [],
    fonts:
      ((fontMap.get(k.id) ?? []) as Array<{
        family?: string | null;
        role?: string | null;
        weights?: unknown;
      }>) ?? [],
    voice: (voiceMap.get(k.id) as never) ?? null,
    positioning: k.brandPositioning ?? null,
  }));

  const deterministic = analyzeWhiteSpace(compared);
  const fallback: MarketNiche = {
    saturatedBands: deterministic.saturatedBands.map((b) => ({
      band: b.band,
      detail: `${Math.round(b.kitShare * 100)}% of this cohort uses ${b.band} (${b.exemplar})${b.exampleHexes.length ? ` — e.g. ${b.exampleHexes.join(", ")}` : ""}.`,
    })),
    openTerritory: deterministic.openTerritory.map((t) => ({
      band: t.band,
      exemplar: t.exemplar,
      rationale: t.suggestion,
    })),
    vectors: deterministic.vectors,
    temperatureNote: deterministic.temperatureNote,
  };

  const brief = compared
    .map((k) => {
      const hexes = k.colors.map((c) => c.hex).join(", ");
      const fams = k.fonts.map((f) => f.family).join(", ");
      return `- ${k.name}: colors [${hexes || "none"}]; fonts [${fams || "none"}]; positioning ${JSON.stringify(k.positioning)}`;
    })
    .join("\n");

  try {
    const raw = await callAIStructured<unknown>({
      system: [
        "You are a senior brand strategist. Compare the competing brands below.",
        "Identify (1) saturated color bands every rival crowds into, (2) unoccupied aesthetic territory with concrete exemplar hexes, (3) 3-5 GTM differentiation vectors.",
        "Be specific: name real hue bands (Royal Blue, Slate, Ochre, Forest Green). No hype words. Short sentences.",
        `Deterministic signals: ${JSON.stringify({ saturated: deterministic.saturatedBands.map((b) => b.band), open: deterministic.openTerritory.slice(0, 6).map((t) => t.band), note: deterministic.temperatureNote })}`,
      ].join("\n"),
      user: `Cohort:\n${brief}`,
      toolName: "save_market_niche",
      toolDescription: "Save saturated bands, open territory, and differentiation vectors.",
      parameters: {
        type: "object",
        properties: {
          saturatedBands: {
            type: "array",
            items: {
              type: "object",
              properties: { band: { type: "string" }, detail: { type: "string" } },
              required: ["band", "detail"],
            },
          },
          openTerritory: {
            type: "array",
            items: {
              type: "object",
              properties: {
                band: { type: "string" },
                exemplar: { type: "string" },
                rationale: { type: "string" },
              },
              required: ["band", "exemplar", "rationale"],
            },
          },
          vectors: { type: "array", items: { type: "string" } },
          temperatureNote: { type: "string" },
        },
        required: ["saturatedBands", "openTerritory", "vectors", "temperatureNote"],
      },
    });
    if (!raw || typeof raw !== "object") return fallback;
    const r = raw as Record<string, unknown>;
    const strList = (v: unknown): string[] =>
      Array.isArray(v)
        ? v
            .filter((s): s is string => typeof s === "string")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const bands = Array.isArray(r.saturatedBands) ? r.saturatedBands : [];
    const open = Array.isArray(r.openTerritory) ? r.openTerritory : [];
    const out: MarketNiche = {
      saturatedBands: bands
        .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
        .map((b) => ({
          band: String(b.band ?? "").slice(0, 60),
          detail: String(b.detail ?? "").slice(0, 300),
        }))
        .filter((b) => b.band && b.detail)
        .slice(0, 6),
      openTerritory: open
        .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
        .map((b) => ({
          band: String(b.band ?? "").slice(0, 60),
          exemplar: String(b.exemplar ?? "").slice(0, 12),
          rationale: String(b.rationale ?? "").slice(0, 300),
        }))
        .filter((b) => b.band && b.rationale)
        .slice(0, 6),
      vectors: strList(r.vectors).slice(0, 6),
      temperatureNote:
        typeof r.temperatureNote === "string" && r.temperatureNote.trim()
          ? r.temperatureNote.trim().slice(0, 400)
          : fallback.temperatureNote,
    };
    if (!out.saturatedBands.length && !out.openTerritory.length && !out.vectors.length)
      return fallback;
    if (!out.saturatedBands.length) out.saturatedBands = fallback.saturatedBands;
    if (!out.openTerritory.length) out.openTerritory = fallback.openTerritory;
    if (!out.vectors.length) out.vectors = fallback.vectors;
    return out;
  } catch (e) {
    console.warn("[analyzeMarketNicheServerFn] AI failed, using deterministic report", e);
    return fallback;
  }
}
