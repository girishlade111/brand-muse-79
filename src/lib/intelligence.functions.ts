import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { MarketNiche, MarketWhitespaceAnalysis } from "@/server/ai.server";

export type { MarketNiche, MarketWhitespaceAnalysis };

export const AnalyzeMarketNicheInputSchema = z.object({
  kitIds: z.array(z.string().uuid()).min(2).max(4),
});

export type AnalyzeMarketNicheInput = z.infer<typeof AnalyzeMarketNicheInputSchema>;

// Client-callable server function for Market White-Space Discovery.
// Compares 2-4 kits and returns saturated bands, open territory, GTM vectors.
export const analyzeMarketNiche = createServerFn({ method: "POST" })
  .validator((data) => AnalyzeMarketNicheInputSchema.parse(data))
  .handler(async ({ data }): Promise<MarketNiche> => {
    const { analyzeMarketNicheServerFn } = await import("@/server/ai.server");
    return analyzeMarketNicheServerFn({ kitIds: data.kitIds });
  });

export const AnalyzeMarketWhitespaceInputSchema = z.object({
  kitIds: z.array(z.string().uuid()).min(2).max(4),
});

export type AnalyzeMarketWhitespaceInput = z.infer<typeof AnalyzeMarketWhitespaceInputSchema>;

// Client-callable server function for Strategic Multi-Brand White-Space Discovery
export const analyzeMarketWhitespace = createServerFn({ method: "POST" })
  .validator((data) => AnalyzeMarketWhitespaceInputSchema.parse(data))
  .handler(async ({ data }): Promise<MarketWhitespaceAnalysis> => {
    const { analyzeMarketWhitespaceFn } = await import("@/server/ai.server");
    return analyzeMarketWhitespaceFn({ kitIds: data.kitIds });
  });
