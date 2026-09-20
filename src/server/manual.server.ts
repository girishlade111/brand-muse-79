import { z } from "zod";
import { getAdmin } from "./supabase-admin.server";
import { firecrawlScrape } from "./ai.server";

export const ScrapeSourceTextInputSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10),
});
export type ScrapeSourceTextInput = z.infer<typeof ScrapeSourceTextInputSchema>;

export async function scrapeSourceTextImpl(data: ScrapeSourceTextInput) {
  const results = await Promise.allSettled(data.urls.map((u) => firecrawlScrape(u)));
  const texts: Array<{ url: string; text: string }> = [];
  const errors: Array<{ url: string; message: string }> = [];
  results.forEach((r, i) => {
    const url = data.urls[i];
    if (r.status === "fulfilled") {
      const doc = (r.value as any)?.data ?? r.value;
      const md: string = doc?.markdown ?? doc?.text ?? "";
      if (md && md.trim()) {
        texts.push({ url, text: md.slice(0, 60000) });
      } else {
        errors.push({ url, message: "No readable text found" });
      }
    } else {
      errors.push({ url, message: String((r.reason as any)?.message ?? r.reason ?? "Failed") });
    }
  });
  return { texts, errors };
}

export const SaveManualKitInputSchema = z.object({
  kitId: z.string().uuid(),
  name: z.string().min(1).max(120),
  sourceUrl: z.string().url().optional(),
  sourceText: z.string().max(200000).optional(),
  colors: z
    .array(
      z.object({
        hex: z.string().min(3).max(9),
        name: z.string().max(60).optional(),
        role: z.string().max(40).optional(),
      }),
    )
    .max(40),
  fonts: z
    .array(
      z.object({
        family: z.string().min(1).max(80),
        role: z.string().max(40).optional(),
        weights: z.array(z.string().max(10)).max(12).optional(),
        google_font: z.boolean().optional(),
      }),
    )
    .max(12),
  tokens: z
    .array(
      z.object({
        category: z.string().min(1).max(40),
        name: z.string().min(1).max(60),
        value: z.string().min(1).max(200),
      }),
    )
    .max(120),
});
export type SaveManualKitInput = z.infer<typeof SaveManualKitInputSchema>;

export async function saveManualKitImpl(data: SaveManualKitInput) {
  const admin = getAdmin();

  const { data: kit } = await admin
    .from("brand_kits")
    .select("id")
    .eq("id", data.kitId)
    .maybeSingle();
  if (!kit) throw new Error("Kit not found");

  const updateRow: Record<string, any> = {
    name: data.name,
    status: "ready",
    source_type: "manual",
    error_code: null,
    error_status: null,
    error_message: null,
    updated_at: new Date().toISOString(),
  };
  if (data.sourceUrl) updateRow.source_url = data.sourceUrl;
  if (data.sourceText !== undefined) updateRow.source_text = data.sourceText || null;

  const { error: upErr } = await admin.from("brand_kits").update(updateRow).eq("id", data.kitId);
  if (upErr) throw new Error(upErr.message);

  await Promise.all([
    admin.from("kit_colors").delete().eq("kit_id", data.kitId),
    admin.from("kit_fonts").delete().eq("kit_id", data.kitId),
    admin.from("kit_tokens").delete().eq("kit_id", data.kitId),
  ]);

  if (data.colors.length) {
    const { error } = await admin.from("kit_colors").insert(
      data.colors.map((c, i) => ({
        kit_id: data.kitId,
        hex: c.hex.toUpperCase(),
        name: c.name || null,
        role: c.role || null,
        position: i,
      })),
    );
    if (error) throw new Error(error.message);
  }

  if (data.fonts.length) {
    const { error } = await admin.from("kit_fonts").insert(
      data.fonts.map((f, i) => ({
        kit_id: data.kitId,
        family: f.family,
        source_family: f.family,
        role: f.role || null,
        weights: f.weights ?? [],
        google_font: f.google_font ?? true,
        position: i,
      })),
    );
    if (error) throw new Error(error.message);
  }

  if (data.tokens.length) {
    const { error } = await admin.from("kit_tokens").insert(
      data.tokens.map((t, i) => ({
        kit_id: data.kitId,
        category: t.category,
        name: t.name,
        value: t.value,
        position: i,
      })),
    );
    if (error) throw new Error(error.message);
  }

  return { ok: true, kitId: data.kitId };
}
