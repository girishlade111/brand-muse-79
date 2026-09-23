import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, asc, eq, or, sql } from "drizzle-orm";
import crypto from "node:crypto";
import {
  db,
  brandKits,
  kitAssets,
  kitColors,
  kitFonts,
  kitTokens,
  kitVoice,
  publishedPortals,
} from "@/db/index.server";
import {
  createCustomHostname,
  deleteCustomHostname,
  getCustomHostnameStatus,
  normalizeCustomDomain,
} from "@/server/cloudflare-saas.server";
import {
  buildPortalCacheKey,
  getEdgeCachedJson,
  purgePortalEdgeCache,
  setEdgeCachedJson,
} from "@/server/edge-cache.server";
import {
  hashPassword,
  createPasswordToken,
  verifyPasswordToken,
  safeTimingSafeEqual,
} from "@/server/portal-auth.server";

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "build",
  "cdn",
  "compare",
  "custom",
  "dashboard",
  "design",
  "docs",
  "figma",
  "help",
  "index",
  "kit",
  "library",
  "login",
  "logout",
  "p",
  "portal",
  "pricing",
  "settings",
  "share",
  "start-here",
  "status",
  "studio",
  "test",
  "webhook",
  "www",
]);

/**
 * Public function to fetch Brand Guidelines Portal data.
 * Checks edge cache first. If missing, validates expiration & password,
 * assembles guidelines payload, and caches at edge.
 */
export const getPortalData = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string().optional(),
      host: z.string().optional(),
      passwordToken: z.string().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const identifier = (data.slug || data.host || "").toLowerCase().trim();
    if (!identifier) throw new Error("Portal identifier (slug or host) required");

    const cacheKey = buildPortalCacheKey(identifier);

    // 1. Check Cloudflare Edge Cache
    const cached = await getEdgeCachedJson(cacheKey);
    if (cached) {
      // If cached portal is password protected, verify the user's password token
      if (cached.isPasswordProtected && !cached.isLocked) {
        const hasAccess = data.passwordToken && verifyPasswordToken(data.passwordToken, cached.portal.slug);
        if (!hasAccess) {
          return {
            isLocked: true,
            portal: {
              slug: cached.portal.slug,
              name: cached.kit.name,
              hint: cached.portal.passwordHint,
              whitelabelTitle: cached.portal.whitelabelTitle,
              whitelabelFaviconUrl: cached.portal.whitelabelFaviconUrl,
              whitelabelRemoveBadge: cached.portal.whitelabelRemoveBadge,
            },
          };
        }
      }
      return cached;
    }

    // 2. Fetch from Neon PostgreSQL
    const portals = await db
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
            eq(publishedPortals.slug, identifier),
            eq(publishedPortals.customDomain, identifier),
          ),
        ),
      )
      .limit(1);

    if (!portals.length) {
      throw new Error(`Brand Guidelines portal not found for "${identifier}".`);
    }

    const { portal, kit } = portals[0];

    // 3. Check Expiration
    if (portal.expiresAt && new Date(portal.expiresAt).getTime() < Date.now()) {
      return {
        isExpired: true,
        portal: {
          slug: portal.slug,
          name: kit.name,
          expiresAt: portal.expiresAt.toISOString(),
          whitelabelTitle: portal.whitelabelTitle,
          whitelabelRemoveBadge: portal.whitelabelRemoveBadge,
        },
      };
    }

    // 4. Check Password Protection
    if (portal.isPasswordProtected) {
      const hasAccess = data.passwordToken && verifyPasswordToken(data.passwordToken, portal.slug);
      if (!hasAccess) {
        return {
          isLocked: true,
          portal: {
            slug: portal.slug,
            name: kit.name,
            hint: portal.passwordHint,
            whitelabelTitle: portal.whitelabelTitle,
            whitelabelFaviconUrl: portal.whitelabelFaviconUrl,
            whitelabelRemoveBadge: portal.whitelabelRemoveBadge,
          },
        };
      }
    }

    // 5. Query all Brand Kit components
    const [colors, fonts, tokens, assets, voiceRows] = await Promise.all([
      db
        .select()
        .from(kitColors)
        .where(eq(kitColors.kitId, kit.id))
        .orderBy(asc(kitColors.position)),
      db
        .select()
        .from(kitFonts)
        .where(eq(kitFonts.kitId, kit.id))
        .orderBy(asc(kitFonts.position)),
      db
        .select()
        .from(kitTokens)
        .where(eq(kitTokens.kitId, kit.id))
        .orderBy(asc(kitTokens.position)),
      db
        .select()
        .from(kitAssets)
        .where(eq(kitAssets.kitId, kit.id))
        .orderBy(asc(kitAssets.position)),
      db.select().from(kitVoice).where(eq(kitVoice.kitId, kit.id)).limit(1),
    ]);

    // Asynchronously update view count
    db.update(publishedPortals)
      .set({ viewCount: sql`${publishedPortals.viewCount} + 1` })
      .where(eq(publishedPortals.id, portal.id))
      .catch((e) => console.warn("Failed to increment portal view count", e));

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

    // Cache at edge for 1 hour (3600s)
    await setEdgeCachedJson(cacheKey, payload, 3600);

    return payload;
  });

