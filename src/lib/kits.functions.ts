import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  brandKits,
  kitAssets,
  kitColors,
  kitFonts,
  kitTokens,
  kitVoice,
} from "@/db/index.server";

const STALE_PROCESSING_MS = 90 * 1000;

// Tiny no-op used to warm the Cloudflare Worker on page load so that the
// first real `createKit` / `extractKit` call doesn't pay cold-start cost.
export const warmServer = createServerFn({ method: "GET" }).handler(async () => {
  return { ok: true, t: Date.now() };
});

// Create a kit row (anonymous or owned). Returns kit id + anon token if anon.
export const createKit = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ownerToken: z.string().min(1).max(200), // anon token from client OR auth user id
      isAuthed: z.boolean(),
      sourceType: z.enum(["url", "upload", "manual", "mixed"]),
      sourceUrl: z.string().url().optional(),
      name: z.string().max(120).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const rows = await db
      .insert(brandKits)
      .values({
        name: data.name ?? "Untitled brand kit",
        sourceType: data.sourceType,
        sourceUrl: data.sourceUrl ?? null,
        status: "pending",
        userId: data.isAuthed ? data.ownerToken : null,
        anonToken: data.isAuthed ? null : data.ownerToken,
      })
      .returning({ id: brandKits.id });
    const created = rows[0];
    if (!created) throw new Error("Failed to create kit");
    return { id: created.id as string };
  });

// Fetch a kit + all related data, gated by owner token or share token.
export const getKit = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kitId: z.string().uuid(),
      ownerToken: z.string().min(1).max(200).optional(),
      shareToken: z.string().min(1).max(200).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const kitRows = await db.select().from(brandKits).where(eq(brandKits.id, data.kitId)).limit(1);
    const found = kitRows[0];
    if (!found) throw new Error("Kit not found");
    let k: any = found;
    // Personal app — no auth gate. Anyone with the link can view/edit.

    const updatedAt = k.updatedAt ? Date.parse(String(k.updatedAt)) : Date.now();
    if (
      (k.status === "pending" || k.status === "processing") &&
      Date.now() - updatedAt > STALE_PROCESSING_MS
    ) {
      const message = "Extraction timed out before completion. Retry will restart it.";
      await db
        .update(brandKits)
        .set({ status: "error", errorCode: "timeout", errorMessage: message })
        .where(eq(brandKits.id, data.kitId));
      k = { ...k, status: "error", error_code: "timeout", error_message: message };
    }

    const fetchNormalized = async () => {
      const [colors, fonts, tokens, assets, voiceRows] = await Promise.all([
        db
          .select()
          .from(kitColors)
          .where(eq(kitColors.kitId, data.kitId))
          .orderBy(asc(kitColors.position)),
        db
          .select()
          .from(kitFonts)
          .where(eq(kitFonts.kitId, data.kitId))
          .orderBy(asc(kitFonts.position)),
        db
          .select()
          .from(kitTokens)
          .where(eq(kitTokens.kitId, data.kitId))
          .orderBy(asc(kitTokens.position)),
        db
          .select()
          .from(kitAssets)
          .where(eq(kitAssets.kitId, data.kitId))
          .orderBy(asc(kitAssets.position)),
        db.select().from(kitVoice).where(eq(kitVoice.kitId, data.kitId)).limit(1),
      ]);

      return {
        kit: k,
        colors,
        fonts,
        tokens,
        assets,
        voice: voiceRows[0] ?? null,
      };
    };

    if (k.status === "ready") {
      const { cacheNormalizedKit } = await import("@/server/cache.server");
      return cacheNormalizedKit(data.kitId, fetchNormalized);
    }

    return fetchNormalized();
  });

// Helper: verify ownership of a kit
async function loadOwnedKit(kitId: string, _ownerToken: string) {
  const rows = await db.select().from(brandKits).where(eq(brandKits.id, kitId)).limit(1);
  const kit = rows[0];
  if (!kit) throw new Error("Kit not found");
  // Personal app — no ownership gate.
  return kit as any;
}

export const renameKit = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kitId: z.string().uuid(),
      ownerToken: z.string().min(1).max(200),
      name: z.string().min(1).max(120),
    }).parse,
  )
  .handler(async ({ data }) => {
    await loadOwnedKit(data.kitId, data.ownerToken);
    await db.update(brandKits).set({ name: data.name }).where(eq(brandKits.id, data.kitId));
    const { invalidateKitCache } = await import("@/server/cache.server");
    await invalidateKitCache(data.kitId);
    return { ok: true };
  });

