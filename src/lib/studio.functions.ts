import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateBrandCopyServerFn } from "@/server/ai.server";

export const GenerateBrandCopyServerInputSchema = z.object({
  kitId: z.string().uuid(),
  assetType: z.enum([
    "linkedin-banner",
    "twitter-header",
    "instagram-post",
    "og-card",
    "deck-cover",
  ]),
  topic: z.string().max(300).optional().default(""),
});

export type GenerateBrandCopyServerInput = z.infer<typeof GenerateBrandCopyServerInputSchema>;

export type BrandCopyResult = {
  headlines: string[];
  valueProps: string[];
  ctas: string[];
  caption: string;
};

// Client-callable server function for the Generative Marketing Studio.
// Feeds kit_voice + brand_positioning to the LLM via generateBrandCopyServerFn.
export const generateBrandCopy = createServerFn({ method: "POST" })
  .validator((data) => GenerateBrandCopyServerInputSchema.parse(data))
  .handler(async ({ data }): Promise<BrandCopyResult> => {
    return generateBrandCopyServerFn({
      kitId: data.kitId,
      assetType: data.assetType,
      topic: data.topic ?? "",
    });
  });