/**
 * Verify portal password and return a signed session token.
 */
export const verifyPortalPassword = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string().min(1),
      password: z.string().min(1),
    }).parse,
  )
  .handler(async ({ data }) => {
    const rows = await db
      .select({
        id: publishedPortals.id,
        slug: publishedPortals.slug,
        passwordHash: publishedPortals.passwordHash,
        isPasswordProtected: publishedPortals.isPasswordProtected,
      })
      .from(publishedPortals)
      .where(eq(publishedPortals.slug, data.slug.toLowerCase().trim()))
      .limit(1);

    if (!rows.length || !rows[0].isPasswordProtected || !rows[0].passwordHash) {
      throw new Error("Portal does not require a password.");
    }

    const expectedHash = rows[0].passwordHash;
    const providedHash = hashPassword(data.password);

    const isMatch = safeTimingSafeEqual(expectedHash, providedHash);

    if (!isMatch) {
      throw new Error("Incorrect password. Please try again.");
    }

    const token = createPasswordToken(rows[0].slug);
    return { success: true, token };
  });

/**
 * Get portal settings for the kit owner.
 */
export const getPortalSettings = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kitId: z.string().uuid(),
      ownerToken: z.string().min(1),
    }).parse,
  )
  .handler(async ({ data }) => {
    // Validate kit ownership
    const kits = await db
      .select({
        id: brandKits.id,
        name: brandKits.name,
        userId: brandKits.userId,
        anonToken: brandKits.anonToken,
      })
      .from(brandKits)
      .where(eq(brandKits.id, data.kitId))
      .limit(1);

    if (!kits.length) throw new Error("Brand kit not found");
    const k = kits[0];
    const isOwner =
      (k.userId && k.userId === data.ownerToken) ||
      (k.anonToken && k.anonToken === data.ownerToken);
    if (!isOwner) throw new Error("Unauthorized: Only the kit owner can manage the portal");

    // Fetch existing portal settings or return defaults
    const portals = await db
      .select()
      .from(publishedPortals)
      .where(eq(publishedPortals.kitId, data.kitId))
      .limit(1);

    if (portals.length) {
      const p = portals[0];
      return {
        id: p.id,
        kitId: p.kitId,
        slug: p.slug,
        customDomain: p.customDomain,
        customDomainStatus: p.customDomainStatus,
        customDomainSslStatus: p.customDomainSslStatus,
        customDomainCnameTarget: p.customDomainCnameTarget,
        cfVerificationData: p.cfVerificationData,
        isPublished: p.isPublished,
        isPasswordProtected: p.isPasswordProtected,
        hasPassword: Boolean(p.passwordHash),
        passwordHint: p.passwordHint,
        expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
        whitelabelRemoveBadge: p.whitelabelRemoveBadge,
        whitelabelTitle: p.whitelabelTitle,
        whitelabelMetaDescription: p.whitelabelMetaDescription,
        whitelabelFaviconUrl: p.whitelabelFaviconUrl,
        whitelabelSocialImageUrl: p.whitelabelSocialImageUrl,
        viewCount: p.viewCount,
        updatedAt: p.updatedAt.toISOString(),
      };
    }

    // Default suggested slug based on kit name
    const baseSlug = k.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || "brand-guide";

    return {
      id: null,
      kitId: data.kitId,
      slug: baseSlug,
      customDomain: null,
      customDomainStatus: "unconfigured",
      customDomainSslStatus: "pending",
      customDomainCnameTarget: "cname.branddna.app",
      cfVerificationData: null,
      isPublished: false,
      isPasswordProtected: false,
      hasPassword: false,
      passwordHint: null,
      expiresAt: null,
      whitelabelRemoveBadge: false,
      whitelabelTitle: `${k.name} Brand Guidelines`,
      whitelabelMetaDescription: `Official brand guide and design assets for ${k.name}.`,
      whitelabelFaviconUrl: null,
      whitelabelSocialImageUrl: null,
      viewCount: 0,
      updatedAt: null,
    };
  });

