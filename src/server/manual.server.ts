import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, brandKits, kitColors, kitFonts, kitTokens } from "@/db/index.server";
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
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: brandKits.id })
      .from(brandKits)
      .where(eq(brandKits.id, data.kitId))
      .limit(1);
    if (!existing.length) throw new Error("Kit not found");

    await tx
      .update(brandKits)
      .set({
        name: data.name,
        status: "ready",
        sourceType: "manual",
        sourceUrl: data.sourceUrl ?? undefined,
        sourceText: data.sourceText !== undefined ? data.sourceText || null : undefined,
        errorCode: null,
        errorStatus: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(brandKits.id, data.kitId));

    await Promise.all([
      tx.delete(kitColors).where(eq(kitColors.kitId, data.kitId)),
      tx.delete(kitFonts).where(eq(kitFonts.kitId, data.kitId)),
      tx.delete(kitTokens).where(eq(kitTokens.kitId, data.kitId)),
    ]);

    if (data.colors.length) {
      await tx.insert(kitColors).values(
        data.colors.map((c, i) => ({
          kitId: data.kitId,
          hex: c.hex.toUpperCase(),
          name: c.name || null,
          role: c.role || null,
          position: i,
        })),
      );
    }

    if (data.fonts.length) {
      await tx.insert(kitFonts).values(
        data.fonts.map((f, i) => ({
          kitId: data.kitId,
          family: f.family,
          sourceFamily: f.family,
          role: f.role || null,
          weights: f.weights ?? [],
          googleFont: f.google_font ?? true,
          position: i,
        })),
      );
    }

    if (data.tokens.length) {
      await tx.insert(kitTokens).values(
        data.tokens.map((t, i) => ({
          kitId: data.kitId,
          category: t.category,
          name: t.name,
          value: t.value,
          position: i,
        })),
      );
    }

    return { ok: true, kitId: data.kitId };
  });
}
