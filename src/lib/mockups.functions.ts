import { createServerFn } from "@tanstack/react-start";
import {
  GenerateMockupInputSchema,
  SaveMockupInputSchema,
  executeGenerateBrandMockup,
  executeSaveMockupAsset,
  executeGetKitMockups,
  executeDeleteKitMockup,
  type GenerateMockupInput,
  type SaveMockupInput,
} from "@/server/mockups.server";
import { z } from "zod";

export const generateBrandMockupFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => GenerateMockupInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeGenerateBrandMockup(data);
  });

export const saveMockupAssetFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => SaveMockupInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeSaveMockupAsset(data);
  });

export const getKitMockupsFn = createServerFn({ method: "POST" })
  .validator(z.object({ kitId: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    return executeGetKitMockups(data);
  });

export const deleteKitMockupFn = createServerFn({ method: "POST" })
  .validator(z.object({ kitId: z.string().uuid(), assetId: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    return executeDeleteKitMockup(data);
  });