/**
 * Check if a portal slug is available.
 */
export const checkSlugAvailability = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string().min(3).max(50),
      currentKitId: z.string().uuid().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const slug = data.slug.toLowerCase().trim();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return { available: false, reason: "Slug can only contain lowercase letters, numbers, and hyphens." };
    }
    if (slug.startsWith("-") || slug.endsWith("-")) {
      return { available: false, reason: "Slug cannot start or end with a hyphen." };
    }
    if (RESERVED_SLUGS.has(slug)) {
      return { available: false, reason: "This slug is reserved for system use." };
    }

    const existing = await db
      .select({ id: publishedPortals.id, kitId: publishedPortals.kitId })
      .from(publishedPortals)
      .where(eq(publishedPortals.slug, slug))
      .limit(1);

    if (existing.length && (!data.currentKitId || existing[0].kitId !== data.currentKitId)) {
      return { available: false, reason: "This slug is already taken. Please choose another." };
    }

    return { available: true };
  });

/**
 * Save / Update portal settings for a brand kit.
 */
export const updatePortalSettings = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kitId: z.string().uuid(),
      ownerToken: z.string().min(1),
      slug: z.string().min(3).max(50),
      isPublished: z.boolean(),
      isPasswordProtected: z.boolean(),
      password: z.string().optional(),
      clearPassword: z.boolean().optional(),
      passwordHint: z.string().max(200).optional().nullable(),
      expiresAt: z.string().datetime().optional().nullable(),
      whitelabelRemoveBadge: z.boolean(),
      whitelabelTitle: z.string().max(100).optional().nullable(),
      whitelabelMetaDescription: z.string().max(300).optional().nullable(),
      whitelabelFaviconUrl: z.string().url().optional().nullable().or(z.literal("")),
      whitelabelSocialImageUrl: z.string().url().optional().nullable().or(z.literal("")),
    }).parse,
  )
  .handler(async ({ data }) => {
    // 1. Verify ownership
    const kits = await db
      .select({ id: brandKits.id, userId: brandKits.userId, anonToken: brandKits.anonToken })
      .from(brandKits)
      .where(eq(brandKits.id, data.kitId))
      .limit(1);

    if (!kits.length) throw new Error("Brand kit not found");
    const k = kits[0];
    const isOwner =
      (k.userId && k.userId === data.ownerToken) ||
      (k.anonToken && k.anonToken === data.ownerToken);
    if (!isOwner) throw new Error("Unauthorized: Only kit owner can update portal");

    const slug = data.slug.toLowerCase().trim();
    if (!/^[a-z0-9-]+$/.test(slug) || RESERVED_SLUGS.has(slug)) {
      throw new Error(`Slug "${slug}" is invalid or reserved.`);
    }

    // Check slug collision
    const existingSlug = await db
      .select({ kitId: publishedPortals.kitId })
      .from(publishedPortals)
      .where(eq(publishedPortals.slug, slug))
      .limit(1);

    if (existingSlug.length && existingSlug[0].kitId !== data.kitId) {
      throw new Error(`Slug "${slug}" is already in use by another kit.`);
    }

    // Check existing portal
    const existing = await db
      .select()
      .from(publishedPortals)
      .where(eq(publishedPortals.kitId, data.kitId))
      .limit(1);

    let passwordHash = existing[0]?.passwordHash || null;
    if (data.clearPassword) {
      passwordHash = null;
    } else if (data.password && data.password.trim()) {
      passwordHash = hashPassword(data.password.trim());
    }

    const payload: any = {
      slug,
      isPublished: data.isPublished,
      isPasswordProtected: data.isPasswordProtected && Boolean(passwordHash),
      passwordHash,
      passwordHint: data.passwordHint || null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      whitelabelRemoveBadge: data.whitelabelRemoveBadge,
      whitelabelTitle: data.whitelabelTitle || null,
      whitelabelMetaDescription: data.whitelabelMetaDescription || null,
      whitelabelFaviconUrl: data.whitelabelFaviconUrl || null,
      whitelabelSocialImageUrl: data.whitelabelSocialImageUrl || null,
      updatedAt: new Date(),
    };

    let result: any;
    if (existing.length) {
      const updated = await db
        .update(publishedPortals)
        .set(payload)
        .where(eq(publishedPortals.id, existing[0].id))
        .returning();
      result = updated[0];
      // Invalidate existing cache
      await purgePortalEdgeCache(existing[0].slug);
      if (existing[0].customDomain) await purgePortalEdgeCache(existing[0].customDomain);
    } else {
      const inserted = await db
        .insert(publishedPortals)
        .values({
          kitId: data.kitId,
          ...payload,
        })
        .returning();
      result = inserted[0];
    }

    // Invalidate new slug cache
    await purgePortalEdgeCache(slug);

    return {
      success: true,
      portal: {
        id: result.id,
        slug: result.slug,
        customDomain: result.customDomain,
        isPublished: result.isPublished,
        isPasswordProtected: result.isPasswordProtected,
        hasPassword: Boolean(result.passwordHash),
        expiresAt: result.expiresAt ? result.expiresAt.toISOString() : null,
        whitelabelRemoveBadge: result.whitelabelRemoveBadge,
      },
    };
  });

