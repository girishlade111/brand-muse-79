// Server-side Brand Mockups Engine — TanStack Start server functions.
// Synthesizes photorealistic studio prompts from brand DNA, dispatches to
// Lovable AI Gateway (Gemini 2.5 Flash Image), handles 429 rate-limiting
// gracefully with deterministic fallback, and persists mockups to kit_assets
// and the 'brand-assets' storage bucket.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db, brandKits, kitAssets, kitColors, kitFonts, kitVoice } from "@/db/index.server";
import { publicUrlFor, uploadAsset, deleteAsset } from "@/server/storage.server";
import { cleanHexColor, MOCKUP_PRESETS } from "@/lib/mockups";

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ---------------------------------------------------------------------------
// Prompt Engineering
// ---------------------------------------------------------------------------

export function buildMockupPrompt(opts: {
  category: string;
  presetId: string;
  presetName: string;
  kitName: string;
  primaryHex: string;
  secondaryHex: string;
  bgHex: string;
  headingFont: string;
  monoFont: string;
  positioning?: string;
  headline?: string;
  tagline?: string;
  cta?: string;
  variant: "light" | "dark";
}): string {
  const isDark = opts.variant === "dark";
  const brandName = opts.kitName.trim() || "Brand Muse";
  const positioning = opts.positioning ? ` Brand positioning: "${opts.positioning}".` : "";
  const headline = opts.headline || "The Invisible Instrument";
  const tagline = opts.tagline || "Architectural precision identity.";

  const categoryDirectives: Record<string, string> = {
    "social-media": `An ultra-high-resolution luxury editorial social media graphic for ${brandName}. Strict 0px border-radius, Japanese catalog aesthetic, sumi ink and washi paper contrast. Dominant background ${opts.bgHex}, accent details in ${opts.primaryHex} and ${opts.secondaryHex}. Typography inspired by Cormorant Garamond display and Courier Prime typewriter mono. Visible headline: "${headline}". Tagline: "${tagline}". Clean geometric alignment, razor-sharp 1px border framing, no decorative fluff.`,
    stationery: `A photorealistic studio mockup photograph of premium bespoke stationery for ${brandName}. Heavyweight 350gsm textured cotton business cards and an editorial letterhead folio laid out on an architectural surface. Color scheme: background ${opts.bgHex}, front card in deep ${opts.primaryHex} with subtle blind deboss / foil logo, and back card in clean ${opts.secondaryHex} with crisp typography. Overhead diffuse museum lighting, razor-sharp 0px rectangular edges, subtle cast shadows, luxury Japanese craftsmanship.`,
    merchandise: `A high-end editorial product mockup photograph for ${brandName}. A minimalist premium heavyweight 280gsm cotton t-shirt and a cylindrical matte ceramic studio coffee mug. Apparel color: ${isDark ? "#141414" : "#F7F5EE"}, mug in ${opts.bgHex}, with brand logo and typography precisely printed in ${opts.primaryHex}. Dramatic quiet studio lighting, tactile fabric drape texture, 0px sharp aesthetic presentation, museum archive standard.`,
    outdoor: `An architectural outdoor large-format advertising mockup for ${brandName}. A massive wide metro station billboard or backlit street display frame set into a brutalist concrete urban wall. Billboard display background: ${opts.bgHex}, high-contrast headline reading "${headline}", sharp 1px structural framing, brand mark in ${opts.primaryHex}. Overhead architectural spotlights casting directional beams, realistic atmospheric depth, no curved corners.`,
    "saas-dashboard": `A modern, state-of-the-art SaaS product platform hero interface for ${brandName}. Precision instrument dark or light UI layout, sharp 0px border-radius windows, left navigation bar with brand mark, top metric cards, and clean vector trend analytics charts. Color palette strictly anchored to primary ${opts.primaryHex}, secondary ${opts.secondaryHex}, and background ${opts.bgHex}. Clean data tables, mono numeric readouts, zero floating glow or purple gradients, brutalist digital efficiency.`,
  };

  const directive =
    categoryDirectives[opts.category] ??
    `A photorealistic brand identity mockup for ${brandName} displaying ${opts.presetName}. Active brand colors: Primary ${opts.primaryHex}, Secondary ${opts.secondaryHex}, Background ${opts.bgHex}. Sharp 0px corners, high contrast editorial aesthetic.${positioning}`;

  return [
    `Create a professional, award-winning brand mockup for "${brandName}".`,
    directive,
    `Style constraints: "The Invisible Instrument" design philosophy. 0px border radius everywhere. Palette: Primary ${opts.primaryHex}, Secondary ${opts.secondaryHex}, Background ${opts.bgHex}. High contrast, immaculate studio lighting, tactile authenticity. No generic purple gradients or AI distortions.`,
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Input Validation Schemas
// ---------------------------------------------------------------------------

export const GenerateMockupInputSchema = z.object({
  kitId: z.string().uuid(),
  category: z.enum(["social-media", "stationery", "merchandise", "outdoor", "saas-dashboard"]),
  presetId: z.string().min(1).max(80),
  variant: z.enum(["light", "dark"]).default("light"),
  customHeadline: z.string().max(200).optional(),
  customTagline: z.string().max(300).optional(),
  customCta: z.string().max(100).optional(),
  forceFallback: z.boolean().optional().default(false),
});

export type GenerateMockupInput = z.infer<typeof GenerateMockupInputSchema>;

export const SaveMockupInputSchema = z.object({
  kitId: z.string().uuid(),
  category: z.string().min(1).max(80),
  presetId: z.string().min(1).max(80),
  imageDataUrl: z.string().min(10), // data:image/png;base64,... or data:image/svg+xml,...
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export type SaveMockupInput = z.infer<typeof SaveMockupInputSchema>;

// ---------------------------------------------------------------------------
// Core Business Logic: executeGenerateBrandMockup
// ---------------------------------------------------------------------------

export async function executeGenerateBrandMockup(data: GenerateMockupInput) {
    // 1. Fetch kit and brand tokens from Drizzle
    const [kitRows, colorRows, fontRows, voiceRows, assetRows] = await Promise.all([
      db.select().from(brandKits).where(eq(brandKits.id, data.kitId)).limit(1),
      db.select().from(kitColors).where(eq(kitColors.kitId, data.kitId)),
      db.select().from(kitFonts).where(eq(kitFonts.kitId, data.kitId)),
      db.select().from(kitVoice).where(eq(kitVoice.kitId, data.kitId)).limit(1),
      db.select().from(kitAssets).where(eq(kitAssets.kitId, data.kitId)),
    ]);

    const kit = kitRows[0];
    if (!kit) throw new Error("Kit not found");

    // 2. Resolve colors
    const byRole = (role: string) =>
      colorRows.find((c) => String(c.role ?? "").toLowerCase() === role.toLowerCase());
    const primaryHex = cleanHexColor(
      byRole("primary")?.hex ?? colorRows[0]?.hex,
      data.variant === "dark" ? "#F4EFE6" : "#0A0A0A",
    );
    const secondaryHex = cleanHexColor(
      byRole("secondary")?.hex ?? colorRows[1]?.hex,
      data.variant === "dark" ? "#EDE8DE" : "#262626",
    );
    const bgHex = cleanHexColor(
      byRole("background")?.hex,
      data.variant === "dark" ? "#0A0A0A" : "#F4EFE6",
    );

    // 3. Resolve typography
    const headingFont =
      fontRows.find((f) => /heading|display/i.test(f.role ?? ""))?.family || "Cormorant Garamond";
    const monoFont =
      fontRows.find((f) => /mono|code/i.test(f.role ?? ""))?.family || "Courier Prime";

    // 4. Resolve logo asset
    const logoAsset =
      assetRows.find((a) => /logo/i.test(a.kind)) ??
      assetRows.find((a) => /favicon|mark/i.test(a.kind));
    const logoUrl = logoAsset?.storagePath
      ? publicUrlFor(logoAsset.storagePath)
      : (logoAsset?.url ?? null);

    const preset = MOCKUP_PRESETS[data.presetId] ?? MOCKUP_PRESETS["instagram-square"];
    const positioning = typeof kit.brandPositioning === "string" ? kit.brandPositioning : undefined;

    // 5. Build prompt
    const prompt = buildMockupPrompt({
      category: data.category,
      presetId: preset.id,
      presetName: preset.name,
      kitName: kit.name,
      primaryHex,
      secondaryHex,
      bgHex,
      headingFont,
      monoFont,
      positioning,
      headline: data.customHeadline,
      tagline: data.customTagline,
      cta: data.customCta,
      variant: data.variant,
    });

    // If client requested deterministic zero-credit compositor directly
    if (data.forceFallback) {
      return {
        ok: true,
        mode: "deterministic" as const,
        prompt,
        message: "Rendered via deterministic high-resolution compositor.",
      };
    }

    // 6. Check for Lovable AI Gateway Key
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      console.warn(
        "[mockups.server] LOVABLE_API_KEY is not configured; using deterministic fallback.",
      );
      return {
        ok: false,
        fallback: true,
        rateLimited: false,
        reason: "LOVABLE_API_KEY is not configured. Deterministic studio compositor is active.",
        prompt,
      };
    }

    // 7. Dispatch to Lovable AI Gateway Image Endpoint
    try {
      const messages: any[] = [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...(logoUrl && !logoUrl.startsWith("data:")
              ? [{ type: "image_url", image_url: { url: logoUrl } }]
              : []),
          ],
        },
      ];

      const res = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          modalities: ["image", "text"],
          messages,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        // Handle rate limiting (429) and quota exhaustion (402) gracefully
        if (res.status === 429) {
          console.warn("[mockups.server] AI Gateway 429 rate limit hit. Falling back.");
          return {
            ok: false,
            fallback: true,
            rateLimited: true,
            reason:
              "AI rate limit reached. Deterministic compositor is ready with zero credit consumption.",
            prompt,
          };
        }
        if (res.status === 402) {
          console.warn("[mockups.server] AI Gateway 402 credits exhausted. Falling back.");
          return {
            ok: false,
            fallback: true,
            rateLimited: false,
            reason: "AI credits exhausted. Switched to deterministic studio compositor.",
            prompt,
          };
        }
        throw new Error(`AI gateway responded with status ${res.status}: ${errText.slice(0, 160)}`);
      }

      const resJson: any = await res.json();
      const outputDataUrl: string | undefined =
        resJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (!outputDataUrl || !outputDataUrl.startsWith("data:")) {
        console.warn("[mockups.server] Gateway returned no valid data URL image payload.");
        return {
          ok: false,
          fallback: true,
          rateLimited: false,
          reason: "AI model generated no image payload. Switched to deterministic compositor.",
          prompt,
        };
      }

      // 8. Extract image buffer and upload to storage bucket 'brand-assets'
      const match = outputDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error("Invalid base64 image data payload from AI model");
      const contentType = match[1];
      const imageBuffer = new Uint8Array(Buffer.from(match[2], "base64"));
      const ext = contentType.includes("webp")
        ? "webp"
        : contentType.includes("png")
          ? "png"
          : "jpg";

      const storagePath = `${data.kitId}/mockups/${data.category}-${preset.id}-${Date.now().toString(36)}.${ext}`;

      let publicUrl = outputDataUrl;
      try {
        const uploaded = await uploadAsset(imageBuffer, storagePath, contentType);
        publicUrl = uploaded.url;
      } catch (storageErr: any) {
        console.warn("[mockups.server] S3/R2 storage upload skipped/failed:", storageErr?.message);
      }

      // 9. Persist into kit_assets table under kind: 'mockup'
      const existingMax = await db
        .select({ position: kitAssets.position })
        .from(kitAssets)
        .where(eq(kitAssets.kitId, data.kitId))
        .orderBy(desc(kitAssets.position))
        .limit(1);
      const nextPos = (existingMax[0]?.position ?? 0) + 1;

      const [insertedAsset] = await db
        .insert(kitAssets)
        .values({
          kitId: data.kitId,
          kind: "mockup",
          url: publicUrl,
          storagePath,
          width: preset.width,
          height: preset.height,
          position: nextPos,
        })
        .returning();

      return {
        ok: true,
        mode: "ai" as const,
        asset: insertedAsset,
        imageUrl: publicUrl,
        prompt,
      };
    } catch (e: any) {
      console.warn("[mockups.server] AI generation failed with error:", e?.message);
      return {
        ok: false,
        fallback: true,
        rateLimited:
          String(e?.message).includes("rate limit") || String(e?.message).includes("429"),
        reason:
          e?.message ?? "AI generation encountered a transient issue. Compositor fallback active.",
        prompt,
      };
    }
}

