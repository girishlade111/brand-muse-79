// Upstash QStash & Inngest Decoupled Background Job Queue
// Dispatches step-based extraction workflows (<15s per step)
// with jittered exponential backoff retries and state synchronization.

export type ExtractionStepName =
  | "scrape_homepage"
  | "crawl_companion_pages"
  | "probe_fonts_and_assets"
  | "ai_synthesis"
  | "persist_and_finalize";

export type ExtractionStatus =
  | "pending"
  | "crawling"
  | "analyzing_colors"
  | "resolving_fonts"
  | "synthesizing_voice"
  | "completed"
  | "failed";

export interface StepMilestone {
  step: ExtractionStepName;
  kanjiNum: string;
  kanjiName: string;
  romaji: string;
  status: ExtractionStatus;
  progress: number;
  label: string;
  detail: string;
}

export const EXTRACTION_STEPS: StepMilestone[] = [
  {
    step: "scrape_homepage",
    kanjiNum: "壱",
    kanjiName: "墨引",
    romaji: "Sumi-hiki",
    status: "crawling",
    progress: 20,
    label: "Inking Homepage & Site Map",
    detail: "Scraping homepage markup, branding metadata, and discovering navigation tree.",
  },
  {
    step: "crawl_companion_pages",
    kanjiNum: "弐",
    kanjiName: "巡検",
    romaji: "Junken",
    status: "crawling",
    progress: 40,
    label: "Companion Pages Deep Crawl",
    detail: "Crawling high-value companion pages (About, Products, Mission, Story) in parallel.",
  },
  {
    step: "probe_fonts_and_assets",
    kanjiNum: "参",
    kanjiName: "印章",
    romaji: "Inshō",
    status: "resolving_fonts",
    progress: 65,
    label: "Marks & Typography Probing",
    detail: "Harvesting vector SVG marks, probing favicons, and detecting real CSS web fonts.",
  },
  {
    step: "ai_synthesis",
    kanjiNum: "四",
    kanjiName: "調合",
    romaji: "Chōgō",
    status: "synthesizing_voice",
    progress: 85,
    label: "AI Synthesis & Color Alchemy",
    detail: "Gemini Flash synthesizing typography scale, color harmony, tokens, and brand voice.",
  },
  {
    step: "persist_and_finalize",
    kanjiNum: "五",
    kanjiName: "落款",
    romaji: "Rakkan",
    status: "completed",
    progress: 100,
    label: "Final Seal & Studio Ready",
    detail: "Persisting design tokens, color swatches, and assets into library.",
  },
];

/**
 * Calculates jittered exponential backoff in milliseconds.
 * Prevents thundering herds when external services (Firecrawl, Gemini) rate-limit.
 */
export function calculateBackoffMs(attempt: number): number {
  const base = 1000 * Math.pow(2, Math.max(0, attempt - 1));
  const jitter = Math.random() * 500;
  return Math.min(15000, Math.round(base + jitter));
}

export function getStepMilestone(step: ExtractionStepName): StepMilestone {
  const found = EXTRACTION_STEPS.find((s) => s.step === step);
  return found || EXTRACTION_STEPS[0];
}

export function getNextStep(current: ExtractionStepName): ExtractionStepName | null {
  const index = EXTRACTION_STEPS.findIndex((s) => s.step === current);
  if (index !== -1 && index + 1 < EXTRACTION_STEPS.length) {
    return EXTRACTION_STEPS[index + 1].step;
  }
  return null;
}

export interface PublishJobOptions {
  kitId: string;
  step: ExtractionStepName;
  attempt?: number;
  delaySeconds?: number;
}

export interface PublishJobResult {
  jobId: string;
  provider: "qstash" | "inngest" | "microtask";
  step: ExtractionStepName;
  scheduledAt: number;
}

/**
 * Publishes an asynchronous step job to Upstash QStash or local microtask dispatcher.
 */
export async function publishStepJob(options: PublishJobOptions): Promise<PublishJobResult> {
  const { kitId, step, attempt = 1, delaySeconds = 0 } = options;
  const qstashToken = process.env.QSTASH_TOKEN?.trim();
  const qstashUrl = process.env.QSTASH_URL?.trim() || "https://qstash.upstash.io/v2/publish";
  const appBaseUrl =
    process.env.APP_BASE_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "http://localhost:3000";

  const targetEndpoint = `${appBaseUrl.replace(/\/+$/, "")}/api/jobs/extract-step`;
  const scheduledAt = Date.now() + delaySeconds * 1000;

  // 1. Upstash QStash Live Publish
  if (qstashToken && !appBaseUrl.includes("localhost")) {
    try {
      const qstashEndpoint = `${qstashUrl}/${encodeURIComponent(targetEndpoint)}`;
      const res = await fetch(qstashEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${qstashToken}`,
          "Content-Type": "application/json",
          "Upstash-Delay": `${delaySeconds}s`,
          "Upstash-Retries": "3",
        },
        body: JSON.stringify({ kitId, step, attempt }),
      });

      if (res.ok) {
        const body = (await res.json()) as any;
        return {
          jobId: body?.messageId || `qstash_${Date.now()}`,
          provider: "qstash",
          step,
          scheduledAt,
        };
      }
      console.warn("[job-queue] QStash publish non-200, falling back to microtask:", await res.text());
    } catch (err) {
      console.warn("[job-queue] QStash network error, falling back to microtask:", err);
    }
  }

  // 2. Microtask / Decoupled Background Task Dispatcher (Dev, Sandbox, Serverless fallback)
  const jobId = `job_${Buffer.from(`${kitId}:${step}:${attempt}`).toString("hex").slice(0, 16)}`;

  // Decouple execution so the caller returns immediately (<200ms)
  setTimeout(async () => {
    try {
      // Dynamic import to avoid circular dependency
      const { runExtractionStep } = await import("./async-extraction.server");
      await runExtractionStep({ kitId, step, attempt });
    } catch (e) {
      console.error(`[job-queue] Microtask step execution failed for kit ${kitId}, step ${step}:`, e);
    }
  }, Math.max(50, delaySeconds * 1000));

  return {
    jobId,
    provider: "microtask",
    step,
    scheduledAt,
  };
}
