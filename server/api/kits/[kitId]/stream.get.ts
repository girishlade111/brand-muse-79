// Nitro Route: GET /api/kits/:kitId/stream
// Real-time Server-Sent Events (SSE) streaming extraction progress,
// step transitions, retry countdowns, and terminal status events.
// Fully compatible with Cloudflare Workers (ReadableStream) and Node.js runtimes.

import { db, brandKits } from "@/db/index.server";
import { eq } from "drizzle-orm";
import { getStepMilestone, type ExtractionStepName } from "@/server/job-queue.server";

export default async function (event: any) {
  const req = event?.node?.req || event?.req;
  const res = event?.node?.res || event?.res;

  // Extract kitId
  const rawUrl = req?.url || event?.url || "/";
  const url = new URL(rawUrl, "http://localhost");
  const pathParts = url.pathname.split("/").filter(Boolean);
  const kitsIdx = pathParts.indexOf("kits");
  let kitId = event?.context?.params?.kitId || "";
  if (!kitId && kitsIdx !== -1 && pathParts.length > kitsIdx + 1) {
    kitId = pathParts[kitsIdx + 1];
  }

  if (!kitId) {
    return new Response(JSON.stringify({ error: "Missing kitId parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Common SSE Headers
  const sseHeaders: Record<string, string> = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*",
  };

  // 1. Node.js Streaming Mode
  if (res && typeof res.writeHead === "function" && typeof res.write === "function") {
    res.writeHead(200, sseHeaders);
    res.flushHeaders?.();

    let isClosed = false;
    req.on?.("close", () => {
      isClosed = true;
    });

    const sendEvent = (eventType: string, data: any) => {
      if (isClosed) return;
      res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
      res.flush?.();
    };

    const sendKeepAlive = () => {
      if (isClosed) return;
      res.write(`: keepalive\n\n`);
      res.flush?.();
    };

    // Polling state loop
    let lastStep = "";
    let lastProgress = -1;
    let lastStatus = "";

    const interval = setInterval(async () => {
      if (isClosed) {
        clearInterval(interval);
        return;
      }

      sendKeepAlive();

      try {
        const rows = await db
          .select({
            id: brandKits.id,
            status: brandKits.status,
            name: brandKits.name,
            extractionStep: brandKits.extractionStep,
            extractionProgress: brandKits.extractionProgress,
            extractionStatus: brandKits.extractionStatus,
            stepDetails: brandKits.stepDetails,
            errorMessage: brandKits.errorMessage,
          })
          .from(brandKits)
          .where(eq(brandKits.id, kitId))
          .limit(1);

        if (!rows.length) {
          sendEvent("error", { error: "Brand kit not found" });
          clearInterval(interval);
          res.end();
          return;
        }

        const kit = rows[0];
        const step = (kit.extractionStep as ExtractionStepName) || "scrape_homepage";
        const progress = kit.extractionProgress ?? 10;
        const status = kit.extractionStatus ?? (kit.status === "ready" ? "completed" : "crawling");
        const milestone = getStepMilestone(step);
        const details = (kit.stepDetails as any) || {};

        if (step !== lastStep || progress !== lastProgress || status !== lastStatus) {
          lastStep = step;
          lastProgress = progress;
          lastStatus = status;

          sendEvent("progress", {
            kitId,
            status,
            step,
            progress,
            milestone,
            attempt: details.attempt ?? 1,
            logs: (details.logs ?? []).slice(-10),
            error: kit.errorMessage || details.error || null,
            name: kit.name,
            isReady: kit.status === "ready",
            isFailed: kit.status === "error",
          });
        }

        // Terminal state reached
        if (kit.status === "ready" || status === "completed") {
          sendEvent("completed", {
            kitId,
            status: "completed",
            progress: 100,
            step: "persist_and_finalize",
            milestone: getStepMilestone("persist_and_finalize"),
            name: kit.name,
          });
          clearInterval(interval);
          res.end();
        } else if (kit.status === "error" || status === "failed") {
          sendEvent("failed", {
            kitId,
            status: "failed",
            error: kit.errorMessage || "Extraction failed",
          });
          clearInterval(interval);
          res.end();
        }
      } catch (err) {
        console.error("[SSE Stream Node error]", err);
      }
    }, 750);

    return;
  }

  // 2. Cloudflare Workers / Web ReadableStream Mode
  const textEncoder = new TextEncoder();
  let isCancelled = false;
  let interval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      let lastStep = "";
      let lastProgress = -1;
      let lastStatus = "";

      const enqueueEvent = (eventType: string, data: any) => {
        if (isCancelled) return;
        controller.enqueue(
          textEncoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const enqueueKeepAlive = () => {
        if (isCancelled) return;
        controller.enqueue(textEncoder.encode(`: keepalive\n\n`));
      };

      interval = setInterval(async () => {
        if (isCancelled) {
          if (interval) clearInterval(interval);
          return;
        }

        enqueueKeepAlive();

        try {
          const rows = await db
            .select({
              id: brandKits.id,
              status: brandKits.status,
              name: brandKits.name,
              extractionStep: brandKits.extractionStep,
              extractionProgress: brandKits.extractionProgress,
              extractionStatus: brandKits.extractionStatus,
              stepDetails: brandKits.stepDetails,
              errorMessage: brandKits.errorMessage,
            })
            .from(brandKits)
            .where(eq(brandKits.id, kitId))
            .limit(1);

          if (!rows.length) {
            enqueueEvent("error", { error: "Brand kit not found" });
            if (interval) clearInterval(interval);
            controller.close();
            return;
          }

          const kit = rows[0];
          const step = (kit.extractionStep as ExtractionStepName) || "scrape_homepage";
          const progress = kit.extractionProgress ?? 10;
          const status =
            kit.extractionStatus ?? (kit.status === "ready" ? "completed" : "crawling");
          const milestone = getStepMilestone(step);
          const details = (kit.stepDetails as any) || {};

          if (step !== lastStep || progress !== lastProgress || status !== lastStatus) {
            lastStep = step;
            lastProgress = progress;
            lastStatus = status;

            enqueueEvent("progress", {
              kitId,
              status,
              step,
              progress,
              milestone,
              attempt: details.attempt ?? 1,
              logs: (details.logs ?? []).slice(-10),
              error: kit.errorMessage || details.error || null,
              name: kit.name,
              isReady: kit.status === "ready",
              isFailed: kit.status === "error",
            });
          }

          if (kit.status === "ready" || status === "completed") {
            enqueueEvent("completed", {
              kitId,
              status: "completed",
              progress: 100,
              step: "persist_and_finalize",
              milestone: getStepMilestone("persist_and_finalize"),
              name: kit.name,
            });
            if (interval) clearInterval(interval);
            controller.close();
          } else if (kit.status === "error" || status === "failed") {
            enqueueEvent("failed", {
              kitId,
              status: "failed",
              error: kit.errorMessage || "Extraction failed",
            });
            if (interval) clearInterval(interval);
            controller.close();
          }
        } catch (e) {
          console.error("[SSE Stream Web error]", e);
        }
      }, 750);
    },
    cancel() {
      isCancelled = true;
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: sseHeaders,
  });
}
