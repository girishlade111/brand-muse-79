import { describe, expect, it } from "vitest";
import {
  extractContourLoops,
  fitBezierPath,
  generateBrandPrimarySvg,
  generateMonochromeDarkSvg,
  generateMonochromeLightSvg,
  rgbToHex,
  sampleBackgroundColor,
  simplifyPolygon,
  vectorizeRaster,
} from "./vectorizer";
import { jsDenoiseMask, jsStripBackground } from "./vectorizer-wasm";

describe("Logo Vectorizer & Cleaner Studio — Engine & WASM Pipeline", () => {
  it("converts RGB values to uppercase HEX string", () => {
    expect(rgbToHex(10, 10, 10)).toBe("#0A0A0A");
    expect(rgbToHex(244, 239, 230)).toBe("#F4EFE6");
    expect(rgbToHex(139, 26, 26)).toBe("#8B1A1A");
  });

  describe("Background Sampling & WASM Thresholding", () => {
    it("accurately samples corner pixels to identify background color", () => {
      const width = 4;
      const height = 4;
      const data = new Uint8Array(width * height * 4);

      // Fill with solid white
      data.fill(255);

      const bg = sampleBackgroundColor(data, width, height);
      expect(bg).toEqual({ r: 255, g: 255, b: 255 });
    });

    it("strips background pixels based on color distance tolerance", () => {
      const width = 2;
      const height = 2;
      const data = new Uint8Array(width * height * 4);

      // Pixel 0: pure white background (255, 255, 255, 255)
      data[0] = 255;
      data[1] = 255;
      data[2] = 255;
      data[3] = 255;

      // Pixel 1: off-white background (250, 250, 250, 255)
      data[4] = 250;
      data[5] = 250;
      data[6] = 250;
      data[7] = 255;

      // Pixel 2: dark ink foreground (10, 10, 10, 255)
      data[8] = 10;
      data[9] = 10;
      data[10] = 10;
      data[11] = 255;

      // Pixel 3: red accent foreground (139, 26, 26, 255)
      data[12] = 139;
      data[13] = 26;
      data[14] = 26;
      data[15] = 255;

      jsStripBackground(data, width, height, 255, 255, 255, 0.1);

      // White and off-white should have alpha keyed to 0
      expect(data[3]).toBe(0);
      expect(data[7]).toBe(0);

      // Foreground pixels must remain opaque
      expect(data[11]).toBe(255);
      expect(data[15]).toBe(255);
    });

    it("denoises mask by removing isolated single-pixel specks", () => {
      const width = 5;
      const height = 5;
      const mask = new Uint8Array(width * height);

      // Put an isolated speckle at (2, 2)
      mask[2 * width + 2] = 1;

      const clean = jsDenoiseMask(mask, width, height);

      // Isolated speckle should be eradicated
      expect(clean[2 * width + 2]).toBe(0);
    });
  });

  describe("Contour Tracing & Polygon Simplification", () => {
    it("simplifies collinear points in a polygon using Douglas-Peucker", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 }, // collinear point
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 0 },
      ];

      const simplified = simplifyPolygon(points, 0.5);

      // Collinear point (5, 0) should be eliminated
      expect(simplified.length).toBeLessThan(points.length);
      expect(simplified).toContainEqual({ x: 0, y: 0 });
      expect(simplified).toContainEqual({ x: 10, y: 0 });
      expect(simplified).toContainEqual({ x: 10, y: 10 });
    });

    it("fits smooth cubic Bézier curves through polygon vertices", () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      // Smoothness 0 -> straight lines
      const sharpPath = fitBezierPath(points, 0);
      expect(sharpPath).toContain("L 10.00 0.00");
      expect(sharpPath).toContain("Z");

      // Smoothness 80 -> cubic Bézier curve commands
      const smoothPath = fitBezierPath(points, 80);
      expect(smoothPath).toContain("C ");
      expect(smoothPath).toContain("Z");
    });
  });

  describe("End-to-End Vectorization Pipeline", () => {
    // Generate a 16x16 test image with a high-contrast square logo mark
    function createTestRaster(): { data: Uint8Array; width: number; height: number } {
      const width = 16;
      const height = 16;
      const data = new Uint8Array(width * height * 4);

      // Background: white
      data.fill(255);

      // Foreground: 8x8 black square in the middle
      for (let y = 4; y < 12; y++) {
        for (let x = 4; x < 12; x++) {
          const idx = (y * width + x) * 4;
          data[idx] = 10;
          data[idx + 1] = 10;
          data[idx + 2] = 10;
          data[idx + 3] = 255;
        }
      }

      return { data, width, height };
    }

    it("vectorizes raster pixels into scalable SVG output with metrics", () => {
      const { data, width, height } = createTestRaster();

      const result = vectorizeRaster(data, width, height, {
        colorCount: 1,
        curveSmoothness: 70,
        pathPrecision: 80,
        bgTolerance: 15,
        stripBg: true,
        primaryBrandHex: "#8B1A1A",
      });

      expect(result).toBeDefined();
      expect(result.width).toBe(width);
      expect(result.height).toBe(height);
      expect(result.pathCount).toBeGreaterThan(0);
      expect(result.svg).toContain("<svg");
      expect(result.svg).toContain(`viewBox="0 0 ${width} ${height}"`);
      expect(result.svg).toContain("<path");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("generates the 3 mandatory production variants", () => {
      const { data, width, height } = createTestRaster();

      const result = vectorizeRaster(data, width, height, {
        primaryBrandHex: "#8B1A1A",
      });

      // Monochrome Dark
      expect(result.monochromeDarkSvg).toContain('fill="#0A0A0A"');
      expect(result.monochromeDarkSvg).toContain("<svg");

      // Monochrome Light
      expect(result.monochromeLightSvg).toContain('fill="#F4EFE6"');
      expect(result.monochromeLightSvg).toContain("<svg");

      // Brand Primary
      expect(result.brandPrimarySvg).toContain('fill="#8B1A1A"');
      expect(result.brandPrimarySvg).toContain("<svg");
    });

    it("variant generator functions replace fills accurately", () => {
      const sampleSvg = `<svg><path fill="#123456" d="M 0 0" /><path fill="#ABCDEF" d="M 1 1" /></svg>`;

      const dark = generateMonochromeDarkSvg(sampleSvg);
      expect(dark).toContain('fill="#0A0A0A"');
      expect(dark).not.toContain('fill="#123456"');

      const light = generateMonochromeLightSvg(sampleSvg);
      expect(light).toContain('fill="#F4EFE6"');
      expect(light).not.toContain('fill="#123456"');

      const brand = generateBrandPrimarySvg(sampleSvg, "#C0392B");
      expect(brand).toContain('fill="#C0392B"');
    });
  });
});
