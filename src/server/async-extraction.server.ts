// Asynchronous Step-based Extraction Worker Pipeline
// Each step executes within an isolated <15s serverless execution budget.
// State and intermediate artifacts are stored in `brand_kits.step_details`.

import { eq } from "drizzle-orm";
import {
  db,
  brandKits,
  kitAssets,
  kitColors,
  kitFonts,
  kitTokens,
  kitVoice,
} from "@/db/index.server";
import {
  EXTRACTION_STEPS,
  getStepMilestone,
  calculateBackoffMs,
  publishStepJob,
  type ExtractionStepName,
  type ExtractionStatus,
} from "./job-queue.server";
import {
  runExtraction,
  uploadScreenshot,
  pickExtraPages,
  inventoryPage,
  rehostAsset,
  harvestLogosFromHtml,
  dedupAssetsByKey,
  fallbackExtraction,
  type Extraction,
  type ExtractKitInput,
} from "./extraction.server";
import { firecrawlScrape, firecrawlMap } from "./ai.server";
import { detectFontsFromSite, substituteFor, type DetectedFont } from "./fonts.server";
import { extractColorsFromText, type ColorObservation } from "./css-colors.server";
import { probeLogos } from "./logo-probe.server";
import { publicUrlFor } from "./storage.server";

// Helper for strict step-level execution timeouts
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), timeoutMs)),
  ]);
}

export interface IntermediateExtractionData {
  candidatePages?: string[];
  homepageMarkdown?: string;
  homepageHtml?: string;
  homepageBranding?: any;
  pageScreenshots?: string[];
  companionPages?: Array<{ url: string; markdown?: string; html?: string }>;
  inventories?: Array<{ url: string; data: any }>;
  detectedFonts?: DetectedFont[];
  cssColors?: ColorObservation[];
  assets?: Array<{ kind: string; url: string }>;
  extraction?: Extraction;
  degradedReason?: string | null;
}

export interface KitStepDetails {
  step: ExtractionStepName;
  status: ExtractionStatus;
  progress: number;
  attempt: number;
  updatedAt: string;
  input: {
    kitId: string;
    url?: string;
    manual?: { brandName?: string; hexColors?: string[]; fontFamilies?: string[] };
    imageUrls?: string[];
    pdfTexts?: string[];
  };
  intermediateData: IntermediateExtractionData;
  logs: string[];
  error?: string | null;
  retryAfterMs?: number | null;
}

/**
 * Initializes and kicks off the async extraction pipeline.
 */
export async function startAsyncExtraction(input: ExtractKitInput) {
  const kitRows = await db
    .select({ id: brandKits.id })
    .from(brandKits)
    .where(eq(brandKits.id, input.kitId))
    .limit(1);

  if (!kitRows.length) {
    throw new Error(`Brand kit ${input.kitId} not found`);
  }

  const initialMilestone = getStepMilestone("scrape_homepage");
  const stepDetails: KitStepDetails = {
    step: "scrape_homepage",
    status: "crawling",
    progress: 10,
    attempt: 1,
    updatedAt: new Date().toISOString(),
    input: {
      kitId: input.kitId,
      url: input.url,
      manual: input.manual,
      imageUrls: input.imageUrls,
      pdfTexts: input.pdfTexts,
    },
    intermediateData: {},
    logs: [
      `[${new Date().toISOString()}] Asynchronous extraction workflow initiated. Dispatching Step 1.`,
    ],
  };

  await db
    .update(brandKits)
    .set({
      status: "processing",
      extractionStep: "scrape_homepage",
      extractionStatus: "crawling",
      extractionProgress: 10,
      stepDetails,
      errorMessage: null,
      errorCode: null,
      errorStatus: null,
    })
    .where(eq(brandKits.id, input.kitId));

  // Publish step 1 job
  const job = await publishStepJob({
    kitId: input.kitId,
    step: "scrape_homepage",
    attempt: 1,
  });

  await db
    .update(brandKits)
    .set({
      jobId: job.jobId,
      jobProvider: job.provider,
    })
    .where(eq(brandKits.id, input.kitId));

  return {
    ok: true,
    kitId: input.kitId,
    jobId: job.jobId,
    step: "scrape_homepage",
    status: "crawling",
    progress: 10,
    milestone: initialMilestone,
  };
}

/**
 * Step 1: Scrapes Homepage and Maps Domain (~3–5s)
 */
