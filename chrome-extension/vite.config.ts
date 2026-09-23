import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vite configuration for Brand Muse Chrome Extension
export default defineConfig({
  root: path.resolve(__dirname, "src"),
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, "src/popup/popup.html"),
        content: path.resolve(__dirname, "src/content/content.ts"),
        background: path.resolve(__dirname, "src/background/background.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "content") return "content.js";
          if (chunkInfo.name === "background") return "background.js";
          return "[name]/[name].js";
        },
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../src"),
    },
  },
});
