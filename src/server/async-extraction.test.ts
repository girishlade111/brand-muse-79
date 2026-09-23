import { describe, expect, it } from "vitest";
import {
  EXTRACTION_STEPS,
  getStepMilestone,
  getNextStep,
  calculateBackoffMs,
  publishStepJob,
} from "./job-queue.server";

describe("Asynchronous Background Job Queue & Precision Japanese Calligraphy Pipeline", () => {
  it("defines the exact 5 decoupled extraction milestones with authentic Kanji seals", () => {
    expect(EXTRACTION_STEPS).toHaveLength(5);

    const steps = EXTRACTION_STEPS.map((s) => s.step);
    expect(steps).toEqual([
      "scrape_homepage",
      "crawl_companion_pages",
      "probe_fonts_and_assets",
      "ai_synthesis",
      "persist_and_finalize",
    ]);

    const kanjiNums = EXTRACTION_STEPS.map((s) => s.kanjiNum);
    expect(kanjiNums).toEqual(["壱", "弐", "参", "四", "五"]);

    const kanjiNames = EXTRACTION_STEPS.map((s) => s.kanjiName);
    expect(kanjiNames).toEqual(["墨引", "巡検", "印章", "調合", "落款"]);

    const romajis = EXTRACTION_STEPS.map((s) => s.romaji);
    expect(romajis).toEqual(["Sumi-hiki", "Junken", "Inshō", "Chōgō", "Rakkan"]);

    // Monotonically increasing progress reaching 100%
    const progressVals = EXTRACTION_STEPS.map((s) => s.progress);
    expect(progressVals).toEqual([20, 40, 65, 85, 100]);
  });

  it("retrieves individual step milestones accurately", () => {
    const step1 = getStepMilestone("scrape_homepage");
    expect(step1.kanjiNum).toBe("壱");
    expect(step1.status).toBe("crawling");

    const step3 = getStepMilestone("probe_fonts_and_assets");
    expect(step3.kanjiNum).toBe("参");
    expect(step3.status).toBe("resolving_fonts");

    const step4 = getStepMilestone("ai_synthesis");
    expect(step4.kanjiNum).toBe("四");
    expect(step4.status).toBe("synthesizing_voice");

    const step5 = getStepMilestone("persist_and_finalize");
    expect(step5.kanjiNum).toBe("五");
    expect(step5.status).toBe("completed");
    expect(step5.progress).toBe(100);
  });

  it("calculates forward step transitions", () => {
    expect(getNextStep("scrape_homepage")).toBe("crawl_companion_pages");
    expect(getNextStep("crawl_companion_pages")).toBe("probe_fonts_and_assets");
    expect(getNextStep("probe_fonts_and_assets")).toBe("ai_synthesis");
    expect(getNextStep("ai_synthesis")).toBe("persist_and_finalize");
    expect(getNextStep("persist_and_finalize")).toBeNull();
  });

  it("computes jittered exponential backoff with max bound", () => {
    // Attempt 1: 1000ms + [0-500ms] jitter
    const b1 = calculateBackoffMs(1);
    expect(b1).toBeGreaterThanOrEqual(1000);
    expect(b1).toBeLessThanOrEqual(1500);

    // Attempt 2: 2000ms + [0-500ms] jitter
    const b2 = calculateBackoffMs(2);
    expect(b2).toBeGreaterThanOrEqual(2000);
    expect(b2).toBeLessThanOrEqual(2500);

    // Attempt 3: 4000ms + [0-500ms] jitter
    const b3 = calculateBackoffMs(3);
    expect(b3).toBeGreaterThanOrEqual(4000);
    expect(b3).toBeLessThanOrEqual(4500);

    // Exponential scaling with upper ceiling at 15000ms (15s serverless boundary)
    const bHuge = calculateBackoffMs(10);
    expect(bHuge).toBeLessThanOrEqual(15000);

    // Verify jitter randomization
    const samples = Array.from({ length: 10 }, () => calculateBackoffMs(1));
    const unique = new Set(samples);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("dispatches background step jobs cleanly with microtask decoupling", async () => {
    const kitId = "00000000-0000-0000-0000-000000000001";
    const job = await publishStepJob({
      kitId,
      step: "scrape_homepage",
      attempt: 1,
      delaySeconds: 0,
    });

    expect(job).toBeDefined();
    expect(job.step).toBe("scrape_homepage");
    expect(job.jobId).toContain("job_");
    expect(job.provider).toBe("microtask");
    expect(job.scheduledAt).toBeGreaterThanOrEqual(Date.now() - 50);
  });
});
