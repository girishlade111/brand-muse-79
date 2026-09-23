import { createServerFn } from "@tanstack/react-start";
import { SaveVectorizedLogoInputSchema, VectorizeLogoServerInputSchema } from "@/lib/vectorizer";

export const saveVectorizedLogoFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => SaveVectorizedLogoInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { executeSaveVectorizedLogo } = await import("@/server/vectorizer.server");
    return executeSaveVectorizedLogo(data);
  });

export const vectorizeLogoServerFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => VectorizeLogoServerInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { executeVectorizeLogoServer } = await import("@/server/vectorizer.server");
    return executeVectorizeLogoServer(data);
  });
