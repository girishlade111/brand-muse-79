import { describe, expect, it } from "vitest";
import { autoFixContrast, contrastRatio, hexToHsl, hslToHex } from "./color";
import {
  analyzeKitColors,
  analyzeKitType,
  analyzeKitVoice,
  analyzeWhiteSpace,
  buildComparisonMatrix,
  classifyFontFamily,
  cvdBreakageReport,
  cvdPairBreaks,
  hueBucket,
  simulateCvd,
  temperatureOf,
} from "./intelligence";

describe("contrast auto-fixer", () => {
  it("round-trips hex through HSL", () => {
    for (const hex of ["#0A0A0A", "#F4EFE6", "#8B1A1A", "#2563EB", "#1F4D2E"]) {
      const { h, s, l } = hexToHsl(hex);
      expect(hslToHex(h, s, l).toUpperCase()).toBe(hex);
    }
  });

  it("fixes a failing pair to AA without shifting hue", () => {
    const fix = autoFixContrast("#8B8B8B", "#F4EFE6");
    expect(fix).not.toBeNull();
    expect(fix!.ratio).toBeGreaterThanOrEqual(4.5);
    expect(fix!.direction === "darken" || fix!.direction === "lighten").toBe(true);
    expect(fix!.hueDrift).toBeLessThan(6);
    // Hue preserved: same HSL hue family as the source gray is achromatic,
    // so check a chromatic case too.
    const red = autoFixContrast("#E57373", "#FFFFFF");
    expect(red).not.toBeNull();
    expect(red!.ratio).toBeGreaterThanOrEqual(4.5);
    expect(red!.hueDrift).toBeLessThan(6);
    const before = hexToHsl("#E57373").h;
    const after = hexToHsl(red!.hex).h;
    const drift = Math.abs(before - after);
    expect(Math.min(drift, 360 - drift)).toBeLessThan(6);
  });

  it("returns the original hex when already compliant", () => {
    const fix = autoFixContrast("#0A0A0A", "#FFFFFF");
    expect(fix?.direction).toBe("none");
    expect(fix?.deltaL).toBe(0);
    expect(fix?.hex).toBe("#0a0a0a");
  });

  it("reaches AAA on demand", () => {
    const fix = autoFixContrast("#767676", "#FFFFFF", { level: "AAA" });
    expect(fix).not.toBeNull();
    expect(fix!.ratio).toBeGreaterThanOrEqual(7);
  });

  it("can adjust the background side instead", () => {
    const fix = autoFixContrast("#FFFFFF", "#9AA0A6", { adjust: "background" });
    expect(fix).not.toBeNull();
    expect(contrastRatio("#FFFFFF", fix!.hex)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("color psychology", () => {
  it("classifies temperature", () => {
    expect(temperatureOf("#C0392B")).toBe("warm");
    expect(temperatureOf("#D9A404")).toBe("warm");
    expect(temperatureOf("#1E3A8A")).toBe("cool");
    expect(temperatureOf("#1F4D2E")).toBe("cool");
    expect(temperatureOf("#8A8A8A")).toBe("neutral");
    expect(temperatureOf("#0A0A0A")).toBe("neutral");
  });

  it("buckets hues deterministically", () => {
    expect(hueBucket(0)).toBe(0);
    expect(hueBucket(360)).toBe(0);
    expect(hueBucket(224)).toBe(9);
  });

  it("profiles a kit palette", () => {
    const p = analyzeKitColors([
      { hex: "#C0392B" },
      { hex: "#E67E22" },
      { hex: "#0A0A0A" },
      { hex: "#F4EFE6" },
    ]);
    expect(p.count).toBe(4);
    // Washi paper (#F4EFE6) is warm-tinted, so 3 of 4 read warm.
    expect(p.warmRatio).toBeCloseTo(0.75, 5);
    expect(p.temperature).toBe("warm");
    expect(p.vibrancy).toBeGreaterThanOrEqual(0);
    expect(p.vibrancy).toBeLessThanOrEqual(100);
    expect(p.dominantBuckets.length).toBeGreaterThan(0);
  });
});

describe("typography DNA", () => {
  it("classifies families", () => {
    expect(classifyFontFamily("Cormorant Garamond")).toBe("serif");
    expect(classifyFontFamily("Courier Prime")).toBe("monospace");
    expect(classifyFontFamily("Inter")).toBe("sans-serif");
  });

  it("profiles shares and weights", () => {
    const t = analyzeKitType([
      { family: "Inter", weights: ["400", "700"] },
      { family: "Courier Prime", weights: ["400"] },
    ]);
    expect(t.sans).toBeCloseTo(0.5, 5);
    expect(t.mono).toBeCloseTo(0.5, 5);
    expect(t.weightCount).toBe(2);
    expect(t.weights).toEqual([400, 700]);
  });
});

describe("voice spectrum", () => {
  it("scores formal vs casual within bounds", () => {
    const formal = analyzeKitVoice({ tone: [{ label: "formal" }, { label: "authoritative" }] });
    expect(formal.formalCasual).toBeGreaterThan(0.4);
    expect(formal.formalLabel).toBe("Formal");
    const casual = analyzeKitVoice({ tone: [{ label: "playful" }, { label: "friendly" }] });
    expect(casual.formalCasual).toBeLessThan(-0.4);
    expect(casual.formalLabel).toBe("Casual");
    const empty = analyzeKitVoice(null);
    expect(empty).toMatchObject({
      formalCasual: 0,
      technicalConversational: 0,
      minimalExpressive: 0,
    });
  });
});

describe("comparison matrix", () => {
  it("emits normalized radar series for N kits", () => {
    const m = buildComparisonMatrix([
      { id: "a", name: "A", colors: [{ hex: "#C0392B" }], fonts: [], voice: null },
      { id: "b", name: "B", colors: [{ hex: "#1E3A8A" }], fonts: [], voice: null },
      { id: "c", name: "C", colors: [{ hex: "#1F4D2E" }], fonts: [], voice: null },
    ]);
    expect(m.axes).toHaveLength(6);
    expect(m.series).toHaveLength(3);
    for (const s of m.series) {
      expect(s.values).toHaveLength(6);
      for (const v of s.values) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("white-space discovery", () => {
  const blueCohort = [
    {
      id: "a",
      name: "A",
      colors: [{ hex: "#1E3A8A" }, { hex: "#F4EFE6" }],
      fonts: [],
      voice: null,
    },
    {
      id: "b",
      name: "B",
      colors: [{ hex: "#2563EB" }, { hex: "#0A0A0A" }],
      fonts: [],
      voice: null,
    },
    {
      id: "c",
      name: "C",
      colors: [{ hex: "#1D4ED8" }, { hex: "#FFFFFF" }],
      fonts: [],
      voice: null,
    },
  ];
  it("flags saturated bands and open territory", () => {
    const r = analyzeWhiteSpace(blueCohort);
    expect(r.saturatedBands.length).toBeGreaterThanOrEqual(1);
    expect(r.saturatedBands[0].kitShare).toBeGreaterThanOrEqual(0.5);
    const open = r.openTerritory.map((t) => t.band);
    expect(open).toContain("Ochre");
    expect(open).toContain("Forest");
    expect(r.vectors.length).toBeGreaterThan(0);
    expect(r.temperatureNote.length).toBeGreaterThan(0);
  });
});

describe("CVD simulation", () => {
  it("maps pure red deterministically", () => {
    expect(simulateCvd("#FF0000", "protanopia")).toBe("#918E00");
    expect(simulateCvd("#FF0000", "achromatopsia")).toBe("#4C4C4C");
    expect(simulateCvd("#FFFFFF", "achromatopsia")).toBe("#FFFFFF");
  });

  it("reports structural invariants on breakage", () => {
    const colors = [
      { hex: "#0A0A0A" },
      { hex: "#F4EFE6" },
      { hex: "#C0392B" },
      { hex: "#1E3A8A" },
      { hex: "#1F4D2E" },
      { hex: "#D9A404" },
    ];
    const report = cvdBreakageReport(colors);
    expect(report).toHaveLength(4);
    for (const r of report) {
      expect(r.severity).toBeGreaterThanOrEqual(0);
      expect(r.severity).toBeLessThanOrEqual(1);
      for (const b of r.brokenPairs) {
        expect(b.normalRatio).toBeGreaterThanOrEqual(3);
        expect(b.simRatio).toBeLessThan(3);
      }
    }
    expect(cvdPairBreaks([{ hex: "#0A0A0A" }], "protanopia")).toEqual([]);
  });
});
