import { describe, expect, it } from "vitest";
import {
  GenerateCustomComponentInputSchema,
  generateCustomComponentFn,
} from "./components.server";

describe("AI Component Synthesis — Server Engine", () => {
  it("validates input schemas for component generation", () => {
    const valid = GenerateCustomComponentInputSchema.safeParse({
      kitId: "test-kit-123",
      kitName: "Kyoto Ink Works",
      prompt: "Create a minimalist testimonial carousel",
      mode: "light",
      colors: [{ hex: "#0A0A0A", role: "primary" }],
      fonts: [{ family: "Cormorant Garamond", role: "display" }],
    });

    expect(valid.success).toBe(true);

    const invalid = GenerateCustomComponentInputSchema.safeParse({
      kitId: "test-kit-123",
      kitName: "Kyoto Ink Works",
      prompt: "", // Empty prompt must fail
    });

    expect(invalid.success).toBe(false);
  });

  it("synthesizes component with deterministic fallback when AI key is missing or simulated", async () => {
    const result = await generateCustomComponentFn({
      data: {
        kitId: "test-kit-123",
        kitName: "Kyoto Ink Works",
        prompt: "Generate a testimonial slider for this brand",
        mode: "light",
        colors: [
          { hex: "#0A0A0A", role: "primary" },
          { hex: "#F4EFE6", role: "background" },
          { hex: "#8B1A1A", role: "accent" },
        ],
        fonts: [
          { family: "Cormorant Garamond", role: "display" },
          { family: "Courier Prime", role: "mono" },
        ],
      },
    });

    expect(result).toBeDefined();
    expect(result.componentName).toBeTruthy();
    expect(result.description).toBeTruthy();
    expect(result.reactCode).toContain("export function");
    expect(result.reactCode).toContain("var(--brand-");
    expect(result.htmlCode).toContain("var(--brand-");
    expect(result.tokensUsed.length).toBeGreaterThan(0);
    expect(result.wcagCompliance).toContain("WCAG");
  });

  it("handles checkout summary prompt gracefully with brand tokens", async () => {
    const result = await generateCustomComponentFn({
      data: {
        kitId: "test-kit-456",
        kitName: "Sumi Studio",
        prompt: "Checkout order summary card with itemized list and tax",
        mode: "dark",
        colors: [
          { hex: "#0A0A0A", role: "primary" },
          { hex: "#EDE8DE", role: "secondary" },
        ],
      },
    });

    expect(result.componentName).toBe("CheckoutSummary");
    expect(result.reactCode).toContain("CheckoutSummary");
    expect(result.reactCode).toContain("var(--brand-");
  });
});
