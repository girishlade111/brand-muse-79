import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      ".kilo",
      ".agents",
      ".tanstack",
      ".nitro",
      ".wrangler",
      "test-results",
      "e2e",
      // Generated shadcn/ui component files — intentionally export both
      // components and utility fns (e.g. buttonVariants). Restructuring them
      // would break the shadcn import pattern.
      "src/components/ui/**",
      // Framework entry / router bootstrap — not a component module.
      "src/router.tsx",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // `any` is used deliberately at the DB/storage boundary: Drizzle rows are
      // cast at join points and the extraction pipeline handles third-party
      // JSON. The rule stays off — matching the existing no-unused-vars decision.
      "@typescript-eslint/no-explicit-any": "off",
      // Allow `catch {}` for best-effort work (sessionStorage, cookie probing,
      // optional cleanup) while still catching genuinely empty blocks.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  eslintPluginPrettier,
);
