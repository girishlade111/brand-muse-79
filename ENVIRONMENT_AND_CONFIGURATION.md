# Environment Variables & Configuration Guide

This document provides a comprehensive, production-grade reference for all environment variables, execution scopes, and configuration files utilized across the **Brand DNA / Brand Muse** application.

---

## 📑 Table of Contents

- [Overview](#overview)
- [Environment Variables Reference](#environment-variables-reference)
  - [Client vs. Server Scopes](#client-vs-server-scopes)
  - [Exhaustive Environment Variable Catalog](#exhaustive-environment-variable-catalog)
  - [Sample `.env` Configuration](#sample-env-configuration)
  - [Security & Exposure Rules](#security--exposure-rules)
- [Configuration Files Deep Dive](#configuration-files-deep-dive)
  - [1. Vite & TanStack Start (`vite.config.ts`)](#1-vite--tanstack-start-viteconfigts)
  - [2. Cloudflare Workers (`wrangler.jsonc`)](#2-cloudflare-workers-wranglerjsonc)
  - [3. TypeScript (`tsconfig.json`)](#3-typescript-tsconfigjson)
  - [4. Tailwind CSS v4 & Theme System (`src/styles.css`)](#4-tailwind-css-v4--theme-system-srcstylescss)
  - [5. Playwright E2E (`playwright.config.ts`)](#5-playwright-e2e-playwrightconfigts)
  - [6. ESLint & Prettier (`eslint.config.js`, `.prettierrc`)](#6-eslint--prettier-eslintconfigjs-prettierrc)
  - [7. Supabase CLI Configuration (`supabase/config.toml`)](#7-supabase-cli-configuration-supabaseconfigtoml)
  - [8. Bun Configuration (`bunfig.toml`)](#8-bun-configuration-bunfigtoml)

---

## Overview

Brand DNA is a full-stack web application built on **TanStack Start**, **React 19**, **Vite**, and **Cloudflare Workers/Nitro**. Because code executes across both client-side browser bundles and server-side edge/SSR runtimes, environment variables and configuration files must strictly adhere to environment boundaries to prevent data leakage and build-time failures.

---

## Environment Variables Reference

### Client vs. Server Scopes

| Scope | Mechanism | Prefix | Security Level | Bundled to Client? |
|---|---|---|---|---|
| **Client-Side (Vite)** | `import.meta.env.VITE_*` | `VITE_` | Public | **Yes** — Inlined into JS assets during `vite build` |
| **Server-Side (SSR & Server Functions)** | `process.env.*` | Any | Private / Restricted | **No** — Kept in server runtime / Cloudflare Workers environment |

> [!CAUTION]
> Never prefix private credentials, service role keys, or API tokens with `VITE_`. Any variable starting with `VITE_` is statically embedded into the client bundle and can be read by anyone inspecting browser traffic.

---

### Exhaustive Environment Variable Catalog

#### 1. Supabase Client & SSR Variables

- **`SUPABASE_URL`**
  - **Type**: `string` (Valid URL, e.g. `https://<project-id>.supabase.co`)
  - **Scope**: Server runtime (`process.env.SUPABASE_URL`) & fallback for SSR.
  - **Usage**: Used by `src/integrations/supabase/client.ts`, `src/integrations/supabase/client.server.ts`, and `src/server/supabase-admin.server.ts` to connect to your Supabase PostgreSQL and storage backend.
  - **Required**: Yes.

- **`SUPABASE_PUBLISHABLE_KEY`**
  - **Type**: `string` (e.g. `sb_publishable_...` or public anon key)
  - **Scope**: Server runtime (`process.env.SUPABASE_PUBLISHABLE_KEY`) & SSR.
  - **Usage**: Authorizes read/write operations subject to Supabase Row Level Security (RLS) policies.
  - **Required**: Yes.

- **`SUPABASE_PROJECT_ID`**
  - **Type**: `string` (e.g. `hswnkqjteehponpcsdlw`)
  - **Scope**: Server runtime & tooling.
  - **Usage**: Identifies your Supabase project instance. Mirrors `supabase/config.toml`.
  - **Required**: Yes.

- **`VITE_SUPABASE_URL`**
  - **Type**: `string` (Mirrors `SUPABASE_URL`)
  - **Scope**: Client browser bundle (`import.meta.env['VITE_SUPABASE_URL']`).
  - **Usage**: Read in `src/integrations/supabase/client.ts` for browser-side queries.
  - **Required**: Yes.

- **`VITE_SUPABASE_PUBLISHABLE_KEY`**
  - **Type**: `string` (Mirrors `SUPABASE_PUBLISHABLE_KEY`)
  - **Scope**: Client browser bundle (`import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY']`).
  - **Usage**: Passed to `createClient` in the browser. Supports both legacy anon JWTs and new `sb_publishable_` opaque API keys.
  - **Required**: Yes.

- **`VITE_SUPABASE_PROJECT_ID`**
  - **Type**: `string` (Mirrors `SUPABASE_PROJECT_ID`)
  - **Scope**: Client browser bundle (`import.meta.env['VITE_SUPABASE_PROJECT_ID']`).
  - **Usage**: Used for client telemetry, auth redirects, and preview environment configurations.
  - **Required**: Yes.

#### 2. Server-Only Admin & Database Variables

- **`SUPABASE_SERVICE_ROLE_KEY`**
  - **Type**: `string` (e.g. `sb_secret_...` or service role JWT)
  - **Scope**: **Server runtime only** (`process.env.SUPABASE_SERVICE_ROLE_KEY`).
  - **Usage**: Read in `src/integrations/supabase/client.server.ts` and `src/server/supabase-admin.server.ts`. Bypasses Row Level Security (RLS) for backend operations such as automated brand kit extraction, asset storage uploading, and manual kit persistence.
  - **Security**: **CRITICAL**. Never commit this key to version control or expose it to client code.

#### 3. AI & Scraper Gateway Variables

- **`LOVABLE_API_KEY`**
  - **Type**: `string`
  - **Scope**: **Server runtime only** (`process.env.LOVABLE_API_KEY`).
  - **Usage**:
    1. Authenticates against the **Lovable AI Gateway** (`https://ai.gateway.lovable.dev/v1/chat/completions`) in `src/server/ai.server.ts` to invoke Google Gemini models (`google/gemini-3-flash-preview`).
    2. Used in `src/lib/logo-variants.functions.ts` to trigger generative logo isolation and editing.
    3. Serves as the bearer token for Lovable Connector Gateway requests (`https://connector-gateway.lovable.dev/firecrawl`).
  - **Required**: Required for AI-powered brand analysis and generative logo variants.

- **`FIRECRAWL_API_KEY`**
  - **Type**: `string` (e.g. `fc-...` or `lovc_...`)
  - **Scope**: **Server runtime only** (`process.env.FIRECRAWL_API_KEY`).
  - **Usage**:
    - If starting with `lovc_`: Authenticates via Lovable Connector Gateway with `X-Connection-Api-Key`.
    - If starting with `fc-`: Authenticates directly with `https://api.firecrawl.dev/v2/scrape` and `/v2/map`.
    - Facilitates multi-page crawling, JavaScript-rendered DOM extraction, PDF scraping, and metadata extraction.
  - **Fallback**: If not set, Brand DNA gracefully falls back to direct server-side HTML scraping (`directScrape` in `src/server/ai.server.ts`).

#### 4. Scheduled Task & Automation Variables

- **`LOVABLE_CRON_SECRET`**
  - **Type**: `string` (Cryptographic secret token)
  - **Scope**: **Server runtime only** (`process.env.LOVABLE_CRON_SECRET`).
  - **Usage**: Authenticates incoming cron or webhook requests in `src/integrations/supabase/cron-auth.ts` using timing-safe SHA-256 comparison.

- **`LOVABLE_CRON_SECRET_PREVIOUS`**
  - **Type**: `string` (Optional)
  - **Scope**: **Server runtime only**.
  - **Usage**: Allows zero-downtime secret rotation for scheduled tasks.

#### 5. Local Testing Variables

- **`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`**
  - **Type**: `string` (Local absolute file path)
  - **Scope**: Local CLI / test runner environment.
  - **Usage**: Read in `playwright.config.ts` to allow testing against custom browser binaries or Nix/system Chromium installations.

---

### Sample `.env` Configuration

Create a `.env` file in the project root by copying `.env.example`:

```bash
cp .env.example .env
```

Populate the file with your credentials:

```dotenv
# ==============================================================================
# Supabase Configuration (Server Runtime & SSR)
# ==============================================================================
SUPABASE_PROJECT_ID="your-project-id"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_your-publishable-key"
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="sb_secret_your-service-role-key"

# ==============================================================================
# Client Vite Configuration (Inlined at build time)
# ==============================================================================
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_your-publishable-key"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"

# ==============================================================================
# AI Gateway & Scraper Connectors (Server Runtime Only)
# ==============================================================================
LOVABLE_API_KEY="your-lovable-api-key"
FIRECRAWL_API_KEY="your-firecrawl-api-key"

# ==============================================================================
# Webhooks & Security (Optional / Production)
# ==============================================================================
LOVABLE_CRON_SECRET="your-32-byte-hex-secret"
LOVABLE_CRON_SECRET_PREVIOUS=""
```

---

### Security & Exposure Rules

1. **`.gitignore` Protection**: Ensure `.env`, `.env.local`, and `.env.*.local` are listed in `.gitignore`. Only `.env.example` should be committed.
2. **Module Separation Rule**:
   - Files ending with `.server.ts` (e.g. `src/server/ai.server.ts`, `src/integrations/supabase/client.server.ts`) must **NEVER** be imported into client components or route definitions.
   - TanStack Start server functions (`createServerFn`) must dynamically import server modules inside the handler:
     ```typescript
     const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
     ```
3. **Opaque API Key Handling**:
   - The Supabase client implementation (`src/integrations/supabase/client.ts`) contains custom logic to recognize newer opaque API keys (`sb_publishable_...` and `sb_secret_...`), ensuring they are passed as `apikey` headers rather than invalid Bearer JWT tokens.

---

## Configuration Files Deep Dive

### 1. Vite & TanStack Start (`vite.config.ts`)

File: [vite.config.ts](file:///c:/Users/Girish%20Lade/OneDrive/Desktop/brand-muse-79/vite.config.ts)

```typescript
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig();
```

#### Architecture & Built-in Plugins:
The project uses `@lovable.dev/vite-tanstack-config` to provide a consolidated, pre-configured build pipeline. It automatically integrates:
- **`@tanstack/react-start` & `@tanstack/router-plugin`**: Handles full-stack SSR, file-based route code splitting, and type-safe routing.
- **`@tailwindcss/vite` (v4)**: Modern compile-time Tailwind CSS integration without PostCSS overhead.
- **`vite-tsconfig-paths`**: Enables clean `@/*` path alias resolution pointing to `src/*`.
- **`@cloudflare/vite-plugin`**: Configures server output bundles for Cloudflare Workers / Nitro runtime during `vite build`.
- **Deduplication & Error Logging**: Ensures singletons for React and TanStack Router to prevent context mismatch.

> [!WARNING]
> Do NOT manually add `tailwindcss()`, `@vitejs/plugin-react`, or Cloudflare plugins to `vite.config.ts`. The custom `defineConfig` wrapper already includes them; adding them manually will cause duplicate plugin execution errors.

---

### 2. Cloudflare Workers (`wrangler.jsonc`)

File: [wrangler.jsonc](file:///c:/Users/Girish%20Lade/OneDrive/Desktop/brand-muse-79/wrangler.jsonc)

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "tanstack-start-app",
  "compatibility_date": "2025-09-24",
  "compatibility_flags": ["nodejs_compat"],
  "main": "@tanstack/react-start/server-entry"
}
```

#### Key Settings:
- **`compatibility_flags: ["nodejs_compat"]`**: Enables Node.js runtime compatibility inside Cloudflare Workers. Crucial for crypto (`node:crypto`), buffers, and stream handling in server functions.
- **`main: "@tanstack/react-start/server-entry"`**: Directs Cloudflare Workers to the TanStack Start server runtime entry point.

---

### 3. TypeScript (`tsconfig.json`)

File: [tsconfig.json](file:///c:/Users/Girish%20Lade/OneDrive/Desktop/brand-muse-79/tsconfig.json)

```json
{
  "include": ["src/**/*.ts", "src/**/*.tsx", "vite.config.ts", "eslint.config.js"],
  "compilerOptions": {
    "target": "ES2022",
    "jsx": "react-jsx",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],

    /* Bundler mode */
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": false,
    "noEmit": true,

    /* Linting */
    "skipLibCheck": true,
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

#### Key Settings:
- **`moduleResolution: "Bundler"`**: Optimized for modern bundlers like Vite that resolve bare module specifiers.
- **`paths: { "@/*": ["./src/*"] }`**: Configures path alias mapping for clean, refactor-safe imports across the entire `src/` tree.

---

### 4. Tailwind CSS v4 & Theme System (`src/styles.css`)

File: [src/styles.css](file:///c:/Users/Girish%20Lade/OneDrive/Desktop/brand-muse-79/src/styles.css)

Tailwind CSS v4 replaces legacy `tailwind.config.js` with pure CSS directives and `@theme inline`:

```css
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-surface: var(--surface);
  --color-accent: var(--accent);
  --font-sans: "Libre Baskerville", Georgia, "Times New Roman", serif;
  --font-display: "Cormorant Garamond", "Times New Roman", serif;
  --font-mono: "Courier Prime", ui-monospace, SFMono-Regular, monospace;
}
```

#### Core Design Tokens:
- **`--background`**: `#F4EFE6` (Washi paper light) / `#0A0A0A` (Sumi ink dark).
- **`--foreground`**: `#0A0A0A` (Sumi ink light) / `#F4EFE6` (Washi paper dark).
- **`--accent`**: `#8B1A1A` (Hanko seal red) / `#C0392B` (Dark mode seal red).
- **`--border`**: Structural 1px ink borders; elevation relies on borders rather than drop shadows.
- **Liquid Glass Tokens**: `--glass-bg`, `--glass-border`, `--glass-blur` provide frosted glassmorphism overlays for floating toolbars and action bars.

---

### 5. Playwright E2E (`playwright.config.ts`)

File: [playwright.config.ts](file:///c:/Users/Girish%20Lade/OneDrive/Desktop/brand-muse-79/playwright.config.ts)

Configures browser-level automated testing:
- **Timeout**: 90,000ms per test suite.
- **WebServer**: Automatically boots `bun run dev` at `http://localhost:8080` before starting tests.
- **Trace**: `retain-on-failure` captures screenshots, DOM snapshots, and network traces for failed tests.

---

### 6. ESLint & Prettier (`eslint.config.js`, `.prettierrc`)

File: [eslint.config.js](file:///c:/Users/Girish%20Lade/OneDrive/Desktop/brand-muse-79/eslint.config.js)

- Utilizes the modern **ESLint 9 Flat Config format** (`tseslint.config(...)`).
- Enforces React Hooks rules (`eslint-plugin-react-hooks`) and React Fast Refresh rules (`eslint-plugin-react-refresh`).
- Integrates `eslint-plugin-prettier/recommended` to surface formatting discrepancies directly as ESLint errors.
- Paired with `.prettierrc`:
  ```json
  {
    "semi": true,
    "singleQuote": false,
    "trailingComma": "all",
    "printWidth": 100,
    "tabWidth": 2
  }
  ```

---

### 7. Supabase CLI Configuration (`supabase/config.toml`)

File: [supabase/config.toml](file:///c:/Users/Girish%20Lade/OneDrive/Desktop/brand-muse-79/supabase/config.toml)

```toml
project_id = "hswnkqjteehponpcsdlw"
```

Links the local repository to the remote Supabase project instance. Used when applying migrations via `npx supabase db push` or generating TypeScript types via `npx supabase gen types typescript`.

---

### 8. Bun Configuration (`bunfig.toml`)

File: [bunfig.toml](file:///c:/Users/Girish%20Lade/OneDrive/Desktop/brand-muse-79/bunfig.toml)

```toml
[install]
registry = "https://registry.npmjs.org/"
```

Directs the Bun package manager to resolve packages from the official npm registry, ensuring lockfile consistency between `bun.lockb` and `package-lock.json`.
