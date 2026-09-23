import { createServerFn } from "@tanstack/react-start";
import {
  GenerateMockupInputSchema,
  SaveMockupInputSchema,
  type GenerateMockupInput,
  type SaveMockupInput,
} from "@/lib/mockups";
import { z } from "zod";

export const generateBrandMockupFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => GenerateMockupInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { executeGenerateBrandMockup } = await import("@/server/mockups.server");
    return executeGenerateBrandMockup(data);
  });

export const saveMockupAssetFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => SaveMockupInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { executeSaveMockupAsset } = await import("@/server/mockups.server");
    return executeSaveMockupAsset(data);
  });

export const getKitMockupsFn = createServerFn({ method: "POST" })
  .validator(z.object({ kitId: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    const { executeGetKitMockups } = await import("@/server/mockups.server");
    return executeGetKitMockups(data);
  });

export const deleteKitMockupFn = createServerFn({ method: "POST" })
  .validator(z.object({ kitId: z.string().uuid(), assetId: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    const { executeDeleteKitMockup } = await import("@/server/mockups.server");
    return executeDeleteKitMockup(data);
  });
