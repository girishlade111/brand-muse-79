import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  brandKits,
  kitAssets,
  kitColors,
  kitFonts,
  kitTokens,
  kitVoice,
} from "@/db/index.server";

export const getSharedKit = createServerFn({ method: "POST" })
  .validator(z.object({ shareToken: z.string().min(8).max(64) }).parse)
  .handler(async ({ data }) => {
    const kitRows = await db
      .select()
      .from(brandKits)
      .where(and(eq(brandKits.shareToken, data.shareToken), eq(brandKits.isPublic, true)))
      .limit(1);
    const k = kitRows[0] as any;
    if (!k) throw new Error("Shared kit not found or no longer public");
    const [colors, fonts, tokens, assets, voiceRows] = await Promise.all([
      db.select().from(kitColors).where(eq(kitColors.kitId, k.id)).orderBy(asc(kitColors.position)),
      db.select().from(kitFonts).where(eq(kitFonts.kitId, k.id)).orderBy(asc(kitFonts.position)),
      db.select().from(kitTokens).where(eq(kitTokens.kitId, k.id)).orderBy(asc(kitTokens.position)),
      db.select().from(kitAssets).where(eq(kitAssets.kitId, k.id)).orderBy(asc(kitAssets.position)),
      db.select().from(kitVoice).where(eq(kitVoice.kitId, k.id)).limit(1),
    ]);
    return {
      kit: k,
      colors,
      fonts,
      tokens,
      assets,
      voice: voiceRows[0] ?? null,
    };
  });