/**
 * Configure and provision custom domain with Cloudflare SSL for SaaS.
 */
export const provisionCustomDomain = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kitId: z.string().uuid(),
      ownerToken: z.string().min(1),
      domain: z.string().min(4).max(100),
    }).parse,
  )
  .handler(async ({ data }) => {
    // 1. Verify kit ownership
    const kits = await db
      .select({ id: brandKits.id, userId: brandKits.userId, anonToken: brandKits.anonToken })
      .from(brandKits)
      .where(eq(brandKits.id, data.kitId))
      .limit(1);

    if (!kits.length) throw new Error("Brand kit not found");
    const k = kits[0];
    const isOwner =
      (k.userId && k.userId === data.ownerToken) ||
      (k.anonToken && k.anonToken === data.ownerToken);
    if (!isOwner) throw new Error("Unauthorized: Only kit owner can configure custom domain");

    const normalizedDomain = normalizeCustomDomain(data.domain);

    // Check if domain is already attached elsewhere
    const existing = await db
      .select({ kitId: publishedPortals.kitId })
      .from(publishedPortals)
      .where(eq(publishedPortals.customDomain, normalizedDomain))
      .limit(1);

    if (existing.length && existing[0].kitId !== data.kitId) {
      throw new Error(`Domain "${normalizedDomain}" is already connected to another brand kit.`);
    }

    // Provision via Cloudflare Custom Hostnames (SSL for SaaS)
    const cfResult = await createCustomHostname(normalizedDomain);

    // Upsert into publishedPortals
    const current = await db
      .select()
      .from(publishedPortals)
      .where(eq(publishedPortals.kitId, data.kitId))
      .limit(1);

    let updatedPortal: any;
    if (current.length) {
      const rows = await db
        .update(publishedPortals)
        .set({
          customDomain: normalizedDomain,
          customDomainStatus: cfResult.status,
          customDomainSslStatus: cfResult.sslStatus,
          customDomainCnameTarget: cfResult.cnameTarget,
          cfCustomHostnameId: cfResult.id,
          cfVerificationData: {
            ownershipVerification: cfResult.ownershipVerification,
            sslValidationRecords: cfResult.sslValidationRecords,
            verificationErrors: cfResult.verificationErrors,
          },
          updatedAt: new Date(),
        })
        .where(eq(publishedPortals.id, current[0].id))
        .returning();
      updatedPortal = rows[0];
    } else {
      const defaultSlug = normalizedDomain.split(".")[0] || "brand";
      const rows = await db
        .insert(publishedPortals)
        .values({
          kitId: data.kitId,
          slug: defaultSlug,
          customDomain: normalizedDomain,
          customDomainStatus: cfResult.status,
          customDomainSslStatus: cfResult.sslStatus,
          customDomainCnameTarget: cfResult.cnameTarget,
          cfCustomHostnameId: cfResult.id,
          cfVerificationData: {
            ownershipVerification: cfResult.ownershipVerification,
            sslValidationRecords: cfResult.sslValidationRecords,
            verificationErrors: cfResult.verificationErrors,
          },
        })
        .returning();
      updatedPortal = rows[0];
    }

    // Invalidate edge cache for this domain
    await purgePortalEdgeCache(normalizedDomain);

    return {
      success: true,
      customDomain: normalizedDomain,
      status: cfResult.status,
      sslStatus: cfResult.sslStatus,
      cnameTarget: cfResult.cnameTarget,
      ownershipVerification: cfResult.ownershipVerification,
      sslValidationRecords: cfResult.sslValidationRecords,
      simulationMode: cfResult.simulationMode,
    };
  });

