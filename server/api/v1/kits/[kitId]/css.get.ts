// Nitro REST API Route: GET /api/v1/kits/:kitId/css
// Returns raw compiled `tokens.css` with `Content-Type: text/css`
// for direct CDN / stylesheet embedding in customer websites.

import { db, brandKits, kitColors, kitFonts, kitTokens } from "@/db/index.server";
import { buildCSS } from "@/lib/exports";
import { eq, asc } from "drizzle-orm";

export default async function (event: any) {
  const req = event?.node?.req || event?.req;
  const res = event?.node?.res || event?.res;

  // Set standard CDN & CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Content-Type": "text/css; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  };

  if (res && typeof res.setHeader === "function") {
    for (const [k, v] of Object.entries(corsHeaders)) {
      res.setHeader(k, v);
    }
  }

  if (req?.method === "OPTIONS" || event?.method === "OPTIONS") {
    if (res) {
      res.statusCode = 204;
      res.end?.();
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Extract kitId from URL path
  const rawUrl = req?.url || event?.url || "/";
  const url = new URL(rawUrl, "http://localhost");
  const pathParts = url.pathname.split("/").filter(Boolean);
  const kitIdx = pathParts.indexOf("kits");
  let kitId = "";
  if (kitIdx !== -1 && pathParts.length > kitIdx + 1) {
    const candidate = pathParts[kitIdx + 1];
    if (candidate !== "css" && candidate !== "tokens") {
      kitId = candidate;
    }
  }

  if (!kitId) {
    if (res) res.statusCode = 400;
    return `/* Error: Missing kitId parameter in route */`;
  }

  const kitRows = await db.select().from(brandKits).where(eq(brandKits.id, kitId)).limit(1);
  const kit = kitRows[0];

  if (!kit) {
    if (res) res.statusCode = 404;
    return `/* Error: Brand kit ${kitId} not found */`;
  }

  // Query tokens, colors, fonts
  const [colors, fonts, tokens] = await Promise.all([
    db.select().from(kitColors).where(eq(kitColors.kitId, kitId)).orderBy(asc(kitColors.position)),
    db.select().from(kitFonts).where(eq(kitFonts.kitId, kitId)).orderBy(asc(kitFonts.position)),
    db.select().from(kitTokens).where(eq(kitTokens.kitId, kitId)).orderBy(asc(kitTokens.position)),
  ]);

  const css = buildCSS({
    colors: (Array.isArray(colors) ? colors : []) as any,
    fonts: (Array.isArray(fonts) ? fonts : []) as any,
    tokens: (Array.isArray(tokens) ? tokens : []) as any,
  });

  const headerComment = `/**
 * Brand Muse Design Tokens — ${kit.name}
 * Generated: ${kit.updatedAt ? kit.updatedAt.toISOString() : new Date().toISOString()}
 * Live CDN Stylesheet: embed directly in <link rel="stylesheet" href="...">
 */\n\n`;

  const fullCss = `${headerComment}${css}\n`;

  if (res && typeof res.end === "function") {
    res.end(fullCss);
    return;
  }

  return new Response(fullCss, {
    status: 200,
    headers: corsHeaders,
  });
}
