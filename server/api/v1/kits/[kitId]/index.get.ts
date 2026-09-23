// Nitro REST API Route: GET /api/v1/kits/:kitId
// Returns full extracted brand identity (JSON schema with colors, fonts, tokens, voice, assets).
// Authenticates via API Key, Bearer Token, or public/shareToken access.

import { authenticateApiRequest } from "@/server/api-auth.server";
import {
  db,
  brandKits,
  kitColors,
  kitFonts,
  kitTokens,
  kitAssets,
  kitVoice,
} from "@/db/index.server";
import { eq, asc } from "drizzle-orm";

export default async function (event: any) {
  const req = event?.node?.req || event?.req;
  const res = event?.node?.res || event?.res;

  // Set CORS headers
  if (res && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  }

  if (req?.method === "OPTIONS" || event?.method === "OPTIONS") {
    if (res) {
      res.statusCode = 204;
      res.end?.();
    }
    return new Response(null, { status: 204 });
  }

  // Extract kitId from URL path
  const rawUrl = req?.url || event?.url || "/";
  const url = new URL(rawUrl, "http://localhost");
  const pathParts = url.pathname.split("/").filter(Boolean);
  const kitIdx = pathParts.indexOf("kits");
  let kitId = event?.context?.params?.kitId || "";
  if (!kitId && kitIdx !== -1 && pathParts.length > kitIdx + 1) {
    const candidate = pathParts[kitIdx + 1];
    if (candidate !== "css" && candidate !== "tokens") {
      kitId = candidate;
    }
  }
  const tokenParam =
    url.searchParams.get("token") || url.searchParams.get("share_token") || undefined;

  if (!kitId) {
    if (res) res.statusCode = 400;
    return { error: "Missing kitId in route path", status: 400 };
  }

  // Check API Key authentication or allow public/share token fallback
  const auth = await authenticateApiRequest(req || event);
  let isAuthorized = auth.authenticated;

  // Fetch kit container by id (UUID) or fallback to shareToken
  let kitRows = await db.select().from(brandKits).where(eq(brandKits.id, kitId)).limit(1);
  let matchedViaPathShareToken = false;
  if (!kitRows.length) {
    const shareRows = await db
      .select()
      .from(brandKits)
      .where(eq(brandKits.shareToken, kitId))
      .limit(1);
    if (shareRows.length) {
      kitRows = shareRows;
      matchedViaPathShareToken = true;
    }
  }
  const kit = kitRows[0];

  if (!kit) {
    if (res) res.statusCode = 404;
    return { error: "Brand kit not found", status: 404 };
  }

  // If not authed via API key, check if kit is public OR tokenParam matches shareToken OR matched via path
  if (!isAuthorized) {
    const isPublic = Boolean(kit.isPublic);
    const matchesShareToken = Boolean(
      (kit.shareToken && tokenParam && kit.shareToken === tokenParam) || matchedViaPathShareToken,
    );
    if (isPublic || matchesShareToken) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    if (res) {
      res.statusCode = 401;
      res.setHeader("WWW-Authenticate", 'Bearer realm="BrandMuse API"');
    }
    return {
      error: "Unauthorized: Private brand kit. Provide a valid API Key or share token.",
      status: 401,
    };
  }

  // Attach rate limit headers if API key used
  if (auth.authenticated && res && typeof res.setHeader === "function") {
    for (const [k, v] of Object.entries(auth.headers)) {
      res.setHeader(k, v);
    }
  }

  // Query all child entities
  const [colors, fonts, tokens, assets, voiceRows] = await Promise.all([
    db.select().from(kitColors).where(eq(kitColors.kitId, kitId)).orderBy(asc(kitColors.position)),
    db.select().from(kitFonts).where(eq(kitFonts.kitId, kitId)).orderBy(asc(kitFonts.position)),
    db.select().from(kitTokens).where(eq(kitTokens.kitId, kitId)).orderBy(asc(kitTokens.position)),
    db.select().from(kitAssets).where(eq(kitAssets.kitId, kitId)).orderBy(asc(kitAssets.position)),
    db.select().from(kitVoice).where(eq(kitVoice.kitId, kitId)).limit(1),
  ]);

  const voice = voiceRows[0] || null;

  return {
    id: kit.id,
    name: kit.name,
    status: kit.status,
    source_type: kit.sourceType,
    source_url: kit.sourceUrl,
    is_public: kit.isPublic,
    brand_positioning: kit.brandPositioning,
    typography_scale: kit.typographyScale,
    imagery_style: kit.imageryStyle,
    motion_style: kit.motionStyle,
    colors: colors.map((c) => ({
      id: c.id,
      hex: c.hex,
      name: c.name,
      role: c.role,
      locked: c.locked,
      position: c.position,
    })),
    fonts: fonts.map((f) => ({
      id: f.id,
      family: f.family,
      source_family: f.sourceFamily,
      role: f.role,
      weights: f.weights,
      google_font: f.googleFont,
      is_substitute: f.isSubstitute,
      license: f.license,
      provider: f.provider,
      position: f.position,
    })),
    tokens: tokens.map((t) => ({
      id: t.id,
      category: t.category,
      name: t.name,
      value: t.value,
      position: t.position,
    })),
    assets: assets.map((a) => ({
      id: a.id,
      kind: a.kind,
      url: a.url,
      width: a.width,
      height: a.height,
      position: a.position,
    })),
    voice: voice
      ? {
          summary: voice.summary,
          tone: voice.tone,
          vocabulary: voice.vocabulary,
          dos: voice.dos,
          donts: voice.donts,
          samples: voice.samples,
        }
      : null,
    created_at: kit.createdAt.toISOString(),
    updated_at: kit.updatedAt.toISOString(),
  };
}