export const generateBrandMockupFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => GenerateMockupInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeGenerateBrandMockup(data);
  });

// ---------------------------------------------------------------------------
// Core Business Logic: executeSaveMockupAsset
// Saves client-composed deterministic mockups into kit_assets and storage.
// ---------------------------------------------------------------------------

export async function executeSaveMockupAsset(data: SaveMockupInput) {
    const kitRows = await db
      .select({ id: brandKits.id })
      .from(brandKits)
      .where(eq(brandKits.id, data.kitId))
      .limit(1);
    if (!kitRows.length) throw new Error("Kit not found");

    const match = data.imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid image data URL");
    const contentType = match[1];
    const buffer = new Uint8Array(Buffer.from(match[2], "base64"));
    const ext = contentType.includes("svg") ? "svg" : contentType.includes("webp") ? "webp" : "png";

    const storagePath = `${data.kitId}/mockups/${data.category}-${data.presetId}-${Date.now().toString(36)}.${ext}`;

    let publicUrl = data.imageDataUrl;
    try {
      const uploaded = await uploadAsset(buffer, storagePath, contentType);
      publicUrl = uploaded.url;
    } catch (storageErr: any) {
      console.warn("[mockups.server] S3/R2 storage upload error:", storageErr?.message);
    }

    const existingMax = await db
      .select({ position: kitAssets.position })
      .from(kitAssets)
      .where(eq(kitAssets.kitId, data.kitId))
      .orderBy(desc(kitAssets.position))
      .limit(1);
    const nextPos = (existingMax[0]?.position ?? 0) + 1;

    const [saved] = await db
      .insert(kitAssets)
      .values({
        kitId: data.kitId,
        kind: "mockup",
        url: publicUrl,
        storagePath,
        width: data.width ?? 1200,
        height: data.height ?? 800,
        position: nextPos,
      })
      .returning();

    return { ok: true, asset: saved };
}

