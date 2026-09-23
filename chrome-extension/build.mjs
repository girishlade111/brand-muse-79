// Chrome Extension Build Script (Manifest V3)
import { build } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;
const distDir = path.resolve(rootDir, "dist");

async function buildExtension() {
  console.log("⚡ Building Brand Muse Chrome Extension (Manifest V3)...");

  // Clean / prepare dist directory
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 1. Build Popup (HTML + TS + CSS)
  console.log("  → Building Popup UI...");
  await build({
    configFile: false,
    root: path.resolve(rootDir, "src/popup"),
    base: "./",
    build: {
      outDir: path.resolve(distDir, "popup"),
      emptyOutDir: false,
      rollupOptions: {
        input: path.resolve(rootDir, "src/popup/popup.html"),
        output: {
          entryFileNames: "popup.js",
          assetFileNames: "popup.[ext]",
        },
      },
    },
  });

  // 2. Build Content Script (IIFE format for universal browser tab execution)
  console.log("  → Building Content Script (IIFE)...");
  await build({
    configFile: false,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, "src/content/content.ts"),
        name: "BrandMuseContentScript",
        formats: ["iife"],
        fileName: () => "content.js",
      },
    },
  });

  // 3. Build Background Service Worker
  console.log("  → Building Background Service Worker...");
  await build({
    configFile: false,
    build: {
      outDir: distDir,
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, "src/background/background.ts"),
        formats: ["es"],
        fileName: () => "background.js",
      },
    },
  });

  // 4. Copy manifest.json
  console.log("  → Copying manifest.json...");
  fs.copyFileSync(
    path.resolve(rootDir, "manifest.json"),
    path.resolve(distDir, "manifest.json"),
  );

  // 5. Copy icons directory
  console.log("  → Copying icons...");
  const iconsDist = path.resolve(distDir, "icons");
  fs.mkdirSync(iconsDist, { recursive: true });
  const iconsSrc = path.resolve(rootDir, "src/icons");
  if (fs.existsSync(iconsSrc)) {
    for (const file of fs.readdirSync(iconsSrc)) {
      fs.copyFileSync(path.join(iconsSrc, file), path.join(iconsDist, file));
    }
  }

  console.log("✅ Brand Muse Chrome Extension built successfully in /chrome-extension/dist/");
  console.log("   To load in Chrome: Navigate to chrome://extensions, enable Developer mode, and click 'Load unpacked' pointing to 'chrome-extension/dist/'.");
}

buildExtension().catch((err) => {
  console.error("❌ Extension build failed:", err);
  process.exit(1);
});
