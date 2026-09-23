import { describe, expect, it } from "vitest";
import {
  GenerateCustomComponentInputSchema,
  executeGenerateCustomComponent,
} from "./components.server";

describe("AI Component Synthesis — Server Engine", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  it("validates input schemas for component generation", () => {
    const valid = GenerateCustomComponentInputSchema.safeParse({
      kitId: validUuid,
      prompt: "Create a minimalist testimonial carousel",
      themeMode: "light",
    });

    expect(valid.success).toBe(true);

    const invalidEmpty = GenerateCustomComponentInputSchema.safeParse({
      kitId: validUuid,
      prompt: "", // Empty prompt must fail
    });

    expect(invalidEmpty.success).toBe(false);

    const invalidUuid = GenerateCustomComponentInputSchema.safeParse({
      kitId: "not-a-valid-uuid",
      prompt: "Valid prompt string",
    });

    expect(invalidUuid.success).toBe(false);
  });

  it("synthesizes component with deterministic fallback when AI key is missing or simulated", async () => {
    const result = await executeGenerateCustomComponent({
      kitId: validUuid,
      prompt: "Generate a testimonial slider for this brand",
      themeMode: "light",
      kit: { id: validUuid, name: "Kyoto Ink Works" },
      colors: [
        { hex: "#0A0A0A", role: "primary" },
        { hex: "#F4EFE6", role: "background" },
        { hex: "#8B1A1A", role: "accent" },
      ],
      fonts: [
        { family: "Cormorant Garamond", role: "display" },
        { family: "Courier Prime", role: "mono" },
      ],
    });

    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
    expect(result.name).toBeTruthy();
    expect(result.description).toBeTruthy();
    expect(result.jsx).toContain("export function");
    expect(result.jsx).toContain("var(--brand-");
    expect(result.html).toContain("var(--brand-");
    expect(result.source).toBe("fallback");
  });

  it("handles checkout summary prompt gracefully with brand tokens", async () => {
    const result = await executeGenerateCustomComponent({
      kitId: validUuid,
      prompt: "Checkout order summary card with itemized list and tax",
      themeMode: "dark",
      kit: { id: validUuid, name: "Sumi Studio" },
      colors: [
        { hex: "#0A0A0A", role: "primary" },
        { hex: "#EDE8DE", role: "secondary" },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.name).toContain("Checkout");
    expect(result.jsx).toContain("CheckoutSummary");
    expect(result.jsx).toContain("var(--brand-");
  });
});
