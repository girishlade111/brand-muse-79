// Logo Vectorizer & Cleaner Engine.
// Converts pixelated raster logos (PNG, JPG, WebP) into clean, scalable,
// mathematically smooth SVGs with background stripping, color quantization,
// contour tracing, polygon simplification, and cubic Bézier curve fitting.

import { jsDenoiseMask, jsStripBackground } from "./vectorizer-wasm";

export type VectorizerOptions = {
  colorCount?: number; // 1 to 16, default 1
  curveSmoothness?: number; // 0 to 100, default 65
  pathPrecision?: number; // 1 to 100, default 80
  bgTolerance?: number; // 0 to 100, default 15
  stripBg?: boolean; // default true
  customBgColor?: { r: number; g: number; b: number } | null;
  primaryBrandHex?: string; // e.g. "#8B1A1A"
};

export type VectorizedResult = {
  svg: string;
  monochromeDarkSvg: string;
  monochromeLightSvg: string;
  brandPrimarySvg: string;
  width: number;
  height: number;
  pathCount: number;
  colors: string[];
  durationMs: number;
};

export type Point = { x: number; y: number };

// ---------------------------------------------------------------------------
// Color Utilities & Sampling
// ---------------------------------------------------------------------------

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function sampleBackgroundColor(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): { r: number; g: number; b: number } {
  // Sample corners: top-left, top-right, bottom-left, bottom-right
  const corners = [
    0, // top-left
    (width - 1) * 4, // top-right
    (height - 1) * width * 4, // bottom-left
    ((height - 1) * width + (width - 1)) * 4, // bottom-right
  ];

  let rSum = 0,
    gSum = 0,
    bSum = 0,
    count = 0;

  for (const offset of corners) {
    if (offset + 3 < data.length) {
      rSum += data[offset];
      gSum += data[offset + 1];
      bSum += data[offset + 2];
      count++;
    }
  }

  if (count === 0) return { r: 255, g: 255, b: 255 };
  return {
    r: Math.round(rSum / count),
    g: Math.round(gSum / count),
    b: Math.round(bSum / count),
  };
}

// ---------------------------------------------------------------------------
// Douglas-Peucker Polygon Simplification
// ---------------------------------------------------------------------------

function perpendicularDistance(p: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(p.x - lineStart.x, p.y - lineStart.y);
  return Math.abs(dy * p.x - dx * p.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
}

export function simplifyPolygon(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPolygon(points.slice(0, index + 1), epsilon);
    const right = simplifyPolygon(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  }

  return [points[0], points[end]];
}

// ---------------------------------------------------------------------------
// Contour Loop Extraction (Marching Squares / Boundary Following)
// ---------------------------------------------------------------------------

export function extractContourLoops(mask: Uint8Array, width: number, height: number): Point[][] {
  // Visited horizontal and vertical boundary edges
  const hEdges = new Uint8Array((width + 1) * (height + 1));
  const vEdges = new Uint8Array((width + 1) * (height + 1));
  const loops: Point[][] = [];

  const getPixel = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return mask[y * width + x] ? 1 : 0;
  };

  // Find all boundary segments
  // A vertical edge at (x, y) exists between pixel (x-1, y) and (x, y)
  // A horizontal edge at (x, y) exists between pixel (x, y-1) and (x, y)
  for (let y = 0; y <= height; y++) {
    for (let x = 0; x <= width; x++) {
      // Check horizontal edge
      if (y > 0 && y < height) {
        const top = getPixel(x, y - 1);
        const btm = getPixel(x, y);
        if (top !== btm) {
          hEdges[y * (width + 1) + x] = 1;
        }
      } else if (y === 0) {
        if (getPixel(x, 0)) hEdges[x] = 1;
      } else if (y === height) {
        if (getPixel(x, height - 1)) hEdges[height * (width + 1) + x] = 1;
      }

      // Check vertical edge
      if (x > 0 && x < width) {
        const left = getPixel(x - 1, y);
        const right = getPixel(x, y);
        if (left !== right) {
          vEdges[y * (width + 1) + x] = 1;
        }
      } else if (x === 0) {
        if (getPixel(0, y)) vEdges[y * (width + 1)] = 1;
      } else if (x === width) {
        if (getPixel(width - 1, y)) vEdges[y * (width + 1) + width] = 1;
      }
    }
  }

  // Trace boundary loops
  const visited = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] && !visited[y * width + x]) {
        // Trace external perimeter
        const loop = traceBoundary(mask, width, height, x, y, visited);
        if (loop.length >= 4) {
          loops.push(loop);
        }
      }
    }
  }

  return loops;
}

