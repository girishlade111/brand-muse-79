# Third-Party Integrations Reference

This document outlines all third-party services, cloud APIs, and specialized runtime engines configured in the **Brand DNA / Brand Muse** architecture.

---

## 📑 Table of Contents

- [Integration Architecture Overview](#integration-architecture-overview)
- [1. Supabase (Database, Auth, Storage)](#1-supabase-database-auth-storage)
  - [PostgreSQL Schema & Tables](#postgresql-schema--tables)
  - [Client-Side vs. Server-Side Clients](#client-side-vs-server-side-clients)
  - [Storage Bucket (`brand-assets`)](#storage-bucket-brand-assets)
  - [Row Level Security & Brokered Storage](#row-level-security--brokered-storage)
- [2. Lovable AI Gateway & Google Gemini](#2-lovable-ai-gateway--google-gemini)
  - [Gateway Endpoint & Model Routing](#gateway-endpoint--model-routing)
  - [Structured AI Extraction Pipeline](#structured-ai-extraction-pipeline)
  - [Resilience, Retry & Error Handling](#resilience-retry--error-handling)
  - [Generative Image Processing](#generative-image-processing)
- [3. Firecrawl Web & Document Scraping](#3-firecrawl-web--document-scraping)
  - [Dual Authentication: Native vs. Connector Gateway](#dual-authentication-native-vs-connector-gateway)
  - [Multi-Page Discovery (`firecrawlMap`)](#multi-page-discovery-firecrawlmap)
  - [Deep Scraping & Asset Harvesting](#deep-scraping--asset-harvesting)
  - [Zero-Dependency Direct Scrape Fallback](#zero-dependency-direct-scrape-fallback)
- [4. Lovable Cloud Auth](#4-lovable-cloud-auth)
  - [OAuth Provider Handshake](#oauth-provider-handshake)
- [5. Cloudflare Workers & Nitro Runtime](#5-cloudflare-workers--nitro-runtime)
  - [Edge Execution & `nodejs_compat`](#edge-execution--nodejs_compat)
- [6. Specialized Processing & Rendering Engines](#6-specialized-processing--rendering-engines)
  - [`@resvg/resvg-wasm` (SVG to PNG Rasterization)](#resvresvg-wasm-svg-to-png-rasterization)
  - [`fast-png` (Deterministic Pixel Recoloring)](#fast-png-deterministic-pixel-recoloring)
  - [`unpdf` (PDF Parsing)](#unpdf-pdf-parsing)
  - [`jsPDF` & `jszip` (Export Generation)](#jspdf--jszip-export-generation)

---

## Integration Architecture Overview

```mermaid
flowchart TD
    User([User / Browser])
    
    subgraph ClientLayer ["Client Browser Layer"]
        ViteClient[React 19 / TanStack Router]
        SupaClient[Supabase Client SDK]
        ClientPDF[unpdf / jsPDF / JSZip]
    end

    subgraph ServerLayer ["Server Layer (TanStack Start / Nitro / Workers)"]
        ServerFn[TanStack Server Functions]
        SupaAdmin[Supabase Admin Client]
        ResvgEngine[@resvg/resvg-wasm]
        FastPngEngine[fast-png Pixel Engine]
        AIGatewayClient[Lovable AI Gateway Client]
        FirecrawlClient[Firecrawl Scraper Client]
        DirectScraper[Direct Scraper Fallback]
    end

    subgraph ExternalServices ["Third-Party Cloud Services"]
        SupabaseCloud[(Supabase PostgreSQL & Storage)]
        LovableGateway[Lovable AI Gateway / Gemini 3 Flash]
        FirecrawlAPI[Firecrawl API / Gateway]
        GoogleFontsAPI[Google Fonts API]
    end

    User --> ViteClient
    ViteClient --> SupaClient
    ViteClient --> ClientPDF
    ViteClient --> ServerFn

    SupaClient --> SupabaseCloud
    ServerFn --> SupaAdmin
    ServerFn --> ResvgEngine
    ServerFn --> FastPngEngine
    ServerFn --> AIGatewayClient
    ServerFn --> FirecrawlClient
    ServerFn --> DirectScraper

    SupaAdmin --> SupabaseCloud
    AIGatewayClient --> LovableGateway
    FirecrawlClient --> FirecrawlAPI
    ServerFn --> GoogleFontsAPI
```

---

## 1. Supabase (Database, Auth, Storage)

Supabase serves as the primary persistence, authentication, and object storage layer.

### PostgreSQL Schema & Tables

Defined in TypeScript via `src/integrations/supabase/types.ts` and managed through `supabase/migrations/`:

| Table Name | Description | Key Columns |
|---|---|---|
| **`brand_kits`** | Root record for each extracted or manually assembled brand kit. | `id`, `name`, `status`, `source_type`, `source_url`, `source_text`, `brand_positioning`, `typography_scale`, `imagery_style`, `motion_style`, `share_token`, `anon_token` |
| **`kit_colors`** | Extracted and normalized hex colors with semantic UI assignments. | `id`, `kit_id`, `hex`, `name`, `role`, `locked`, `position` |
| **`kit_fonts`** | Typography families, weights, source families, and Google Font status. | `id`, `kit_id`, `family`, `source_family`, `role`, `weights`, `google_font`, `is_substitute`, `file_urls` |
| **`kit_assets`** | Brand logos, favicons, open-graph imagery, and generated variants. | `id`, `kit_id`, `kind`, `url`, `storage_path`, `width`, `height`, `position` |
| **`kit_tokens`** | Inferred design tokens (spacing, border radius, elevation, transitions). | `id`, `kit_id`, `category`, `name`, `value`, `position` |
| **`kit_voice`** | Brand voice guidelines, tone attributes, vocabulary, and dos/don'ts. | `id`, `kit_id`, `summary`, `tone`, `vocabulary`, `dos`, `donts`, `samples` |
| **`design_doc_versions`** | Audit log and version history of design system specifications (`DESIGN.md`). | `id`, `version`, `label`, `markdown`, `parsed`, `created_by` |
| **`profiles`** | User display names, avatars, and account metadata. | `id`, `user_id`, `display_name`, `avatar_url` |
| **`user_roles`** | Role-based access control (RBAC). | `id`, `user_id`, `role` (`'admin'` \| `'user'`) |

### Client-Side vs. Server-Side Clients

1. **Client SDK (`src/integrations/supabase/client.ts`)**:
   - Initialized with `SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`).
   - Operates under **Row Level Security (RLS)** constraints.
   - Utilizes custom fetch wrapper (`createSupabaseFetch`) supporting modern `sb_publishable_` opaque tokens.
   - Integrated with session persistence for anonymous or authenticated users.

2. **Server-Side Admin SDK (`src/server/supabase-admin.server.ts` & `src/integrations/supabase/client.server.ts`)**:
   - Initialized with `SUPABASE_SERVICE_ROLE_KEY`.
   - **Bypasses RLS** for administrative workflows (e.g. background extraction processing, storing scraped assets, deleting kit items).
   - Singleton cached in server process:
     ```typescript
     import { getAdmin } from "@/server/supabase-admin.server";
     const admin = getAdmin();
     ```

### Storage Bucket (`brand-assets`)

- Dedicated public bucket: `brand-assets`.
- Stores raw downloaded logos, uploaded brand source documents, and AI/canvas generated logo variants.
- Storage path convention:
  ```text
  brand-assets/{kitId}/assets/{variantKey}-{uuid}.{png|svg|webp}
  ```
- Public URL format:
  ```text
  https://{project-id}.supabase.co/storage/v1/object/public/brand-assets/{storagePath}
  ```

### Row Level Security & Brokered Storage

- Anonymous users receive a cryptographic token via `src/lib/anon.ts` stored in `localStorage` (`branddna.anonToken`).
- When a user signs in, their anonymous kits are claimable or linked to their permanent `user_id`.
- The `brokeredPreviewStorage` in `previewAuthStorage.ts` provides cookie and iframe communication support when running inside preview sandboxes.

---

## 2. Lovable AI Gateway & Google Gemini

Brand DNA delegates LLM operations to the **Lovable AI Gateway**, which proxies and balances requests across Google DeepMind models.

### Gateway Endpoint & Model Routing

- **Endpoint**: `https://ai.gateway.lovable.dev/v1/chat/completions`
- **Authentication**: `Authorization: Bearer <LOVABLE_API_KEY>`
- **Default Extraction Model**: `google/gemini-3-flash-preview`
- **Implementation**: Located in [src/server/ai.server.ts](file:///c:/Users/Girish%20Lade/OneDrive/Desktop/brand-muse-79/src/server/ai.server.ts).

### Structured AI Extraction Pipeline

Rather than relying on unstructured text output, Brand DNA enforces OpenAI-compatible tool/function calling via `callAIStructured<T>`:

```typescript
export async function callAIStructured<T>(opts: {
  system: string;
  user: string | any[];
  toolName: string;
  toolDescription: string;
  parameters: any; // JSON Schema definition
  model?: string;
}): Promise<T>
```

#### Key Schemas Enforced:
1. **Brand Positioning**: `tagline`, `mission`, `audience_description`, `industry_vertical`, `value_props`.
2. **Color Semantics**: Semantic color role assignment (`primary`, `secondary`, `accent`, `surface`, `chart-1`, etc.).
3. **Typography Scale**: Extraction of observed hierarchy (`h1`, `h2`, `h3`, `body`, `caption`, `label`) with font weights and line heights.
4. **Imagery & Motion Style**: Photography style, illustration style, mood keywords, and animation tempo.
5. **Brand Voice**: Tone descriptors, vocabulary guidelines, dos/don'ts, and 4 sample copy snippets written in the extracted voice.

### Resilience, Retry & Error Handling

To prevent transient network glitches or gateway rate limits from failing a multi-second extraction, `src/server/ai.server.ts` implements:
- **Retryable HTTP Status Codes**: `408`, `425`, `429`, `500`, `502`, `503`, `504`, `522`, `524`.
- **Jittered Exponential Backoff**: Base 600ms, scaling by $2^{\text{attempt}-1} \pm 30\%$ jitter, capped at 15,000ms. Respects `Retry-After` headers if returned.
- **Fail-Fast HTTP Codes**:
  - `402`: Out of credits (surfaces user-friendly prompt to top up credits).
  - `401` / `403`: Authentication failures (indicates invalid API keys).

### Generative Image Processing

In `src/lib/logo-variants.functions.ts`, the AI Gateway is invoked with image data URLs to isolate standalone brand marks (`logo-mark`) from wordmarks:
```typescript
const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "google/gemini-3-flash-preview",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: preset.prompt },
          { type: "image_url", image_url: { url: sourceDataUrl } },
        ],
      },
    ],
  }),
});
```

---

## 3. Firecrawl Web & Document Scraping

Firecrawl powers the multi-modal crawling and ingestion pipeline, extracting clean markdown, rendered HTML, and brand assets from arbitrary URLs.

### Dual Authentication: Native vs. Connector Gateway

The application detects the key type automatically in `src/server/ai.server.ts`:

1. **Lovable Connector Gateway (`lovc_*`)**:
   - Sent when configured through Lovable Cloud Connectors.
   - Dispatched to: `https://connector-gateway.lovable.dev/firecrawl`
   - Headers:
     ```http
     Authorization: Bearer <LOVABLE_API_KEY>
     X-Connection-Api-Key: <FIRECRAWL_API_KEY>
     Content-Type: application/json
     ```

2. **Native Firecrawl API (`fc-*`)**:
   - Sent when using an independent Firecrawl account.
   - Dispatched to: `https://api.firecrawl.dev`
   - Headers:
     ```http
     Authorization: Bearer <FIRECRAWL_API_KEY>
     Content-Type: application/json
     ```

### Multi-Page Discovery (`firecrawlMap`)

- Invokes `/v2/map` with `limit = 50` and `includeSubdomains: false`.
- Traverses the returned sitemap links using a heuristic path scoring algorithm:
  - Boosts paths like `/about`, `/mission`, `/manifesto`, `/product`, `/pricing` (+5 points).
  - Penalizes or drops noisy paths like `/blog`, `/news`, `/docs`, `/careers`, `/login`, `/legal`.
  - Crawls up to 2 high-scoring companion pages to complement the homepage.

### Deep Scraping & Asset Harvesting

- Invokes `/v2/scrape` requesting formats: `["markdown", "rawHtml", "links", "branding", "summary"]`.
- Document recognition: URLs ending in `.pdf`, `.docx`, or `.pptx` receive an extended 60-second timeout.
- Extracts:
  - High-res vector SVGs and PNG wordmarks.
  - Favicons, Apple Touch icons, and OpenGraph/Twitter card images.
  - Linked stylesheets and `@font-face` declarations.

### Zero-Dependency Direct Scrape Fallback

If `FIRECRAWL_API_KEY` is not provided or Firecrawl fails, Brand DNA automatically executes `directScrape(url)`:
- Emulates a modern desktop Chrome User-Agent to pass standard WAF inspections.
- Scrapes the raw HTML, strips noise (`<script>`, `<style>`, `<svg>`), and converts semantic tags to markdown.
- Extracts OpenGraph tags, `<link rel="icon">`, and `<img logo>` attributes deterministically.

---

## 4. Lovable Cloud Auth

Located in [src/integrations/lovable/index.ts](file:///c:/Users/Girish%20Lade/OneDrive/Desktop/brand-muse-79/src/integrations/lovable/index.ts).

### OAuth Provider Handshake

Uses `@lovable.dev/cloud-auth-js` to offer frictionless authentication:
- Supported Providers: `"google"`, `"apple"`, `"microsoft"`, `"lovable"`.
- Authentication flow:
  1. `lovableAuth.signInWithOAuth(provider, { redirect_uri, extraParams })` executes the OAuth redirect.
  2. Upon receiving session tokens, updates the Supabase client session:
     ```typescript
     await supabase.auth.setSession(result.tokens);
     ```
  3. Ensures user identities link seamlessly with Supabase Row Level Security.

---

## 5. Cloudflare Workers & Nitro Runtime

Brand DNA is compiled into an ultra-low latency edge server bundle using Nitro and Cloudflare Workers.

### Edge Execution & `nodejs_compat`

- **Build Plugin**: `@cloudflare/vite-plugin` in Vite pipeline.
- **Config**: `wrangler.jsonc`.
- **Runtime Features**:
  - `compatibility_flags: ["nodejs_compat"]` allows full usage of `node:crypto` (used for constant-time HMAC comparison in `cron-auth.ts`) and Node Buffer APIs.
  - SSR rendering of initial HTML routes with TanStack Start.

---

## 6. Specialized Processing & Rendering Engines

### `@resvg/resvg-wasm` (SVG to PNG Rasterization)

- **Source**: [src/lib/logo-variants.functions.ts](file:///c:/Users/Girish%20Lade/OneDrive/Desktop/brand-muse-79/src/lib/logo-variants.functions.ts)
- **Purpose**: Generative AI models reject raw `image/svg+xml`. Resvg renders vector SVG files into crisp, high-resolution 1024px PNG buffers via WebAssembly.
- **Singleton Initialization**: Dynamically downloads and initializes `index_bg.wasm` from unpkg once per worker lifecycle, safely handling HMR reloads.

### `fast-png` (Deterministic Pixel Recoloring)

- **Source**: [src/lib/logo-variants.functions.ts](file:///c:/Users/Girish%20Lade/OneDrive/Desktop/brand-muse-79/src/lib/logo-variants.functions.ts)
- **Purpose**: Generative models frequently hallucinate, distort kerning, or change letterforms when asked to simply recolor a logo. Brand DNA bypasses AI for recoloring:
  - **`logo-on-light`**: Deterministically decodes PNG bytes via `decodePng`, keys out any existing solid background, and recolors all opaque pixels to solid `#0A0A0A`.
  - **`logo-on-dark`**: Decodes PNG bytes and recolors all opaque pixels to solid `#F4EFE6`.
  - **`logo-inverted`**: Inverts RGB channels while preserving alpha transparency and aspect ratio.

### `unpdf` (PDF Parsing)

- **Source**: Client-side document ingestion in `src/routes/build.tsx` and `src/components/ingestion-panel.tsx`.
- **Purpose**: Extracts text content and embedded fonts from client-uploaded PDF brand guidelines without sending sensitive PDFs to external parsers.

### `jsPDF` & `jszip` (Export Generation)

- **Source**: [src/lib/exports.ts](file:///c:/Users/Girish%20Lade/OneDrive/Desktop/brand-muse-79/src/lib/exports.ts)
- **Purpose**:
  - **`jsPDF`**: Dynamically generates multi-page, high-resolution editorial brand guideline PDFs (`brand-guidelines.pdf`) with color swatches, WCAG tables, and font specimens entirely in the user's browser.
  - **`jszip`**: Bundles CSS files, Tailwind configurations, Figma Tokens JSON, downloaded logo files, and font specimens into a clean, structured `.zip` archive.