export const deleteKit = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kitId: z.string().uuid(),
      ownerToken: z.string().min(1).max(200),
    }).parse,
  )
  .handler(async ({ data }) => {
    await loadOwnedKit(data.kitId, data.ownerToken);
    // FK cascades handle children, but delete explicitly for Neon parity
    // with the old Supabase flow (which had no cascade).
    await db.transaction(async (tx) => {
      await Promise.all([
        tx.delete(kitColors).where(eq(kitColors.kitId, data.kitId)),
        tx.delete(kitFonts).where(eq(kitFonts.kitId, data.kitId)),
        tx.delete(kitTokens).where(eq(kitTokens.kitId, data.kitId)),
        tx.delete(kitAssets).where(eq(kitAssets.kitId, data.kitId)),
        tx.delete(kitVoice).where(eq(kitVoice.kitId, data.kitId)),
      ]);
      await tx.delete(brandKits).where(eq(brandKits.id, data.kitId));
    });
    const { invalidateKitCache } = await import("@/server/cache.server");
    await invalidateKitCache(data.kitId);
    return { ok: true };
  });

export const duplicateKit = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kitId: z.string().uuid(),
      ownerToken: z.string().min(1).max(200),
    }).parse,
  )
  .handler(async ({ data }) => {
    const src = await loadOwnedKit(data.kitId, data.ownerToken);
    const { id: _omitId, createdAt: _ca, updatedAt: _ua, shareToken: _st, ...rest } = src as any;
    void _omitId;
    void _ca;
    void _ua;
    void _st;
    const createdRows = await db
      .insert(brandKits)
      .values({
        ...rest,
        name: `${src.name ?? "Untitled"} (copy)`,
        shareToken: null,
        isPublic: false,
      })
      .returning();
    const created = createdRows[0];
    if (!created) throw new Error("Failed to duplicate kit");
    const newId = (created as any).id as string;

    async function copyChildren(
      table:
        typeof kitColors | typeof kitFonts | typeof kitTokens | typeof kitAssets | typeof kitVoice,
    ) {
      const rows = await db
        .select()
        .from(table as any)
        .where(eq((table as any).kitId, data.kitId));
      if (!rows || rows.length === 0) return;
      const cleaned = (rows as any[]).map((r: any) => {
        const { id, createdAt, updatedAt, ...restRow } = r;
        void id;
        void createdAt;
        void updatedAt;
        return { ...restRow, kitId: newId };
      });
      await db.insert(table as any).values(cleaned);
    }
    await Promise.all([
      copyChildren(kitColors),
      copyChildren(kitFonts),
      copyChildren(kitTokens),
      copyChildren(kitAssets),
      copyChildren(kitVoice),
    ]);

    return { kit: created };
  });

