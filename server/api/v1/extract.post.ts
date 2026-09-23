// Nitro REST API Route: POST /api/v1/extract
// Accepts { "url": "https://..." } or { "document_url": "..." }, authenticates via API Key,
// triggers ingestion asynchronously, and returns { "kit_id": "...", "status": "processing" }.

import { authenticateApiRequest } from "@/server/api-auth.server";
import { db, brandKits } from "@/db/index.server";
import { extractKitImpl } from "@/server/extraction.server";
import { dispatchWebhookEvent } from "@/server/webhooks.server";

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

function setHeadersAndStatus(event: any, status: number, headers: Record<string, string>) {
  const res = event?.node?.res || event?.res;
  if (res && typeof res.setHeader === "function") {
    res.statusCode = status;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
    for (const [k, v] of Object.entries(headers)) {
      res.setHeader(k, v);
    }
  }
}

export default async function (event: any) {
  const req = event?.node?.req || event?.req;
  const res = event?.node?.res || event?.res;

  // Handle CORS preflight
  if (req?.method === "OPTIONS" || event?.method === "OPTIONS") {
    if (res) {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
      res.end?.();
    }
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      },
    });
  }

  // 1. Authenticate Request & Apply Rate Limit
  const auth = await authenticateApiRequest(req || event);
  if (!auth.authenticated) {
    setHeadersAndStatus(event, auth.status, auth.headers);
    return {
      error: auth.error,
      status: auth.status,
    };
  }

  // 2. Parse Body
  const body = await readBodyHelper(event);
  const targetUrl = (body.url || body.source_url || "").trim();
  const documentUrl = (body.document_url || body.doc_url || "").trim();

  if (!targetUrl && !documentUrl) {
    setHeadersAndStatus(event, 400, auth.headers);
    return {
      error:
        "Missing required parameter: provide 'url' (e.g. 'https://stripe.com') or 'document_url'.",
      status: 400,
    };
  }

  const primaryUrl = targetUrl || documentUrl;
  let parsedHost = "Brand Kit";
  try {
    parsedHost = new URL(primaryUrl).hostname.replace(/^www\./, "");
  } catch {}

  try {
    // 3. Create Brand Kit Container
    const [kit] = await db
      .insert(brandKits)
      .values({
        name: parsedHost,
        sourceType: targetUrl ? "url" : "upload",
        sourceUrl: primaryUrl,
        status: "processing",
        userId: auth.userId,
      })
      .returning();

    if (!kit) {
      throw new Error("Database failed to initialize brand kit row.");
    }

    // 4. Trigger Ingestion (Async Execution with Webhook notification)
    extractKitImpl({
      kitId: kit.id,
      ownerToken: auth.userId,
      url: targetUrl || undefined,
      imageUrls: documentUrl ? [documentUrl] : undefined,
    })
      .then(async (result) => {
        if (result.ok) {
          await dispatchWebhookEvent(
            "kit.extraction_completed",
            {
              kit_id: kit.id,
              kit_name: parsedHost,
              source_url: primaryUrl,
              status: "ready",
            },
            { userId: auth.userId },
          );
        } else {
          await dispatchWebhookEvent(
            "kit.failed",
            {
              kit_id: kit.id,
              kit_name: parsedHost,
              source_url: primaryUrl,
              error: result.error || "Extraction failed to extract brand tokens.",
              status: "error",
            },
            { userId: auth.userId },
          );
        }
      })
      .catch(async (extractErr: any) => {
        await dispatchWebhookEvent(
          "kit.failed",
          {
            kit_id: kit.id,
            kit_name: parsedHost,
            source_url: primaryUrl,
            error: extractErr?.message || "Internal extraction error",
            status: "error",
          },
          { userId: auth.userId },
        );
      });

    // 5. Return HTTP 202 Accepted
    setHeadersAndStatus(event, 202, auth.headers);
    return {
      kit_id: kit.id,
      status: "processing",
      source_url: primaryUrl,
      message:
        "Extraction initiated. Subscribe to webhooks or query GET /api/v1/kits/:id for status.",
      created_at: kit.createdAt ? kit.createdAt.toISOString() : new Date().toISOString(),
    };
  } catch (err: any) {
    setHeadersAndStatus(event, 500, auth.headers);
    return {
      error: `Failed to initiate extraction: ${err?.message || "Internal server error"}`,
      status: 500,
    };
  }
}
