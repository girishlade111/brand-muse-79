import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, brandKits, kitAssets, kitColors, kitFonts, kitTokens } from "@/db/index.server";
import { deleteAsset } from "@/server/storage.server";

async function assertOwner(kitId: string, _ownerToken: string) {
  // Shared workspace — confirm kit exists; do not gate on ownership.
  const rows = await db
    .select({ id: brandKits.id })
    .from(brandKits)
    .where(eq(brandKits.id, kitId))
    .limit(1);
  if (!rows.length) throw new Error("Kit not found");
}

const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const DeleteAssetSchema = z.object({
  kitId: z.string().uuid(),
  assetId: z.string().uuid(),
  ownerToken: z.string().min(1).max(200),
});

export const deleteKitAsset = createServerFn({ method: "POST" })
  .validator((d) => DeleteAssetSchema.parse(d))
  .handler(async ({ data }) => {
    await assertOwner(data.kitId, data.ownerToken);
    const rows = await db
      .select({ storagePath: kitAssets.storagePath })
      .from(kitAssets)
      .where(and(eq(kitAssets.id, data.assetId), eq(kitAssets.kitId, data.kitId)))
      .limit(1);
    const asset = rows[0];
    if (asset?.storagePath) {
      await deleteAsset(asset.storagePath).catch(() => null);
    }
    await db
      .delete(kitAssets)
      .where(and(eq(kitAssets.id, data.assetId), eq(kitAssets.kitId, data.kitId)));
    return { ok: true };
  });

const DeleteColorSchema = z.object({
  kitId: z.string().uuid(),
  colorId: z.string().uuid(),
  ownerToken: z.string().min(1).max(200),
});

export const deleteKitColor = createServerFn({ method: "POST" })
  .validator((d) => DeleteColorSchema.parse(d))
  .handler(async ({ data }) => {
    await assertOwner(data.kitId, data.ownerToken);
    await db
      .delete(kitColors)
      .where(and(eq(kitColors.id, data.colorId), eq(kitColors.kitId, data.kitId)));
    return { ok: true };
  });

const UpdateColorSchema = z.object({
  kitId: z.string().uuid(),
  colorId: z.string().uuid(),
  ownerToken: z.string().min(1).max(200),
  hex: z.string().regex(HEX).optional(),
  role: z.string().min(1).max(40).optional(),
  name: z.string().min(1).max(80).nullable().optional(),
});

export const updateKitColor = createServerFn({ method: "POST" })
  .validator((d) => UpdateColorSchema.parse(d))
  .handler(async ({ data }) => {
    await assertOwner(data.kitId, data.ownerToken);
    const patch: Partial<typeof kitColors.$inferInsert> = {};
    if (data.hex) patch.hex = data.hex.toUpperCase();
    if (data.role) patch.role = data.role;
    if (data.name !== undefined) patch.name = data.name;
    if (!Object.keys(patch).length) return { ok: true };
    await db
      .update(kitColors)
      .set(patch)
      .where(and(eq(kitColors.id, data.colorId), eq(kitColors.kitId, data.kitId)));
    return { ok: true };
  });

// Named export for step-5 parity.
export const updateColorFn = updateKitColor;

const AddColorSchema = z.object({
  kitId: z.string().uuid(),
  ownerToken: z.string().min(1).max(200),
  hex: z.string().regex(HEX),
  role: z.string().max(40).optional(),
  name: z.string().max(80).nullable().optional(),
});

export const addKitColor = createServerFn({ method: "POST" })
  .validator((d) => AddColorSchema.parse(d))
  .handler(async ({ data }) => {
    await assertOwner(data.kitId, data.ownerToken);
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(kitColors)
      .where(eq(kitColors.kitId, data.kitId));
    const position = Number(countRows[0]?.count ?? 0);
    const rows = await db
      .insert(kitColors)
      .values({
        kitId: data.kitId,
        hex: data.hex.toUpperCase(),
        role: data.role || null,
        name: data.name ?? null,
        position,
      })
      .returning({ id: kitColors.id });
    return { ok: true, id: rows[0]?.id as string };
  });

// ---------- fonts ----------

const UpdateFontSchema = z.object({
  kitId: z.string().uuid(),
  fontId: z.string().uuid(),
  ownerToken: z.string().min(1).max(200),
  family: z.string().min(1).max(80).optional(),
  role: z.string().max(40).optional(),
  weights: z.array(z.string().max(10)).max(12).optional(),
});

