// REST Token Synchronization Endpoint & Server Functions for Figma Plugin Bridge.
// Validates access via shareToken or public status, and returns a structured payload
// containing W3C DTCG tokens, Figma Local Variables, Typography Text Styles, and Vector Logos.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, brandKits, kitColors, kitFonts, kitTokens, kitAssets } from "@/db/index.server";
import {
  buildDtcgTokensPayload,
  buildFigmaVariablesPayload,
  computeTokenHash,
  type FigmaSyncResponsePayload,
} from "@/lib/figma-tokens";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const FigmaSyncInputSchema = z.object({
  kitId: z.string().uuid(),
  token: z.string().optional(),
});

export type FigmaSyncInput = z.infer<typeof FigmaSyncInputSchema>;

// ---------------------------------------------------------------------------
// Pure Handlers (Directly Testable)
// ---------------------------------------------------------------------------

export async function executeGetFigmaTokens(
  data: FigmaSyncInput,
  overrides?: {
    kit?: any;
    colors?: any[];
    fonts?: any[];
    tokens?: any[];
    assets?: any[];
  },
): Promise<FigmaSyncResponsePayload> {
  let kit = overrides?.kit;
  let colors = overrides?.colors;
  let fonts = overrides?.fonts;
  let tokens = overrides?.tokens;
  let assets = overrides?.assets;

  if (!kit) {
    const kitRows = await db.select().from(brandKits).where(eq(brandKits.id, data.kitId)).limit(1);

    kit = kitRows[0];
  }

  if (!kit) {
    throw new Error("Brand kit not found");
  }

  // Security check: Access is permitted if kit is public OR token matches shareToken
  const isPublic = !!kit.isPublic;
  const matchesShareToken = Boolean(kit.shareToken && data.token && kit.shareToken === data.token);

  if (!isPublic && !matchesShareToken) {
    throw new Error(
      "Unauthorized: This Brand Kit is private. Please provide a valid Sync Access Token (shareToken).",
    );
  }

  // Fetch children if not passed as overrides
  if (!colors || !fonts || !tokens || !assets) {
    const [colorRows, fontRows, tokenRows, assetRows] = await Promise.all([
      colors
        ? Promise.resolve(colors)
        : db.select().from(kitColors).where(eq(kitColors.kitId, data.kitId)),
      fonts
        ? Promise.resolve(fonts)
        : db.select().from(kitFonts).where(eq(kitFonts.kitId, data.kitId)),
      tokens
        ? Promise.resolve(tokens)
        : db.select().from(kitTokens).where(eq(kitTokens.kitId, data.kitId)),
      assets
        ? Promise.resolve(assets)
        : db.select().from(kitAssets).where(eq(kitAssets.kitId, data.kitId)),
    ]);

    colors = colorRows;
    fonts = fontRows;
    tokens = tokenRows;
    assets = assetRows;
  }

  const dtcg = buildDtcgTokensPayload({
    colors: colors ?? [],
    fonts: fonts ?? [],
    tokens: tokens ?? [],
  });

  const figmaVariables = buildFigmaVariablesPayload({
    kitName: kit.name || "Brand Muse",
    colors: colors ?? [],
    fonts: fonts ?? [],
    tokens: tokens ?? [],
    assets: assets ?? [],
  });

  const hash = computeTokenHash({
    kitName: kit.name || "Brand Muse",
    colors: colors ?? [],
    tokens: tokens ?? [],
    fonts: fonts ?? [],
  });

  const updatedAt = kit.updatedAt
    ? new Date(kit.updatedAt).toISOString()
    : new Date().toISOString();

  return {
    version: "1.0.0",
    kitId: kit.id,
    kitName: kit.name,
    updatedAt,
    hash,
    dtcg,
    figmaVariables,
  };
}

// ---------------------------------------------------------------------------
// Web Standard Request / Response Handler for REST Endpoints
// ---------------------------------------------------------------------------

export async function handleFigmaTokensApiRequest(
  request: Request,
  kitId: string,
): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const token =
      url.searchParams.get("token") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      undefined;

    const parsed = FigmaSyncInputSchema.safeParse({ kitId, token });
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request parameters",
          details: parsed.error.issues,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const payload = await executeGetFigmaTokens(parsed.data);

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=60",
        ETag: `"${payload.hash}"`,
        ...corsHeaders,
      },
    });
  } catch (err: any) {
    const isUnauthorized = String(err?.message || "").includes("Unauthorized");
    const status = isUnauthorized ? 401 : 404;

    return new Response(
      JSON.stringify({
        error: err?.message || "Failed to synchronize brand tokens",
      }),
      {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
}

// ---------------------------------------------------------------------------
// TanStack Start Server Function
// ---------------------------------------------------------------------------

export const getFigmaTokensFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => FigmaSyncInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeGetFigmaTokens(data);
  });
