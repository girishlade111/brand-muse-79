import { encode } from "fast-png";
import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve("chrome-extension/src/icons");
fs.mkdirSync(outDir, { recursive: true });

function createIcon(size) {
  const data = new Uint8Array(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.45;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Rounded squircle background
      const cornerRadius = size * 0.22;
      const inBoxX = Math.abs(x - cx) <= size / 2 - cornerRadius;
      const inBoxY = Math.abs(y - cy) <= size / 2 - cornerRadius;
      const cornerDist = Math.hypot(
        Math.max(0, Math.abs(x - cx) - (size / 2 - cornerRadius)),
        Math.max(0, Math.abs(y - cy) - (size / 2 - cornerRadius)),
      );

      if (inBoxX || inBoxY || cornerDist <= cornerRadius) {
        // Emerald gradient: #10B981 to #06B6D4
        const t = (x + y) / (size * 2);
        data[idx] = Math.round(16 * (1 - t) + 6 * t); // R
        data[idx + 1] = Math.round(185 * (1 - t) + 182 * t); // G
        data[idx + 2] = Math.round(129 * (1 - t) + 212 * t); // B
        data[idx + 3] = 255; // Alpha

        // Center lightning / check mark
        if (size >= 16) {
          const nx = (x - cx) / (size * 0.35);
          const ny = (y - cy) / (size * 0.35);
          // Simple diamond or lightning shape
          if (Math.abs(nx) + Math.abs(ny) <= 0.6) {
            data[idx] = 15; // Slate dark #0F172A
            data[idx + 1] = 23;
            data[idx + 2] = 42;
          }
        }
      } else {
        // Transparent
        data[idx + 3] = 0;
      }
    }
  }

  const pngBuffer = encode({
    width: size,
    height: size,
    data,
    channels: 4,
    depth: 8,
  });

  fs.writeFileSync(path.join(outDir, `icon${size}.png`), Buffer.from(pngBuffer));
  console.log(`Generated icon${size}.png (${size}x${size})`);
}

createIcon(16);
createIcon(48);
createIcon(128);
