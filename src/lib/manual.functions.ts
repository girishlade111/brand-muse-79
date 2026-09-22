import { createServerFn } from "@tanstack/react-start";
import {
  ScrapeSourceTextInputSchema,
  SaveManualKitInputSchema,
  scrapeSourceTextImpl,
  saveManualKitImpl,
} from "@/server/manual.server";

export const scrapeSourceText = createServerFn({ method: "POST" })
  .validator((data) => ScrapeSourceTextInputSchema.parse(data))
  .handler(async ({ data }) => scrapeSourceTextImpl(data));

export const saveManualKit = createServerFn({ method: "POST" })
  .validator((data) => SaveManualKitInputSchema.parse(data))
  .handler(async ({ data }) => saveManualKitImpl(data));