export const updateKitFont = createServerFn({ method: "POST" })
  .validator((d) => UpdateFontSchema.parse(d))
  .handler(async ({ data }) => {
    await assertOwner(data.kitId, data.ownerToken);
    const patch: Partial<typeof kitFonts.$inferInsert> = {};
    if (data.family) {
      patch.family = data.family;
      patch.sourceFamily = data.family;
      patch.isSubstitute = false;
      patch.fileUrls = [];
    }
    if (data.role !== undefined) patch.role = data.role || null;
    if (data.weights) patch.weights = data.weights;
    if (!Object.keys(patch).length) return { ok: true };
    await db
      .update(kitFonts)
      .set(patch)
      .where(and(eq(kitFonts.id, data.fontId), eq(kitFonts.kitId, data.kitId)));
    return { ok: true };
  });
const DeleteFontSchema = z.object({
  kitId: z.string().uuid(),
  fontId: z.string().uuid(),
  ownerToken: z.string().min(1).max(200),
});

export const deleteKitFont = createServerFn({ method: "POST" })
  .validator((d) => DeleteFontSchema.parse(d))
  .handler(async ({ data }) => {
    await assertOwner(data.kitId, data.ownerToken);
    await db
      .delete(kitFonts)
      .where(and(eq(kitFonts.id, data.fontId), eq(kitFonts.kitId, data.kitId)));
    return { ok: true };
  });

const AddFontSchema = z.object({
  kitId: z.string().uuid(),
  ownerToken: z.string().min(1).max(200),
  family: z.string().min(1).max(80),
  role: z.string().max(40).optional(),
  weights: z.array(z.string().max(10)).max(12).optional(),
});

export const addKitFont = createServerFn({ method: "POST" })
  .validator((d) => AddFontSchema.parse(d))
  .handler(async ({ data }) => {
    await assertOwner(data.kitId, data.ownerToken);
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(kitFonts)
      .where(eq(kitFonts.kitId, data.kitId));
    const position = Number(countRows[0]?.count ?? 0);
    const rows = await db
      .insert(kitFonts)
      .values({
        kitId: data.kitId,
        family: data.family,
        sourceFamily: data.family,
        role: data.role || null,
        weights: data.weights ?? [],
        googleFont: true,
        position,
      })
      .returning({ id: kitFonts.id });
    return { ok: true, id: rows[0]?.id as string };
  });

// ---------- tokens ----------

const UpdateTokenSchema = z.object({
  kitId: z.string().uuid(),
  tokenId: z.string().uuid(),
  ownerToken: z.string().min(1).max(200),
  category: z.string().min(1).max(40).optional(),
  name: z.string().min(1).max(60).optional(),
  value: z.string().min(1).max(200).optional(),
});

export const updateKitToken = createServerFn({ method: "POST" })
  .validator((d) => UpdateTokenSchema.parse(d))
  .handler(async ({ data }) => {
    await assertOwner(data.kitId, data.ownerToken);
    const patch: Partial<typeof kitTokens.$inferInsert> = {};
    if (data.category) patch.category = data.category;
    if (data.name) patch.name = data.name;
    if (data.value) patch.value = data.value;
    if (!Object.keys(patch).length) return { ok: true };
    await db
      .update(kitTokens)
      .set(patch)
      .where(and(eq(kitTokens.id, data.tokenId), eq(kitTokens.kitId, data.kitId)));
    return { ok: true };
  });

// Named export for step-5 parity.
export const updateTokenFn = updateKitToken;

const DeleteTokenSchema = z.object({
  kitId: z.string().uuid(),
  tokenId: z.string().uuid(),
  ownerToken: z.string().min(1).max(200),
});

export const deleteKitToken = createServerFn({ method: "POST" })
  .validator((d) => DeleteTokenSchema.parse(d))
  .handler(async ({ data }) => {
    await assertOwner(data.kitId, data.ownerToken);
    await db
      .delete(kitTokens)
      .where(and(eq(kitTokens.id, data.tokenId), eq(kitTokens.kitId, data.kitId)));
    return { ok: true };
  });

const AddTokenSchema = z.object({
  kitId: z.string().uuid(),
  ownerToken: z.string().min(1).max(200),
  category: z.string().min(1).max(40),
  name: z.string().min(1).max(60),
  value: z.string().min(1).max(200),
});

export const addKitToken = createServerFn({ method: "POST" })
  .validator((d) => AddTokenSchema.parse(d))
  .handler(async ({ data }) => {
    await assertOwner(data.kitId, data.ownerToken);
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(kitTokens)
      .where(eq(kitTokens.kitId, data.kitId));
    const position = Number(countRows[0]?.count ?? 0);
    const rows = await db
      .insert(kitTokens)
      .values({
        kitId: data.kitId,
        category: data.category,
        name: data.name,
        value: data.value,
        position,
      })
      .returning({ id: kitTokens.id });
    return { ok: true, id: rows[0]?.id as string };
  });
