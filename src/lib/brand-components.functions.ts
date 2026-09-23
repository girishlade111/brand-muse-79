import { createServerFn } from "@tanstack/react-start";
import {
  GenerateCustomComponentInputSchema,
  type CustomComponentResult,
  type GenerateCustomComponentInput,
} from "@/lib/brand-components";

export type { CustomComponentResult, GenerateCustomComponentInput };

export const generateCustomComponentFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => GenerateCustomComponentInputSchema.parse(d))
  .handler(async ({ data }): Promise<CustomComponentResult> => {
    const { executeGenerateCustomComponent } = await import("@/server/components.server");
    return executeGenerateCustomComponent(data);
  });