async function executeStep1_ScrapeHomepage(
  kitId: string,
  input: KitStepDetails["input"],
  intermediate: IntermediateExtractionData,
  appendLog: (msg: string) => void,
): Promise<IntermediateExtractionData> {
  appendLog("Starting Step 1: Scrape Homepage & Discover Sitemap");
  if (!input.url) {
    appendLog("No URL provided; skipping crawl steps and proceeding to synthesis.");
    return intermediate;
  }

  const url = input.url;
  const assets: Array<{ kind: string; url: string }> = [...(intermediate.assets ?? [])];
  let pageScreenshots: string[] = [...(intermediate.pageScreenshots ?? [])];
  let homepageMarkdown: string | undefined;
  let homepageHtml: string | undefined;
  let homepageBranding: any;
  let candidatePages: string[] = [];

  // 1a. Fast discovery of companion pages via Firecrawl Map with 4s budget
  try {
    const mapped = await withTimeout(firecrawlMap(url, 40), 4000, [url]);
    candidatePages = pickExtraPages(url, mapped, 2);
    appendLog(`Discovered ${candidatePages.length} high-signal companion pages.`);
  } catch (err) {
    appendLog(`Domain map timed out or failed: ${String(err)}. Continuing with homepage.`);
  }

  // 1b. Scrape homepage with 7s budget
  try {
    const scraped = await withTimeout(
      firecrawlScrape(url, 1),
      7000,
      null,
    );

    if (scraped && scraped.length > 0) {
      const homeDoc = scraped[0];
      homepageMarkdown = homeDoc.markdown;
      homepageHtml = homeDoc.rawHtml ?? homeDoc.html;
      homepageBranding = homeDoc.branding;

      if (homeDoc.screenshot) {
        try {
          const shotUrl = await uploadScreenshot(kitId, homeDoc.screenshot);
          if (shotUrl) pageScreenshots.push(shotUrl);
        } catch {
          // ignore screenshot upload error
        }
      }

      // Collect logos from Firecrawl branding
      if (homepageBranding?.images) {
        for (const k of ["logo", "favicon", "ogImage"] as const) {
          if (homepageBranding.images[k]) {
            assets.push({
              kind: k === "ogImage" ? "og-image" : k,
              url: homepageBranding.images[k],
            });
          }
        }
      }
    }
  } catch (err) {
    appendLog(`Homepage Firecrawl scrape error: ${String(err)}`);
  }

  // 1c. Direct fallback if Firecrawl yielded no HTML
  if (!homepageHtml) {
    try {
      appendLog("Attempting direct HTTP fetch fallback for homepage...");
      const res = await withTimeout(
        fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; BrandMuse/1.0)" } }),
        4000,
        null,
      );
      if (res && res.ok) {
        homepageHtml = await res.text();
        appendLog(`Direct fetch succeeded (${homepageHtml.length} bytes).`);
      }
    } catch {
      appendLog("Direct fetch failed.");
    }
  }

  return {
    ...intermediate,
    candidatePages,
    homepageMarkdown,
    homepageHtml,
    homepageBranding,
    pageScreenshots,
    assets,
  };
}

/**
 * Step 2: Deep Crawl Companion Pages (~4–6s)
 */
async function executeStep2_CrawlCompanionPages(
  kitId: string,
  input: KitStepDetails["input"],
  intermediate: IntermediateExtractionData,
  appendLog: (msg: string) => void,
): Promise<IntermediateExtractionData> {
  appendLog("Starting Step 2: Crawl Companion Pages (About, Mission, Products)");
  const candidates = intermediate.candidatePages ?? [];
  const companionPages: Array<{ url: string; markdown?: string; html?: string }> = [];
  const inventories: Array<{ url: string; data: any }> = [];
  const assets: Array<{ kind: string; url: string }> = [...(intermediate.assets ?? [])];

  if (candidates.length === 0) {
    appendLog("No companion pages to crawl. Proceeding to asset probing.");
    return intermediate;
  }

  // Fetch companion pages concurrently within 6s total budget
  const scrapePromises = candidates.map(async (pageUrl) => {
    try {
      appendLog(`Crawling companion page: ${pageUrl}`);
      const scraped = await withTimeout(firecrawlScrape(pageUrl, 1), 5000, null);
      if (scraped && scraped.length > 0) {
        const doc = scraped[0];
        const html = doc.rawHtml ?? doc.html;
        return { url: pageUrl, markdown: doc.markdown, html };
      }
    } catch (e) {
      appendLog(`Failed to scrape companion page ${pageUrl}: ${String(e)}`);
    }
    return null;
  });

  const results = await Promise.all(scrapePromises);
  for (const res of results) {
    if (res) companionPages.push(res);
  }

  appendLog(`Successfully extracted ${companionPages.length} companion pages.`);

  return {
    ...intermediate,
    companionPages,
    inventories,
    assets,
  };
}