/**
 * Verify live DNS & SSL status from Cloudflare for an existing custom domain.
 */
export const verifyCustomDomainDns = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kitId: z.string().uuid(),
      ownerToken: z.string().min(1),
    }).parse,
  )
  .handler(async ({ data }) => {
    const portals = await db
      .select()
      .from(publishedPortals)
      .where(eq(publishedPortals.kitId, data.kitId))
      .limit(1);

    const p = portals[0];
    const customDomain = p.customDomain;
    if (!customDomain) {
      throw new Error("No custom domain configured for this kit.");
    }

    const hostnameId = p.cfCustomHostnameId || customDomain;
    const cfStatus = await getCustomHostnameStatus(hostnameId, customDomain);

    // Update DB with latest status
    await db
      .update(publishedPortals)
      .set({
        customDomainStatus: cfStatus.status,
        customDomainSslStatus: cfStatus.sslStatus,
        cfVerificationData: {
          ownershipVerification: cfStatus.ownershipVerification,
          sslValidationRecords: cfStatus.sslValidationRecords,
          verificationErrors: cfStatus.verificationErrors,
        },
        updatedAt: new Date(),
      })
      .where(eq(publishedPortals.id, p.id));

    return {
      success: true,
      status: cfStatus.status,
      sslStatus: cfStatus.sslStatus,
      cnameTarget: cfStatus.cnameTarget,
      ownershipVerification: cfStatus.ownershipVerification,
      sslValidationRecords: cfStatus.sslValidationRecords,
      simulationMode: cfStatus.simulationMode,
    };
  });

/**
 * Remove custom domain from a published portal.
 */
export const removeCustomDomain = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kitId: z.string().uuid(),
      ownerToken: z.string().min(1),
    }).parse,
  )
  .handler(async ({ data }) => {
    const portals = await db
      .select()
      .from(publishedPortals)
      .where(eq(publishedPortals.kitId, data.kitId))
      .limit(1);

    if (!portals.length || !portals[0].customDomain) {
      return { success: true };
    }

    const p = portals[0];
    if (p.cfCustomHostnameId) {
      await deleteCustomHostname(p.cfCustomHostnameId).catch((err) =>
        console.warn("Failed to delete Cloudflare hostname:", err),
      );
    }

    if (p.customDomain) {
      await purgePortalEdgeCache(p.customDomain);
    }

    await db
      .update(publishedPortals)
      .set({
        customDomain: null,
        customDomainStatus: "unconfigured",
        customDomainSslStatus: "pending",
        cfCustomHostnameId: null,
        cfVerificationData: null,
        updatedAt: new Date(),
      })
      .where(eq(publishedPortals.id, p.id));

    return { success: true };
  });
