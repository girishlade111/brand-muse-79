// Shared Extraction Milestones and Step Types
// Safe for both client components and server workers.

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
    label: "Persisting Brand Identity",
    detail: "Sealing colors, typography scales, tokens, and assets into PostgreSQL storage.",
  },
];

export function getStepMilestone(step: ExtractionStepName): StepMilestone {
  return EXTRACTION_STEPS.find((s) => s.step === step) || EXTRACTION_STEPS[0];
}