/**
 * Step 3: Probe Real Fonts and Vector Assets (~3–5s)
 */
async function executeStep3_ProbeFontsAndAssets(
  kitId: string,
  input: KitStepDetails["input"],
  intermediate: IntermediateExtractionData,
  appendLog: (msg: string) => void,
): Promise<IntermediateExtractionData> {
  appendLog("Starting Step 3: Probing Typography & Vector Assets");
  const url = input.url;
  const assets: Array<{ kind: string; url: string }> = [...(intermediate.assets ?? [])];
  let detectedFonts: DetectedFont[] = [];
  let cssColors: ColorObservation[] = [];

  // All pages to inspect
  const allDocs: Array<{ url: string; html?: string; markdown?: string }> = [];
  if (url) {
    allDocs.push({
      url,
      html: intermediate.homepageHtml,
      markdown: intermediate.homepageMarkdown,
    });
  }
  for (const cp of intermediate.companionPages ?? []) {
    allDocs.push(cp);
  }

  // 3a. Harvest logos from HTML across all pages
  for (const doc of allDocs) {
    if (!doc.html) continue;
    try {
      const harvested = harvestLogosFromHtml(doc.html, doc.url);
      for (const h of harvested) assets.push(h);
    } catch (e) {
      // ignore
    }
  }

  // 3b. Probe standard logo endpoints (favicon, apple-touch-icon, og:image)
  if (url) {
    try {
      const probed = await withTimeout(
        probeLogos({ baseUrl: url, rawHtml: intermediate.homepageHtml }),
        3500,
        [],
      );
      for (const a of probed) assets.push(a);
      appendLog(`Probed ${probed.length} standard logo targets.`);
    } catch (e) {
      appendLog(`Logo probing error: ${String(e)}`);
    }
  }

  // 3c. Detect web fonts from CSS across all pages
  try {
    const fontPromises = allDocs.map((doc) =>
      doc.html
        ? withTimeout(
            detectFontsFromSite({ url: doc.url, rawHtml: doc.html }),
            3500,
            [] as DetectedFont[],
          )
        : Promise.resolve([] as DetectedFont[]),
    );
    const fontResults = await Promise.all(fontPromises);
    const seenFont = new Map<string, DetectedFont>();
    for (const list of fontResults) {
      for (const f of list) {
        const k = f.source_family.toLowerCase();
        if (!seenFont.has(k)) seenFont.set(k, f);
      }
    }
    detectedFonts = [...seenFont.values()].slice(0, 8);
    appendLog(`Detected ${detectedFonts.length} web fonts from CSS stylesheets.`);
  } catch (e) {
    appendLog(`Font detection error: ${String(e)}`);
  }

  // 3d. Extract CSS Colors from HTML / stylesheets
  try {
    const corpus = allDocs
      .map((d) => d.html ?? "")
      .filter(Boolean)
      .join("\n")
      .slice(0, 300000);
    if (corpus) {
      cssColors = extractColorsFromText(corpus, 24);
      appendLog(`Extracted ${cssColors.length} color observations from CSS.`);
    }
  } catch (e) {
    appendLog(`Color extraction error: ${String(e)}`);
  }

  return {
    ...intermediate,
    detectedFonts,
    cssColors,
    assets: dedupAssetsByKey(assets),
  };
}

/**
 * Step 4: AI Synthesis (Gemini Flash structured extraction) (~4–8s)
 */