function traceBoundary(
  mask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Uint8Array,
): Point[] {
  const points: Point[] = [];
  const getP = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return mask[y * width + x];
  };

  // 8-neighborhood directions: [dx, dy]
  const dirs = [
    [1, 0], // 0: East
    [1, 1], // 1: SE
    [0, 1], // 2: South
    [-1, 1], // 3: SW
    [-1, 0], // 4: West
    [-1, -1], // 5: NW
    [0, -1], // 6: North
    [1, -1], // 7: NE
  ];

  let cx = startX;
  let cy = startY;
  let dir = 0;
  const maxSteps = width * height * 2;
  let steps = 0;

  points.push({ x: cx, y: cy });
  visited[cy * width + cx] = 1;

  while (steps++ < maxSteps) {
    let foundNext = false;
    const startDir = (dir + 5) % 8; // Backtrack search

    for (let i = 0; i < 8; i++) {
      const checkDir = (startDir + i) % 8;
      const nx = cx + dirs[checkDir][0];
      const ny = cy + dirs[checkDir][1];

      if (getP(nx, ny)) {
        cx = nx;
        cy = ny;
        dir = checkDir;
        foundNext = true;
        visited[cy * width + cx] = 1;
        break;
      }
    }

    if (!foundNext) break;
    if (cx === startX && cy === startY) break;

    // Only add if not duplicate
    const last = points[points.length - 1];
    if (!last || last.x !== cx || last.y !== cy) {
      points.push({ x: cx, y: cy });
    }
  }

  return points;
}

// ---------------------------------------------------------------------------
// Smooth Cubic Bézier Curve Fitting
// ---------------------------------------------------------------------------

