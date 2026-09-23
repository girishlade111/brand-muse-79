import { createServerFn } from "@tanstack/react-start";
import {
  GenerateCustomComponentInputSchema,
  executeGenerateCustomComponent,
  type CustomComponentResult,
  type GenerateCustomComponentInput,
} from "@/server/components.server";

export type { CustomComponentResult, GenerateCustomComponentInput };

export const generateCustomComponentFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => GenerateCustomComponentInputSchema.parse(d))
  .handler(async ({ data }): Promise<CustomComponentResult> => {
    return executeGenerateCustomComponent(data);
  });
