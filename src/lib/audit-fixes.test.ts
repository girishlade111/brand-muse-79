import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb, isValidHex, normalizeHex } from "./color";
import { slug } from "./exports";
import { isHttpUrl } from "./utils";
import { mapKitToSpecimen } from "./specimens";

describe("audit fixes", () => {
  it("hexToRgb rejects invalid input instead of NaN", () => {
    expect(hexToRgb("zzzz")).toEqual([0, 0, 0]);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("##fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#123456")).toEqual([0x12, 0x34, 0x56]);
  });

  it("normalizeHex validates and falls back safely", () => {
    expect(normalizeHex("#fff")).toBe("#ffffff");
    expect(normalizeHex("##fff")).toBe("#ffffff");
    expect(normalizeHex("nope")).toBe("#000000");
    expect(normalizeHex("#123456")).toBe("#123456");
  });

  it("isValidHex accepts 3/6 digit hex", () => {
    expect(isValidHex("#fff")).toBe(true);
    expect(isValidHex("#123456")).toBe(true);
    expect(isValidHex("nope")).toBe(false);
  });

  it("contrastRatio stays finite on bad input", () => {
    const r = contrastRatio("zzzz", "#ffffff");
    expect(Number.isFinite(r)).toBe(true);
  });

  it("slug never returns empty and strips edge dashes", () => {
    expect(slug("---a---")).toBe("a");
    expect(slug("!!!")).toBe("kit");
    expect(slug("")).toBe("kit");
    expect(slug("Primary Color")).toBe("primary-color");
  });

  it("isHttpUrl blocks javascript:/data: URLs", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com/x")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html,hi")).toBe(false);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
  });

  it("mapKitToSpecimen handles 3-digit hex and bad URLs", () => {
    const s = mapKitToSpecimen(
      {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test",
        source_url: "javascript:alert(1)",
        created_at: new Date().toISOString(),
        kit_colors: [{ hex: "#fff", position: 0 }],
        kit_fonts: [],
        kit_voice: null,
      },
      0,
    );
    expect(s.hex[0]).toBe("FFFFFF");
    expect(s.name).toBe("Test");
    expect(s.tld).toBe("");
  });
});