export function fitBezierPath(points: Point[], smoothness: number): string {
  if (points.length < 3) {
    if (points.length === 0) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d + " Z";
  }

  // Smoothness 0 = sharp polygon
  const tension = (Math.max(0, Math.min(100, smoothness)) / 100) * 0.35;

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  const len = points.length;

  for (let i = 0; i < len; i++) {
    const p0 = points[(i - 1 + len) % len];
    const p1 = points[i];
    const p2 = points[(i + 1) % len];
    const p3 = points[(i + 2) % len];

    if (tension === 0) {
      d += ` L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
      continue;
    }

    // Catmull-Rom to Cubic Bézier control points
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return d + " Z";
}

// ---------------------------------------------------------------------------
// Color Quantization (K-Means Clustering)
// ---------------------------------------------------------------------------

type ColorCluster = { r: number; g: number; b: number; count: number };

function quantizeColors(data: Uint8Array | Uint8ClampedArray, k: number): ColorCluster[] {
  // Collect non-transparent pixels
  const samples: Array<[number, number, number]> = [];
  const len = data.length;
  const step = Math.max(1, Math.floor(len / 4 / 20000)) * 4;

  for (let i = 0; i < len; i += step) {
    if (data[i + 3] > 64) {
      samples.push([data[i], data[i + 1], data[i + 2]]);
    }
  }

  if (samples.length === 0) {
    return [{ r: 10, g: 10, b: 10, count: 1 }];
  }

  const clustersCount = Math.min(k, samples.length);
  // Initialize centroids using k-means++ style spread
  const centroids: ColorCluster[] = [];
  centroids.push({ r: samples[0][0], g: samples[0][1], b: samples[0][2], count: 0 });

  while (centroids.length < clustersCount) {
    const next = samples[Math.floor((centroids.length * samples.length) / clustersCount)];
    centroids.push({ r: next[0], g: next[1], b: next[2], count: 0 });
  }

  // Iterate 4 rounds of K-Means
  for (let round = 0; round < 4; round++) {
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

    for (const [r, g, b] of samples) {
      let nearestIdx = 0;
      let minDist = Infinity;

      for (let c = 0; c < centroids.length; c++) {
        const dr = r - centroids[c].r;
        const dg = g - centroids[c].g;
        const db = b - centroids[c].b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = c;
        }
      }

      sums[nearestIdx].r += r;
      sums[nearestIdx].g += g;
      sums[nearestIdx].b += b;
      sums[nearestIdx].count++;
    }

    for (let c = 0; c < centroids.length; c++) {
      if (sums[c].count > 0) {
        centroids[c].r = Math.round(sums[c].r / sums[c].count);
        centroids[c].g = Math.round(sums[c].g / sums[c].count);
        centroids[c].b = Math.round(sums[c].b / sums[c].count);
        centroids[c].count = sums[c].count;
      }
    }
  }

  return centroids.sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Main Vectorization Pipeline
// ---------------------------------------------------------------------------

export function vectorizeRaster(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  options: VectorizerOptions = {},
): VectorizedResult {
  const t0 = performance.now();

  const colorCount = Math.max(1, Math.min(16, options.colorCount ?? 1));
  const curveSmoothness = options.curveSmoothness ?? 65;
  const pathPrecision = options.pathPrecision ?? 80;
  const bgTolerance = (options.bgTolerance ?? 15) / 100;
  const stripBg = options.stripBg ?? true;
  const primaryBrandHex = options.primaryBrandHex || "#8B1A1A";

  // Work on a mutable copy
  const workingData = new Uint8Array(pixels.length);
  workingData.set(pixels);

  // 1. Background Stripping
  if (stripBg) {
    const bg = options.customBgColor || sampleBackgroundColor(workingData, width, height);
    jsStripBackground(workingData, width, height, bg.r, bg.g, bg.b, bgTolerance);
  }

  // 2. Color Quantization
  const clusters = quantizeColors(workingData, colorCount);

  // Epsilon for Douglas-Peucker: precision 100 -> 0.4px, precision 1 -> 5.0px
  const epsilon = 0.4 + (1 - pathPrecision / 100) * 4.6;

  const pathElements: string[] = [];
  const paletteHexes: string[] = [];

  // For each quantized color, build a mask and extract boundary loops
  for (const cluster of clusters) {
    const hex = rgbToHex(cluster.r, cluster.g, cluster.b);
    if (!paletteHexes.includes(hex)) paletteHexes.push(hex);

    const mask = new Uint8Array(width * height);
    const cr = cluster.r;
    const cg = cluster.g;
    const cb = cluster.b;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const a = workingData[idx + 3];
        if (a < 64) continue;

        if (colorCount === 1) {
          mask[y * width + x] = 1;
        } else {
          const r = workingData[idx];
          const g = workingData[idx + 1];
          const b = workingData[idx + 2];
          const distSq = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;

          // Closest cluster check
          let isNearest = true;
          for (const other of clusters) {
            if (other === cluster) continue;
            const otherDistSq = (r - other.r) ** 2 + (g - other.g) ** 2 + (b - other.b) ** 2;
            if (otherDistSq < distSq) {
              isNearest = false;
              break;
            }
          }
          if (isNearest) {
            mask[y * width + x] = 1;
          }
        }
      }
    }

    // 3. Denoise Mask
    const cleanMask = jsDenoiseMask(mask, width, height);

    // 4. Extract Contour Loops
    const loops = extractContourLoops(cleanMask, width, height);

    // 5. Simplify Polygons & Fit Bézier Curves
    const pathStrings: string[] = [];

    for (const loop of loops) {
      if (loop.length < 3) continue;
      const simplified = simplifyPolygon(loop, epsilon);
      if (simplified.length < 3) continue;
      const d = fitBezierPath(simplified, curveSmoothness);
      if (d) pathStrings.push(d);
    }

    if (pathStrings.length > 0) {
      pathElements.push(`<path fill="${hex}" fill-rule="evenodd" d="${pathStrings.join(" ")}" />`);
    }
  }

  // Fallback if no paths were generated (e.g. empty transparent image)
  if (pathElements.length === 0) {
    pathElements.push(
      `<path fill="#0A0A0A" fill-rule="evenodd" d="M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z" opacity="0.05" />`,
    );
  }

  // 6. SVG Assembly
  const mainSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="geometricPrecision">\n  ${pathElements.join("\n  ")}\n</svg>`;

  // 7. Variant Generation
  const monochromeDarkSvg = generateMonochromeDarkSvg(mainSvg);
  const monochromeLightSvg = generateMonochromeLightSvg(mainSvg);
  const brandPrimarySvg = generateBrandPrimarySvg(mainSvg, primaryBrandHex);

  const durationMs = Math.round(performance.now() - t0);

  return {
    svg: mainSvg,
    monochromeDarkSvg,
    monochromeLightSvg,
    brandPrimarySvg,
    width,
    height,
    pathCount: pathElements.length,
    colors: paletteHexes,
    durationMs,
  };
}

// ---------------------------------------------------------------------------
// Variant Generators
// ---------------------------------------------------------------------------

export function generateMonochromeDarkSvg(svg: string): string {
  return svg.replace(/fill="[^"]+"/g, 'fill="#0A0A0A"');
}

export function generateMonochromeLightSvg(svg: string): string {
  return svg.replace(/fill="[^"]+"/g, 'fill="#F4EFE6"');
}

export function generateBrandPrimarySvg(svg: string, primaryHex = "#8B1A1A"): string {
  const cleanHex = primaryHex.startsWith("#") ? primaryHex : `#${primaryHex}`;
  return svg.replace(/fill="[^"]+"/g, `fill="${cleanHex}"`);
}