async function executeStep4_AiSynthesis(
  kitId: string,
  input: KitStepDetails["input"],
  intermediate: IntermediateExtractionData,
  appendLog: (msg: string) => void,
): Promise<IntermediateExtractionData> {
  appendLog("Starting Step 4: AI Synthesis with Gemini Flash");
  let extraction: Extraction | null = null;
  let degradedReason: string | null = null;

  // Aggregate markdown from homepage and companions
  const combinedMarkdown = [
    intermediate.homepageMarkdown,
    ...(intermediate.companionPages ?? []).map((c) => c.markdown),
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  try {
    extraction = await withTimeout(
      runExtraction({
        url: input.url,
        markdown: combinedMarkdown || undefined,
        branding: intermediate.homepageBranding,
        imageUrls: input.imageUrls,
        pdfTexts: input.pdfTexts,
        manual: input.manual,
        detectedFonts: intermediate.detectedFonts,
        cssColors: intermediate.cssColors,
        inventories: intermediate.inventories,
        pageScreenshots: intermediate.pageScreenshots,
      }),
      10000,
      null,
    );
  } catch (err: any) {
    appendLog(`AI structured synthesis failed: ${String(err)}`);
  }

  if (!extraction) {
    appendLog("Using graceful fallback synthesis for kit.");
    degradedReason = "AI extraction timed out or rate limited; applied deterministic fallback.";
    extraction = fallbackExtraction({
      url: input.url,
      manual: input.manual,
      cssColors: intermediate.cssColors,
      detectedFonts: intermediate.detectedFonts,
    });
  }

  appendLog(`Synthesized brand kit for: "${extraction.name}"`);

  return {
    ...intermediate,
    extraction,
    degradedReason,
  };
}

/**
 * Step 5: Persist to Database & Finalize (~1–2s)
 */
async function executeStep5_PersistAndFinalize(
  kitId: string,
  input: KitStepDetails["input"],
  intermediate: IntermediateExtractionData,
  appendLog: (msg: string) => void,
): Promise<void> {
  appendLog("Starting Step 5: Final Seal & Storage Persistence");
  const extraction = intermediate.extraction;
  if (!extraction) {
    throw new Error("No extraction data to persist in Step 5");
  }

  const detectedFonts = intermediate.detectedFonts ?? [];
  const detectedByName = new Map<string, DetectedFont>();
  for (const d of detectedFonts) detectedByName.set(d.source_family.toLowerCase(), d);

  const usedDetected = new Set<string>();
  const enrichedAiFonts = extraction.fonts.map((f) => {
    const lc = f.family.toLowerCase();
    const direct = detectedByName.get(lc);
    if (direct) {
      usedDetected.add(lc);
      const sub = substituteFor(direct.source_family);
      return {
        family: sub ?? f.family,
        role: f.role,
        weights: f.weights ?? direct.weights ?? [],
        google_font: sub ? true : direct.provider === "google" || (f.google_font ?? false),
        source_family: direct.source_family,
        provider: direct.provider,
        provider_url: direct.provider_url,
        license: direct.license,
        license_note: direct.license_note,
        file_urls: direct.file_urls,
        is_substitute: !!sub,
      };
    }
    return {
      family: f.family,
      role: f.role,
      weights: f.weights ?? [],
      google_font: f.google_font ?? false,
      source_family: null,
      provider: null,
      provider_url: null,
      license: null,
      license_note: null,
      file_urls: [],
      is_substitute: false,
    };
  });

  const extraDetected = detectedFonts
    .filter((d) => !usedDetected.has(d.source_family.toLowerCase()))
    .slice(0, 4)
    .map((d) => {
      const sub = substituteFor(d.source_family);
      const lc = d.source_family.toLowerCase();
      const role = /mono|code/.test(lc)
        ? "mono"
        : enrichedAiFonts.some((f) => f.role === "heading")
          ? "body"
          : "heading";
      return {
        family: sub ?? d.source_family,
        role,
        weights: d.weights,
        google_font: sub ? true : d.provider === "google",
        source_family: d.source_family,
        provider: d.provider,
        provider_url: d.provider_url,
        license: d.license,
        license_note: d.license_note,
        file_urls: d.file_urls,
        is_substitute: !!sub,
      };
    });

  const mergedFonts = [...enrichedAiFonts, ...extraDetected];

  // Merge AI assets and harvested assets
  const absolutize = (u: string): string | null => {
    if (!u) return null;
    if (u.startsWith("data:")) return null;
    try {
      return new URL(u, input.url ?? undefined).toString();
    } catch {
      return null;
    }
  };

  const rawAssets = [...(intermediate.assets ?? []), ...extraction.assets]
    .map((a) => ({ kind: a.kind, url: absolutize(a.url) }))
    .filter((a): a is { kind: string; url: string } => !!a.url);
  const dedupedAssets = dedupAssetsByKey(rawAssets);

  // Clean rehost into R2 with timeout
  const rehostPromises = dedupedAssets.slice(0, 10).map(async (a) => {
    try {
      const storage_path = await withTimeout(rehostAsset(kitId, a.kind, a.url), 2000, null);
      return { ...a, storage_path };
    } catch {
      return { ...a, storage_path: null };
    }
  });

  const rehosted = await Promise.all(rehostPromises);
  const reachable = rehosted.filter((a) => !!a.storage_path);

  const sourceText = [
    intermediate.homepageMarkdown,
    ...(intermediate.companionPages ?? []).map((c) => c.markdown),
    ...(input.pdfTexts ?? []),
  ]
    .filter(Boolean)
    .join("\n\n---\n\n")
    .slice(0, 200000) || null;

  // Clear existing kit data
  await Promise.all([
    db.delete(kitColors).where(eq(kitColors.kitId, kitId)),
    db.delete(kitFonts).where(eq(kitFonts.kitId, kitId)),
    db.delete(kitTokens).where(eq(kitTokens.kitId, kitId)),
    db.delete(kitAssets).where(eq(kitAssets.kitId, kitId)),
    db.delete(kitVoice).where(eq(kitVoice.kitId, kitId)),
  ]);

  // Insert children
  if (extraction.colors.length) {
    await db.insert(kitColors).values(
      extraction.colors.map((c, i) => ({
        kitId,
        hex: c.hex.startsWith("#") ? c.hex : `#${c.hex}`,
        role: c.role,
        name: c.name,
        position: i,
      })),
    );
  }

  if (mergedFonts.length) {
    await db.insert(kitFonts).values(
      mergedFonts.map((f, i) => ({
        kitId,
        family: f.family,
        role: f.role,
        weights: f.weights ?? [],
        googleFont: f.google_font ?? false,
        sourceFamily: f.source_family,
        provider: f.provider,
        providerUrl: f.provider_url,
        license: f.license,
        licenseNote: f.license_note,
        fileUrls: f.file_urls ?? [],
        isSubstitute: f.is_substitute ?? false,
        position: i,
      })),
    );
  }

  if (extraction.tokens.length) {
    await db.insert(kitTokens).values(
      extraction.tokens.map((t, i) => ({
        kitId,
        category: t.category,
        name: t.name,
        value: t.value,
        position: i,
      })),
    );
  }

  if (reachable.length) {
    await db.insert(kitAssets).values(
      reachable.map((a, i) => ({
        kitId,
        kind: a.kind,
        url: a.storage_path ? publicUrlFor(a.storage_path as string) : a.url,
        storagePath: a.storage_path,
        position: i,
      })),
    );
  }

  await db.insert(kitVoice).values({
    kitId,
    tone: extraction.voice.tone ?? [],
    vocabulary: extraction.voice.vocabulary ?? [],
    dos: extraction.voice.dos ?? [],
    donts: extraction.voice.donts ?? [],
    samples: extraction.voice.samples ?? {},
    summary: extraction.summary ?? null,
  });

  appendLog("Final seal established. Kit ready for studio editing.");
}

/**
 * Executes a single step of the extraction pipeline.
 * Called by Upstash QStash webhook or decoupled microtask dispatcher.
 */
export async function runExtractionStep(params: {
  kitId: string;
  step: ExtractionStepName;
  attempt: number;
}): Promise<{ ok: boolean; nextStep?: ExtractionStepName | null; error?: string }> {
  const { kitId, step, attempt } = params;

  const kitRows = await db
    .select()
    .from(brandKits)
    .where(eq(brandKits.id, kitId))
    .limit(1);

  if (!kitRows.length) {
    console.error(`[runExtractionStep] Kit ${kitId} not found`);
    return { ok: false, error: "Kit not found" };
  }

  const kit = kitRows[0];
  const stepDetails = (kit.stepDetails as KitStepDetails) || {
    step,
    status: "crawling",
    progress: 10,
    attempt: 1,
    updatedAt: new Date().toISOString(),
    input: { kitId },
    intermediateData: {},
    logs: [],
  };

  const logs = [...(stepDetails.logs ?? [])];
  const appendLog = (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  const currentMilestone = getStepMilestone(step);

  try {
    let nextIntermediate = { ...(stepDetails.intermediateData ?? {}) };

    if (step === "scrape_homepage") {
      nextIntermediate = await executeStep1_ScrapeHomepage(
        kitId,
        stepDetails.input,
        nextIntermediate,
        appendLog,
      );
      // Advance to step 2
      const nextStep: ExtractionStepName = "crawl_companion_pages";
      const nextMilestone = getStepMilestone(nextStep);

      const nextDetails: KitStepDetails = {
        ...stepDetails,
        step: nextStep,
        status: nextMilestone.status,
        progress: nextMilestone.progress,
        attempt: 1,
        updatedAt: new Date().toISOString(),
        intermediateData: nextIntermediate,
        logs,
      };

      await db
        .update(brandKits)
        .set({
          extractionStep: nextStep,
          extractionStatus: nextMilestone.status,
          extractionProgress: nextMilestone.progress,
          stepDetails: nextDetails,
        })
        .where(eq(brandKits.id, kitId));

      await publishStepJob({ kitId, step: nextStep, attempt: 1 });
      return { ok: true, nextStep };
    }

    if (step === "crawl_companion_pages") {
      nextIntermediate = await executeStep2_CrawlCompanionPages(
        kitId,
        stepDetails.input,
        nextIntermediate,
        appendLog,
      );
      // Advance to step 3
      const nextStep: ExtractionStepName = "probe_fonts_and_assets";
      const nextMilestone = getStepMilestone(nextStep);

      const nextDetails: KitStepDetails = {
        ...stepDetails,
        step: nextStep,
        status: nextMilestone.status,
        progress: nextMilestone.progress,
        attempt: 1,
        updatedAt: new Date().toISOString(),
        intermediateData: nextIntermediate,
        logs,
      };

      await db
        .update(brandKits)
        .set({
          extractionStep: nextStep,
          extractionStatus: nextMilestone.status,
          extractionProgress: nextMilestone.progress,
          stepDetails: nextDetails,
        })
        .where(eq(brandKits.id, kitId));

      await publishStepJob({ kitId, step: nextStep, attempt: 1 });
      return { ok: true, nextStep };
    }

    if (step === "probe_fonts_and_assets") {
      nextIntermediate = await executeStep3_ProbeFontsAndAssets(
        kitId,
        stepDetails.input,
        nextIntermediate,
        appendLog,
      );
      // Advance to step 4
      const nextStep: ExtractionStepName = "ai_synthesis";
      const nextMilestone = getStepMilestone(nextStep);

      const nextDetails: KitStepDetails = {
        ...stepDetails,
        step: nextStep,
        status: nextMilestone.status,
        progress: nextMilestone.progress,
        attempt: 1,
        updatedAt: new Date().toISOString(),
        intermediateData: nextIntermediate,
        logs,
      };

      await db
        .update(brandKits)
        .set({
          extractionStep: nextStep,
          extractionStatus: nextMilestone.status,
          extractionProgress: nextMilestone.progress,
          stepDetails: nextDetails,
        })
        .where(eq(brandKits.id, kitId));

      await publishStepJob({ kitId, step: nextStep, attempt: 1 });
      return { ok: true, nextStep };
    }

    if (step === "ai_synthesis") {
      nextIntermediate = await executeStep4_AiSynthesis(
        kitId,
        stepDetails.input,
        nextIntermediate,
        appendLog,
      );
      // Advance to step 5
      const nextStep: ExtractionStepName = "persist_and_finalize";
      const nextMilestone = getStepMilestone(nextStep);

      const nextDetails: KitStepDetails = {
        ...stepDetails,
        step: nextStep,
        status: nextMilestone.status,
        progress: nextMilestone.progress,
        attempt: 1,
        updatedAt: new Date().toISOString(),
        intermediateData: nextIntermediate,
        logs,
      };

      await db
        .update(brandKits)
        .set({
          extractionStep: nextStep,
          extractionStatus: nextMilestone.status,
          extractionProgress: nextMilestone.progress,
          stepDetails: nextDetails,
        })
        .where(eq(brandKits.id, kitId));

      await publishStepJob({ kitId, step: nextStep, attempt: 1 });
      return { ok: true, nextStep };
    }

    if (step === "persist_and_finalize") {
      await executeStep5_PersistAndFinalize(
        kitId,
        stepDetails.input,
        nextIntermediate,
        appendLog,
      );

      const finalMilestone = getStepMilestone("persist_and_finalize");
      const extraction = nextIntermediate.extraction;

      const nextDetails: KitStepDetails = {
        ...stepDetails,
        step: "persist_and_finalize",
        status: "completed",
        progress: 100,
        attempt: 1,
        updatedAt: new Date().toISOString(),
        intermediateData: nextIntermediate,
        logs,
      };

      await db
        .update(brandKits)
        .set({
          status: "ready",
          name: extraction?.name ?? kit.name,
          extractionStep: "persist_and_finalize",
          extractionStatus: "completed",
          extractionProgress: 100,
          stepDetails: nextDetails,
          sourceUrl: stepDetails.input.url ?? kit.sourceUrl,
          typographyScale: extraction?.typography_scale ?? [],
          imageryStyle: extraction?.imagery_style ?? null,
          motionStyle: extraction?.motion_style ?? null,
          brandPositioning: extraction?.brand_positioning ?? null,
          errorCode: nextIntermediate.degradedReason ? "scrape_blocked" : null,
          errorMessage: nextIntermediate.degradedReason ?? null,
        })
        .where(eq(brandKits.id, kitId));

      return { ok: true, nextStep: null };
    }

    return { ok: true, nextStep: null };
  } catch (error: any) {
    const errorMsg = String(error?.message ?? error);
    appendLog(`Error in step ${step} (Attempt ${attempt}): ${errorMsg}`);
    console.error(`[runExtractionStep] Step ${step} error for kit ${kitId}:`, error);

    // Jittered exponential backoff retry if attempt < 3
    if (attempt < 3) {
      const backoffMs = calculateBackoffMs(attempt);
      const delaySeconds = Math.max(1, Math.ceil(backoffMs / 1000));
      appendLog(`Retrying step ${step} in ${delaySeconds}s (attempt ${attempt + 1}/3)...`);

      const nextDetails: KitStepDetails = {
        ...stepDetails,
        attempt: attempt + 1,
        updatedAt: new Date().toISOString(),
        logs,
        error: errorMsg,
        retryAfterMs: backoffMs,
      };

      await db
        .update(brandKits)
        .set({
          stepDetails: nextDetails,
        })
        .where(eq(brandKits.id, kitId));

      await publishStepJob({
        kitId,
        step,
        attempt: attempt + 1,
        delaySeconds,
      });

      return { ok: false, error: `Step failed. Scheduled retry in ${delaySeconds}s` };
    }

    // Attempt limit reached; degrade gracefully or mark failed
    appendLog(`Step ${step} failed after 3 attempts.`);

    // If step 4 failed, try fallback synthesis directly to step 5
    if (step === "ai_synthesis") {
      appendLog("Initiating graceful degraded synthesis fallback...");
      const fallback = fallbackExtraction({
        url: stepDetails.input.url,
        manual: stepDetails.input.manual,
        cssColors: stepDetails.intermediateData?.cssColors,
        detectedFonts: stepDetails.intermediateData?.detectedFonts,
      });

      const nextDetails: KitStepDetails = {
        ...stepDetails,
        step: "persist_and_finalize",
        status: "completed",
        progress: 95,
        attempt: 1,
        updatedAt: new Date().toISOString(),
        intermediateData: {
          ...stepDetails.intermediateData,
          extraction: fallback,
          degradedReason: "Synthesis fallback applied after retries.",
        },
        logs,
      };

      await db
        .update(brandKits)
        .set({
          extractionStep: "persist_and_finalize",
          stepDetails: nextDetails,
        })
        .where(eq(brandKits.id, kitId));

      await publishStepJob({ kitId, step: "persist_and_finalize", attempt: 1 });
      return { ok: true, nextStep: "persist_and_finalize" };
    }

    // Irrecoverable failure
    const failedDetails: KitStepDetails = {
      ...stepDetails,
      status: "failed",
      updatedAt: new Date().toISOString(),
      logs,
      error: errorMsg,
    };

    await db
      .update(brandKits)
      .set({
        status: "error",
        extractionStatus: "failed",
        errorMessage: errorMsg,
        stepDetails: failedDetails,
      })
      .where(eq(brandKits.id, kitId));

    return { ok: false, error: errorMsg };
  }
}
