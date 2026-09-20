// Unit-test config kept deliberately separate from the app's Vite config.
//
// Why: the app config injects the TanStack Start + Cloudflare/Nitro plugin
// chain (SSR, workerd, HMR gates). Those plugins break plain node unit tests
// and, more importantly, the app config has no `test.include`, so Vitest also
// picked up `e2e/*.spec.ts` and tried to run Playwright specs under the Vitest
// runner — which always failed. Unit tests live in `scripts/` and `src/`;
// Playwright specs live in `e2e/` and run via `npm run test:e2e`.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.test.mjs", "src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules/**", "dist/**", ".output/**", ".vinxi/**", "e2e/**"],
  },
});
