// Nitro REST API Route: GET /api/v1/portal/:slug
// Returns the public Brand Guidelines Portal payload.
// Heavily cached at Cloudflare Workers edge (Cache API) for high traffic & low latency.

import {
  db,
  brandKits,
  kitColors,
  kitFonts,
  kitTokens,
  kitAssets,
  kitVoice,
  publishedPortals,
} from "@/db/index.server";
import { eq, or, and, asc, sql } from "drizzle-orm";
import {
  buildPortalCacheKey,
  getEdgeCachedJson,
  setEdgeCachedJson,
} from "@/server/edge-cache.server";
import { verifyPasswordToken } from "@/server/portal-auth.server";

export default async function (event: any) {
  const req = event?.node?.req || event?.req;
  const res = event?.node?.res || event?.res;

  // Set CORS headers
  if (res && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Portal-Token");
  }

  if (req?.method === "OPTIONS" || event?.method === "OPTIONS") {
    if (res) {
      res.statusCode = 204;
      res.end?.();
    }
    return new Response(null, { status: 204 });
  }

  // Extract slug from route params or URL path
  const rawUrl = req?.url || event?.url || "/";
  const url = new URL(rawUrl, "http://localhost");
  const pathParts = url.pathname.split("/").filter(Boolean);
  const portalIdx = pathParts.indexOf("portal");
  let slug = event?.context?.params?.slug || "";
  if (!slug && portalIdx !== -1 && pathParts.length > portalIdx + 1) {
    slug = pathParts[portalIdx + 1];
  }

  // Also check Host header for custom domain routing
  const host = (req?.headers?.host || event?.headers?.host || "").split(":")[0].toLowerCase();
  const identifier = slug || host;

  if (!identifier) {
    if (res) res.statusCode = 400;
    return { error: "Missing portal identifier or slug in request", status: 400 };
  }

  // Extract potential password token
  const authHeader = req?.headers?.authorization || event?.headers?.authorization || "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const portalToken =
    req?.headers?.["x-portal-token"] ||
    event?.headers?.["x-portal-token"] ||
    bearerToken ||
    url.searchParams.get("token") ||
    url.searchParams.get("password_token") ||
    "";

  const cacheKey = buildPortalCacheKey(identifier);

  // 1. Check Cloudflare Edge Cache
  const cached = await getEdgeCachedJson(cacheKey);
  if (cached) {
    if (res && typeof res.setHeader === "function") {
      res.setHeader("CF-Cache-Status", "HIT");
      res.setHeader("X-Edge-Cache", "HIT");
      res.setHeader(
        "Cache-Control",
        "public, max-age=120, s-maxage=3600, stale-while-revalidate=86400",
      );
    }
    return cached;
  }

  // 2. Fetch from Neon Postgres
  const rows = await db
    .select({
      portal: publishedPortals,
      kit: brandKits,
    })
    .from(publishedPortals)
    .innerJoin(brandKits, eq(publishedPortals.kitId, brandKits.id))
    .where(
      and(
        eq(publishedPortals.isPublished, true),
        or(
          eq(publishedPortals.slug, identifier.toLowerCase()),
          eq(publishedPortals.customDomain, identifier.toLowerCase()),
        ),
      ),
    )
    .limit(1);

  if (!rows.length) {
    if (res) res.statusCode = 404;
    return { error: `Brand Guidelines portal not found for "${identifier}"`, status: 404 };
  }

  const { portal, kit } = rows[0];

  // Check expiration
  if (portal.expiresAt && new Date(portal.expiresAt).getTime() < Date.now()) {
    if (res) res.statusCode = 410;
    return {
      error: "Brand Guidelines access has expired",
      status: 410,
      isExpired: true,
      portal: { slug: portal.slug, name: kit.name, expiresAt: portal.expiresAt.toISOString() },
    };
  }

  // Check Password Protection
  if (portal.isPasswordProtected) {
    const hasAccess = portalToken && verifyPasswordToken(portalToken, portal.slug);
    if (!hasAccess) {
      if (res && typeof res.setHeader === "function") {
        res.statusCode = 401;
        res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
      }
      return {
        isLocked: true,
        isExpired: false,
        isPasswordProtected: true,
        portal: {
          slug: portal.slug,
          name: kit.name,
          hint: portal.passwordHint || null,
          whitelabelTitle: portal.whitelabelTitle || `${kit.name} — Brand Guidelines`,
          whitelabelFaviconUrl: portal.whitelabelFaviconUrl || null,
          whitelabelRemoveBadge: portal.whitelabelRemoveBadge || false,
        },
      };
    }
  }

  // Query child entities
  const [colors, fonts, tokens, assets, voiceRows] = await Promise.all([
    db.select().from(kitColors).where(eq(kitColors.kitId, kit.id)).orderBy(asc(kitColors.position)),
    db.select().from(kitFonts).where(eq(kitFonts.kitId, kit.id)).orderBy(asc(kitFonts.position)),
    db.select().from(kitTokens).where(eq(kitTokens.kitId, kit.id)).orderBy(asc(kitTokens.position)),
    db.select().from(kitAssets).where(eq(kitAssets.kitId, kit.id)).orderBy(asc(kitAssets.position)),
    db.select().from(kitVoice).where(eq(kitVoice.kitId, kit.id)).limit(1),
  ]);

  // Increment view count asynchronously
  db.update(publishedPortals)
    .set({ viewCount: sql`${publishedPortals.viewCount} + 1` })
    .where(eq(publishedPortals.id, portal.id))
    .catch(() => {});

  const payload = {
    isLocked: false,
    isExpired: false,
    isPasswordProtected: portal.isPasswordProtected,
    portal: {
      id: portal.id,
      slug: portal.slug,
      customDomain: portal.customDomain,
      whitelabelTitle: portal.whitelabelTitle || `${kit.name} — Brand Guidelines`,
      whitelabelMetaDescription:
        portal.whitelabelMetaDescription ||
        `Official brand guidelines, logos, typography, color palettes, and assets for ${kit.name}.`,
      whitelabelFaviconUrl: portal.whitelabelFaviconUrl,
      whitelabelSocialImageUrl: portal.whitelabelSocialImageUrl,
      whitelabelRemoveBadge: portal.whitelabelRemoveBadge,
      customCss: portal.customCss,
      allowedDownloadFormats: portal.allowedDownloadFormats || ["svg", "png", "tokens", "css"],
      updatedAt: portal.updatedAt.toISOString(),
    },
    kit: {
      id: kit.id,
      name: kit.name,
      sourceUrl: kit.sourceUrl,
      brandPositioning: kit.brandPositioning,
      typographyScale: kit.typographyScale,
      imageryStyle: kit.imageryStyle,
      motionStyle: kit.motionStyle,
    },
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
      sourceFamily: f.sourceFamily,
      role: f.role,
      weights: f.weights,
      googleFont: f.googleFont,
      provider: f.provider,
      providerUrl: f.providerUrl,
      license: f.license,
      licenseNote: f.licenseNote,
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
    voice: voiceRows[0] || null,
  };

  // Cache in Cloudflare Edge Cache ONLY for public portals
  if (!portal.isPasswordProtected) {
    await setEdgeCachedJson(cacheKey, payload, 3600);
  }

  if (res && typeof res.setHeader === "function") {
    res.setHeader("CF-Cache-Status", "MISS");
    res.setHeader("X-Edge-Cache", "MISS");
    res.setHeader(
      "Cache-Control",
      portal.isPasswordProtected
        ? "private, no-store, no-cache, must-revalidate"
        : "public, max-age=120, s-maxage=3600, stale-while-revalidate=86400",
    );
  }

  return payload;
}
