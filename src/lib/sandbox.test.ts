import { describe, expect, it } from "vitest";
import { resolveSandboxTheme, sandboxCode, type SandboxComponentId } from "./sandbox";

const THEME = resolveSandboxTheme(
  "Acme",
  [
    { hex: "#0A0A0A", role: "primary" },
    { hex: "#F4EFE6", role: "background" },
    { hex: "#8B1A1A", role: "accent" },
  ],
  [{ family: "Inter", role: "heading" }],
);

const IDS: SandboxComponentId[] = ["buttons", "form", "pricing", "metric", "feature", "nav"];

describe("sandbox codegen", () => {
  it("resolves a complete theme", () => {
    expect(THEME.brand).toBe("Acme");
    expect(THEME.accent).toBe("#8B1A1A");
    expect(THEME.displayFont).toBe("Inter");
  });

  it("emits non-empty snippets for every target x component", () => {
    for (const id of IDS) {
      for (const target of ["html", "react", "svelte"] as const) {
        const code = sandboxCode(target, id, THEME);
        expect(code.length).toBeGreaterThan(40);
        expect(code).toContain("#8B1A1A");
        if (target === "react") expect(code).toContain("style={{");
        if (target === "svelte") expect(code).toContain(".svelte");
      }
    }
  });

  it("is deterministic", () => {
    expect(sandboxCode("react", "pricing", THEME)).toBe(sandboxCode("react", "pricing", THEME));
  });
});
