import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, brandKits } from "@/db/index.server";

// Toggle public sharing for a kit. Owner-only.
export const setKitShare = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kitId: z.string().uuid(),
      ownerToken: z.string().min(1).max(200),
      isPublic: z.boolean(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const rows = await db
      .select({
        id: brandKits.id,
        userId: brandKits.userId,
        anonToken: brandKits.anonToken,
        shareToken: brandKits.shareToken,
      })
      .from(brandKits)
      .where(eq(brandKits.id, data.kitId))
      .limit(1);
    const k = rows[0] as any;
    if (!k) throw new Error("Kit not found");
    // Ownership gate: only the kit owner (auth user_id OR anon_token holder) may toggle sharing.
    const isOwner =
      (k.userId && k.userId === data.ownerToken) ||
      (k.anonToken && k.anonToken === data.ownerToken);
    if (!isOwner) throw new Error("Forbidden: only the kit owner can change sharing");

    const shareToken =
      data.isPublic && !k.shareToken ? crypto.randomUUID().replace(/-/g, "") : undefined;
    const updatedRows = await db
      .update(brandKits)
      .set({
        isPublic: data.isPublic,
        ...(shareToken ? { shareToken } : {}),
      })
      .where(eq(brandKits.id, data.kitId))
      .returning({ shareToken: brandKits.shareToken, isPublic: brandKits.isPublic });
    const updated = updatedRows[0];
    if (!updated) throw new Error("Failed to update sharing");
    // Return both snake_case (legacy client) and camelCase shapes.
    return {
      share_token: updated.shareToken,
      is_public: updated.isPublic,
      shareToken: updated.shareToken,
      isPublic: updated.isPublic,
    };
  });

// Claim an anonymous kit when a user signs in.
export const claimKit = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kitId: z.string().uuid(),
      anonToken: z.string().min(1).max(200),
      userId: z.string().uuid(),
    }).parse,
  )
  .handler(async ({ data }) => {
    await db
      .update(brandKits)
      .set({ userId: data.userId, anonToken: null })
      .where(and(eq(brandKits.id, data.kitId), eq(brandKits.anonToken, data.anonToken)));
    return { ok: true };
  });