// List all kits owned by the given token (anon or user id).
export const listKitsByOwner = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ownerToken: z.string().min(1).max(200),
      // Optional: include older anon tokens this browser has used so kits
      // created before a token rotation are still surfaced.
      ownerTokens: z.array(z.string().min(1).max(200)).max(20).optional(),
      // Optional cap — used by the landing page recent-kits widget to keep
      // the round-trip lean (3 rows + their colors/fonts/logo only).
      limit: z.number().int().min(1).max(200).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    // Shared workspace: every visitor sees every kit. The ownerToken /
    // ownerTokens inputs are accepted for backward compatibility but ignored.
    void data.ownerToken;
    void data.ownerTokens;
    const kitRows = data.limit
      ? await db
          .select({
            id: brandKits.id,
            name: brandKits.name,
            sourceUrl: brandKits.sourceUrl,
            status: brandKits.status,
            createdAt: brandKits.createdAt,
          })
          .from(brandKits)
          .orderBy(desc(brandKits.createdAt))
          .limit(data.limit)
      : await db
          .select({
            id: brandKits.id,
            name: brandKits.name,
            sourceUrl: brandKits.sourceUrl,
            status: brandKits.status,
            createdAt: brandKits.createdAt,
          })
          .from(brandKits)
          .orderBy(desc(brandKits.createdAt));
    const rows = kitRows ?? [];
    if (rows.length === 0) return { kits: [] };

    const ids = rows.map((r: any) => r.id);
    const [colors, fonts, assets] = await Promise.all([
      db
        .select({
          kitId: kitColors.kitId,
          hex: kitColors.hex,
          role: kitColors.role,
          position: kitColors.position,
        })
        .from(kitColors)
        .where(inArray(kitColors.kitId, ids))
        .orderBy(asc(kitColors.position)),
      db
        .select({
          kitId: kitFonts.kitId,
          family: kitFonts.family,
          sourceFamily: kitFonts.sourceFamily,
          role: kitFonts.role,
          googleFont: kitFonts.googleFont,
          weights: kitFonts.weights,
          fileUrls: kitFonts.fileUrls,
          position: kitFonts.position,
        })
        .from(kitFonts)
        .where(inArray(kitFonts.kitId, ids))
        .orderBy(asc(kitFonts.position)),
      db
        .select({
          kitId: kitAssets.kitId,
          kind: kitAssets.kind,
          url: kitAssets.url,
          position: kitAssets.position,
        })
        .from(kitAssets)
        .where(inArray(kitAssets.kitId, ids))
        .orderBy(asc(kitAssets.position)),
    ]);

    const palette: Record<string, { hex: string; role: string | null }[]> = {};
    (colors ?? []).forEach((c: any) => {
      (palette[c.kitId] ||= []).push({ hex: c.hex, role: c.role ?? null });
    });

    type DisplayFont = {
      family: string;
      google: boolean;
      source_family?: string | null;
      weights?: string[] | null;
      file_urls?: Array<{ url: string; weight?: string; style?: string; format?: string }> | null;
    };
    const displayFont: Record<string, DisplayFont | null> = {};
    const displayRank: Record<string, number> = {};
    const rolePriority = ["display", "heading", "h1", "h2", "title", "body"];
    // Reject CSS-variable strings, generic stacks, and obviously broken
    // families that won't render anywhere.
    const isUsableFamily = (raw: string) => {
      const f = raw.trim().replace(/^["']|["']$/g, "");
      if (!f) return false;
      if (/^var\(/i.test(f)) return false;
      if (/^(inherit|initial|unset|revert|currentcolor)$/i.test(f)) return false;
      const generics = new Set([
        "serif",
        "sans-serif",
        "monospace",
        "system-ui",
        "ui-sans-serif",
        "ui-serif",
        "ui-monospace",
        "ui-rounded",
        "-apple-system",
        "blinkmacsystemfont",
      ]);
      if (generics.has(f.toLowerCase())) return false;
      return true;
    };
    (fonts ?? []).forEach((f: any) => {
      if (!f.family) return;
      if (!isUsableFamily(f.family)) return;
      const roleIdx = rolePriority.indexOf((f.role ?? "").toLowerCase());
      let rank = roleIdx === -1 ? 99 : roleIdx;
      // Loadable = google-hosted OR has discovered file_urls we can @font-face.
      const fileUrls = f.fileUrls as DisplayFont["file_urls"];
      const hasFiles = Array.isArray(fileUrls) && fileUrls.length > 0;
      if (!f.googleFont && !hasFiles) rank += 100;
      const cur = displayRank[f.kitId];
      if (cur === undefined || rank < cur) {
        displayRank[f.kitId] = rank;
        displayFont[f.kitId] = {
          family: f.family,
          google: !!f.googleFont,
          source_family: f.sourceFamily ?? null,
          weights: Array.isArray(f.weights) ? f.weights : null,
          file_urls: hasFiles ? fileUrls : null,
        };
      }
    });

    const logoPriority = ["logo", "logo-mark", "logomark", "wordmark", "icon", "favicon"];
    const bestRank: Record<string, number> = {};
    const logo: Record<string, string | null> = {};
    (assets ?? []).forEach((a: any) => {
      const rank = logoPriority.indexOf(a.kind);
      if (rank === -1) return;
      const cur = bestRank[a.kitId];
      if (cur === undefined || rank < cur) {
        bestRank[a.kitId] = rank;
        logo[a.kitId] = a.url;
      }
    });

    return {
      kits: rows.map((r: any) => {
        const kitColorsList = palette[r.id] ?? [];
        const primary =
          kitColorsList.find((c) => c.role === "primary")?.hex ?? kitColorsList[0]?.hex ?? null;
        return {
          ...r,
          source_url: r.sourceUrl ?? null,
          created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
          primaryHex: primary,
          palette: kitColorsList.slice(0, 5).map((c) => c.hex),
          displayFont: displayFont[r.id] ?? null,
          logoUrl: logo[r.id] ?? null,
        };
      }),
    };
  });

// Delete many kits at once. Skips kits not owned by the token.
export const bulkDeleteKits = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kitIds: z.array(z.string().uuid()).min(1).max(200),
      ownerToken: z.string().min(1).max(200),
    }).parse,
  )
  .handler(async ({ data }) => {
    // Shared workspace — anyone can delete any kit.
    void data.ownerToken;
    const rows = await db
      .select({ id: brandKits.id })
      .from(brandKits)
      .where(inArray(brandKits.id, data.kitIds));
    const ownedIds = (rows ?? []).map((r: any) => r.id as string);
    if (ownedIds.length === 0) return { deleted: 0 };
    await db.transaction(async (tx) => {
      await Promise.all([
        tx.delete(kitColors).where(inArray(kitColors.kitId, ownedIds)),
        tx.delete(kitFonts).where(inArray(kitFonts.kitId, ownedIds)),
        tx.delete(kitTokens).where(inArray(kitTokens.kitId, ownedIds)),
        tx.delete(kitAssets).where(inArray(kitAssets.kitId, ownedIds)),
        tx.delete(kitVoice).where(inArray(kitVoice.kitId, ownedIds)),
      ]);
      await tx.delete(brandKits).where(inArray(brandKits.id, ownedIds));
    });
    return { deleted: ownedIds.length };
  });

// Named exports for step-5 parity (`getBrandKitFn` / `listUserKitsFn`).
export const getBrandKitFn = getKit;
export const listUserKitsFn = listKitsByOwner;
export const deleteKitFn = deleteKit;
export { and };
