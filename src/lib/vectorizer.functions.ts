import { createServerFn } from "@tanstack/react-start";
import {
  SaveVectorizedLogoInputSchema,
  VectorizeLogoServerInputSchema,
  executeSaveVectorizedLogo,
  executeVectorizeLogoServer,
} from "@/server/vectorizer.server";

export const saveVectorizedLogoFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => SaveVectorizedLogoInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeSaveVectorizedLogo(data);
  });

export const vectorizeLogoServerFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => VectorizeLogoServerInputSchema.parse(d))
  .handler(async ({ data }) => {
    return executeVectorizeLogoServer(data);
  });
