// Server-side Component Synthesis Engine — TanStack Start server function.
// Uses Lovable AI Gateway to synthesize production-ready React 19 JSX + Tailwind v4
// adhering to kit CSS variables (--brand-*) and WCAG AA contrast.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, brandKits, kitColors, kitFonts, kitVoice } from "@/db/index.server";
import { callAIStructured } from "@/server/ai.server";
import {
  DETERMINISTIC_AI_COMPONENTS,
  resolveBrandComponentTheme,
  type ComponentThemeMode,
} from "@/lib/brand-components";

export const GenerateCustomComponentInputSchema = z.object({
  kitId: z.string().uuid(),
  prompt: z.string().min(2).max(400),
  themeMode: z.enum(["light", "dark", "high-contrast"]).default("light"),
});

export type GenerateCustomComponentInput = z.infer<typeof GenerateCustomComponentInputSchema>;

export type CustomComponentResult = {
  ok: boolean;
  name: string;
  description: string;
  jsx: string;
  html: string;
  source: "ai" | "fallback";
  message?: string;
};

export type ExecuteCustomComponentOptions = {
  kitId: string;
  prompt: string;
  themeMode?: "light" | "dark" | "high-contrast";
  kit?: { id: string; name: string };
  colors?: Array<{ hex: string; role?: string | null; name?: string | null }>;
  fonts?: Array<{ family?: string | null; role?: string | null }>;
};

export async function executeGenerateCustomComponent({
  kitId,
  prompt,
  themeMode = "light",
  kit: kitOverride,
  colors: colorsOverride,
  fonts: fontsOverride,
}: ExecuteCustomComponentOptions): Promise<CustomComponentResult> {
  let kit = kitOverride;
  let colors = colorsOverride;
  let fonts = fontsOverride;

  if (!kit) {
    const [kitRows, colorRows, fontRows] = await Promise.all([
      db.select().from(brandKits).where(eq(brandKits.id, kitId)).limit(1),
      db.select().from(kitColors).where(eq(kitColors.kitId, kitId)),
      db.select().from(kitFonts).where(eq(kitFonts.kitId, kitId)),
    ]);
    kit = kitRows[0];
    colors = colors ?? colorRows;
    fonts = fonts ?? fontRows;
  }

  if (!kit) throw new Error("Kit not found");

  const theme = resolveBrandComponentTheme(
    colors ?? [],
    fonts ?? [],
    themeMode as ComponentThemeMode,
    kit.name,
  );

  // Identify deterministic fallback match in case of network or rate-limit issues
  const promptLower = prompt.toLowerCase();
  const fallbackTemplate =
    promptLower.includes("checkout") ||
    promptLower.includes("pricing") ||
    promptLower.includes("cart") ||
    promptLower.includes("order") ||
    promptLower.includes("summary")
      ? DETERMINISTIC_AI_COMPONENTS.checkout
      : DETERMINISTIC_AI_COMPONENTS.testimonial;

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return {
      ok: true,
      name: fallbackTemplate.name,
      description: `${fallbackTemplate.description} (Deterministic template)`,
      jsx: fallbackTemplate.jsx,
      html: fallbackTemplate.html,
      source: "fallback",
      message: "Generated via deterministic accessible template (AI key unconfigured).",
    };
  }

  const systemPrompt = [
    `You are a Senior Design Systems Engineer and Tailwind CSS v4 specialist.`,
    `Brand Name: "${kit.name}".`,
    `Design Philosophy: "The Invisible Instrument" — 0px border-radius everywhere, high contrast, tactile editorial standard.`,
    `CSS Custom Properties available in scope:`,
    `--brand-primary, --brand-primary-fg, --brand-secondary, --brand-secondary-fg, --brand-bg, --brand-surface, --brand-text, --brand-muted, --brand-muted-fg, --brand-accent, --brand-border, --brand-border-subtle, --brand-ring, --brand-font-display, --brand-font-body, --brand-font-mono.`,
    `CRITICAL RULES:`,
    `1. DO NOT use hardcoded hex colors. Use the CSS variables via Tailwind arbitrary values: e.g. bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] border-[var(--brand-border)].`,
    `2. Strictly adhere to 0px border-radius: style={{ borderRadius: 0 }}.`,
    `3. Ensure WCAG AA contrast for text elements against their background.`,
    `4. Provide production-ready, fully accessible React 19 JSX and a pure HTML snippet.`,
  ].join("\n");

  const userPrompt = `Build an accessible, high-contrast UI component for: "${prompt}"`;

  try {
    const result = await callAIStructured<{
      name: string;
      description: string;
      jsx: string;
      html: string;
    }>({
      system: systemPrompt,
      user: userPrompt,
      toolName: "save_custom_component",
      toolDescription:
        "Return structured React 19 JSX and HTML snippets styled with brand CSS variables.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Clean component title" },
          description: { type: "string", description: "Design description" },
          jsx: { type: "string", description: "Production-ready React JSX snippet" },
          html: { type: "string", description: "Semantic HTML5 snippet" },
        },
        required: ["name", "description", "jsx", "html"],
      },
    });

    if (!result?.jsx) {
      throw new Error("Model generated empty component markup");
    }

    return {
      ok: true,
      name: result.name,
      description: result.description,
      jsx: result.jsx,
      html: result.html,
      source: "ai",
    };
  } catch (err: any) {
    console.warn(
      "[components.server] AI synthesis failed or rate-limited; engaging fallback:",
      err?.message,
    );
    return {
      ok: true,
      name: fallbackTemplate.name,
      description: `${fallbackTemplate.description} (Fallback: ${err?.message?.slice(0, 60) || "Rate-limited"})`,
      jsx: fallbackTemplate.jsx,
      html: fallbackTemplate.html,
      source: "fallback",
      message: "AI gateway rate-limited or unavailable. Deterministic accessible template served.",
    };
  }
}

export const generateCustomComponentFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => GenerateCustomComponentInputSchema.parse(d))
  .handler(async ({ data }): Promise<CustomComponentResult> => {
    return executeGenerateCustomComponent(data);
  });
