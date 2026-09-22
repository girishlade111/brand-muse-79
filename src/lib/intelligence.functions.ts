import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { analyzeMarketNicheServerFn, type MarketNiche } from "@/server/ai.server";

export const AnalyzeMarketNicheInputSchema = z.object({
  kitIds: z.array(z.string().uuid()).min(2).max(4),
});

export type AnalyzeMarketNicheInput = z.infer<typeof AnalyzeMarketNicheInputSchema>;

// Client-callable server function for Market White-Space Discovery.
// Compares 2-4 kits and returns saturated bands, open territory, GTM vectors.
export const analyzeMarketNiche = createServerFn({ method: "POST" })
  .validator((data) => AnalyzeMarketNicheInputSchema.parse(data))
  .handler(async ({ data }): Promise<MarketNiche> => {
    return analyzeMarketNicheServerFn({ kitIds: data.kitIds });
  });
