import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAdmin } from "@/server/supabase-admin.server";

async function assertOwner(kitId: string, _ownerToken: string) {
  // Shared workspace — confirm kit exists; do not gate on ownership.
  const admin = getAdmin();
  const { data: kit, error } = await admin
    .from("brand_kits")
    .select("id")
    .eq("id", kitId)
    .maybeSingle();
  if (error || !kit) throw new Error("Kit not found");
  return admin;
}

const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const DeleteAssetSchema = z.object({
  kitId: z.string().uuid(),
  assetId: z.string().uuid(),
  ownerToken: z.string().min(1).max(200),
});

export const deleteKitAsset = createServerFn({ method: "POST" })
  .inputValidator((d) => DeleteAssetSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = await assertOwner(data.kitId, data.ownerToken);
    const { data: asset } = await admin
      .from("kit_assets")
      .select("storage_path")
      .eq("id", data.assetId)
      .eq("kit_id", data.kitId)
      .maybeSingle();
    if (asset?.storage_path) {
      await admin.storage
        .from("brand-assets")
        .remove([asset.storage_path])
        .catch(() => null);
    }
    const { error } = await admin
      .from("kit_assets")
      .delete()
      .eq("id", data.assetId)
      .eq("kit_id", data.kitId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DeleteColorSchema = z.object({
  kitId: z.string().uuid(),
  colorId: z.string().uuid(),
  ownerToken: z.string().min(1).max(200),
});

export const deleteKitColor = createServerFn({ method: "POST" })
  .inputValidator((d) => DeleteColorSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = await assertOwner(data.kitId, data.ownerToken);
    const { error } = await admin
      .from("kit_colors")
      .delete()
      .eq("id", data.colorId)
      .eq("kit_id", data.kitId);
    if (error) throw new Error(error.message);
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
  .inputValidator((d) => UpdateColorSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = await assertOwner(data.kitId, data.ownerToken);
    const patch: Record<string, any> = {};
    if (data.hex) patch.hex = data.hex.toUpperCase();
    if (data.role) patch.role = data.role;
    if (data.name !== undefined) patch.name = data.name;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await admin
      .from("kit_colors")
      .update(patch)
      .eq("id", data.colorId)
      .eq("kit_id", data.kitId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const AddColorSchema = z.object({
  kitId: z.string().uuid(),
  ownerToken: z.string().min(1).max(200),
  hex: z.string().regex(HEX),
  role: z.string().max(40).optional(),
  name: z.string().max(80).nullable().optional(),
});

export const addKitColor = createServerFn({ method: "POST" })
  .inputValidator((d) => AddColorSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = await assertOwner(data.kitId, data.ownerToken);
    const { count } = await admin
      .from("kit_colors")
      .select("id", { count: "exact", head: true })
      .eq("kit_id", data.kitId);
    const { data: row, error } = await admin
      .from("kit_colors")
      .insert({
        kit_id: data.kitId,
        hex: data.hex.toUpperCase(),
        role: data.role || null,
        name: data.name ?? null,
        position: count ?? 0,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (row as any)?.id as string };
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
  .inputValidator((d) => UpdateFontSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = await assertOwner(data.kitId, data.ownerToken);
    const patch: Record<string, any> = {};
    if (data.family) {
      patch.family = data.family;
      patch.source_family = data.family;
      patch.is_substitute = false;
      patch.file_urls = [];
    }
    if (data.role !== undefined) patch.role = data.role || null;
    if (data.weights) patch.weights = data.weights;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await admin
      .from("kit_fonts")
      .update(patch)
      .eq("id", data.fontId)
      .eq("kit_id", data.kitId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
const DeleteFontSchema = z.object({
  kitId: z.string().uuid(),
  fontId: z.string().uuid(),
  ownerToken: z.string().min(1).max(200),
});

export const deleteKitFont = createServerFn({ method: "POST" })
  .inputValidator((d) => DeleteFontSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = await assertOwner(data.kitId, data.ownerToken);
    const { error } = await admin
      .from("kit_fonts")
      .delete()
      .eq("id", data.fontId)
      .eq("kit_id", data.kitId);
    if (error) throw new Error(error.message);
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
  .inputValidator((d) => AddFontSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = await assertOwner(data.kitId, data.ownerToken);
    const { count } = await admin
      .from("kit_fonts")
      .select("id", { count: "exact", head: true })
      .eq("kit_id", data.kitId);
    const { data: row, error } = await admin
      .from("kit_fonts")
      .insert({
        kit_id: data.kitId,
        family: data.family,
        source_family: data.family,
        role: data.role || null,
        weights: data.weights ?? [],
        google_font: true,
        position: count ?? 0,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (row as any)?.id as string };
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
  .inputValidator((d) => UpdateTokenSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = await assertOwner(data.kitId, data.ownerToken);
    const patch: Record<string, any> = {};
    if (data.category) patch.category = data.category;
    if (data.name) patch.name = data.name;
    if (data.value) patch.value = data.value;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await admin
      .from("kit_tokens")
      .update(patch)
      .eq("id", data.tokenId)
      .eq("kit_id", data.kitId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DeleteTokenSchema = z.object({
  kitId: z.string().uuid(),
  tokenId: z.string().uuid(),
  ownerToken: z.string().min(1).max(200),
});

export const deleteKitToken = createServerFn({ method: "POST" })
  .inputValidator((d) => DeleteTokenSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = await assertOwner(data.kitId, data.ownerToken);
    const { error } = await admin
      .from("kit_tokens")
      .delete()
      .eq("id", data.tokenId)
      .eq("kit_id", data.kitId);
    if (error) throw new Error(error.message);
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
  .inputValidator((d) => AddTokenSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = await assertOwner(data.kitId, data.ownerToken);
    const { count } = await admin
      .from("kit_tokens")
      .select("id", { count: "exact", head: true })
      .eq("kit_id", data.kitId);
    const { data: row, error } = await admin
      .from("kit_tokens")
      .insert({
        kit_id: data.kitId,
        category: data.category,
        name: data.name,
        value: data.value,
        position: count ?? 0,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (row as any)?.id as string };
  });