export const saveMockupAssetFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => SaveMockupInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeSaveMockupAsset(data);
  });

// ---------------------------------------------------------------------------
// Core Business Logic: executeGetKitMockups
// ---------------------------------------------------------------------------

export async function executeGetKitMockups(data: { kitId: string }) {
    const rows = await db
      .select()
      .from(kitAssets)
      .where(and(eq(kitAssets.kitId, data.kitId), eq(kitAssets.kind, "mockup")))
      .orderBy(desc(kitAssets.createdAt));

    return {
      mockups: rows.map((r) => ({
        ...r,
        url: r.storagePath ? publicUrlFor(r.storagePath) : r.url,
      })),
    };
}

export const getKitMockupsFn = createServerFn({ method: "POST" })
  .validator(z.object({ kitId: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    return executeGetKitMockups(data);
  });

// ---------------------------------------------------------------------------
// Core Business Logic: executeDeleteKitMockup
// ---------------------------------------------------------------------------

export async function executeDeleteKitMockup(data: { kitId: string; assetId: string }) {
    const rows = await db
      .select()
      .from(kitAssets)
      .where(and(eq(kitAssets.id, data.assetId), eq(kitAssets.kitId, data.kitId)))
      .limit(1);
    const asset = rows[0];
    if (!asset) throw new Error("Mockup asset not found");

    if (asset.storagePath) {
      try {
        await deleteAsset(asset.storagePath);
      } catch (err: any) {
        console.warn("[mockups.server] S3/R2 delete warning:", err?.message);
      }
    }

    await db.delete(kitAssets).where(eq(kitAssets.id, data.assetId));
    return { ok: true };
}

export const deleteKitMockupFn = createServerFn({ method: "POST" })
  .validator(z.object({ kitId: z.string().uuid(), assetId: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    return executeDeleteKitMockup(data);
  });

