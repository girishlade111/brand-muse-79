// Nitro API Route: POST /api/jobs/extract-step
// Dispatches an isolated extraction step (<15s) triggered by Upstash QStash or local microtask.

import { runExtractionStep } from "@/server/async-extraction.server";
import type { ExtractionStepName } from "@/server/job-queue.server";

async function readBodyHelper(event: any): Promise<any> {
  if (typeof event?.readBody === "function") {
    try {
      const b = await event.readBody();
      if (b) return b;
    } catch {}
  }
  const req = event?.node?.req || event?.req;
  if (req?.body) {
    if (typeof req.body === "object") return req.body;
    try {
      return JSON.parse(req.body);
    } catch {}
  }
  const webReq = event?.request || (req instanceof Request ? req : null);
  if (webReq && typeof webReq.json === "function") {
    try {
      return await webReq.json();
    } catch {}
  }
  if (req && typeof req.on === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    if (text) {
      try {
        return JSON.parse(text);
      } catch {}
    }
  }
  return {};
}

export default async function (event: any) {
  const req = event?.node?.req || event?.req;
  const res = event?.node?.res || event?.res;

  // CORS
  if (res && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Upstash-Signature");
  }

  if (req?.method === "OPTIONS" || event?.method === "OPTIONS") {
    if (res) {
      res.statusCode = 204;
      res.end?.();
    }
    return new Response(null, { status: 204 });
  }

  try {
    const body = await readBodyHelper(event);
    const { kitId, step, attempt = 1 } = body || {};

    if (!kitId || !step) {
      if (res) {
        res.statusCode = 400;
        res.end?.(JSON.stringify({ error: "Missing required fields: kitId and step" }));
      }
      return new Response(
        JSON.stringify({ error: "Missing required fields: kitId and step" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Execute the step isolated within its serverless time budget
    const result = await runExtractionStep({
      kitId,
      step: step as ExtractionStepName,
      attempt: Number(attempt) || 1,
    });

    const responsePayload = {
      ok: result.ok,
      kitId,
      step,
      nextStep: result.nextStep,
      error: result.error,
      timestamp: new Date().toISOString(),
    };

    if (res) {
      res.statusCode = result.ok ? 200 : 500;
      res.setHeader?.("Content-Type", "application/json");
      res.end?.(JSON.stringify(responsePayload));
    }

    return new Response(JSON.stringify(responsePayload), {
      status: result.ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[extract-step.post] Unhandled step error:", err);
    const payload = {
      ok: false,
      error: String(err?.message ?? err),
      timestamp: new Date().toISOString(),
    };
    if (res) {
      res.statusCode = 500;
      res.setHeader?.("Content-Type", "application/json");
      res.end?.(JSON.stringify(payload));
    }
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
