import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
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
      // `any` is used deliberately at the DB/storage boundary: Supabase rows are
      // untyped (`Record<string, any>` patches, `as any` casts on joined rows)
      // and the extraction pipeline handles third-party JSON. Typing every one
      // of those would mean mirroring the whole Postgres schema by hand, so the
      // rule is off here — matching the existing no-unused-vars decision.
      "@typescript-eslint/no-explicit-any": "off",
      // Allow `catch {}` for best-effort work (sessionStorage, cookie probing,
      // optional cleanup) while still catching genuinely empty blocks.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  eslintPluginPrettier,
);
