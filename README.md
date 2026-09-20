# Brand DNA / Brand Muse (The Invisible Instrument)

> **Precision Brand Design System Extractor & Kit Generator.**  
> Extract color palettes with WCAG contrast verification, full typography hierarchies, logo variants, design tokens, and brand voice guidelines from any website URL, document, or uploaded asset.

---

[![React 19](https://img.shields.io/badge/React-19.2.0-blue.svg?style=flat-square&logo=react)](https://react.dev/)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start%20v1.167-orange.svg?style=flat-square)](https://tanstack.com/start)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.2.1-38bdf8.svg?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend%20%26%20Auth-3ecf8e.svg?style=flat-square&logo=supabase)](https://supabase.com/)
[![Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare%20Workers-f38020.svg?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Design Philosophy](#-design-philosophy)
- [Key Features](#-key-features)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Dev Server](#running-the-dev-server)
  - [Linting and Formatting](#linting-and-formatting)
  - [Testing](#testing)
- [Export Formats](#-export-formats)
- [Database Schema (Supabase)](#-database-schema-supabase)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

**Brand DNA** is a production-grade web application built to eliminate the tedious, manual work of assembling brand style guides and design tokens. Whether you are in a **Sales / GTM** role preparing a hyper-personalized pitch deck, a **Front-End Engineer** bootstrapping a client design system, or a **Designer** auditing visual identity, Brand DNA converts raw URLs or style guides into actionable design systems in seconds.

### The Problem It Solves
- **Painful Asset Hunting**: Manually inspecting SVG logos, guessing font weights, and color-picking hex values across messy DOM structures.
- **Inaccessible Color Palettes**: Brands often use colors that fail accessibility standards when placed into software interfaces or presentation slides.
- **Fragmented Handoffs**: Transferring a brand from a website to code requires writing CSS variables, creating Tailwind theme configurations, downloading font specimens, and crafting token files manually.

---

## 🖋 Design Philosophy

Brand DNA is designed around the concept of **"The Invisible Instrument"** — drawing inspiration from traditional Japanese calligraphy (*Shodō*) and sumi ink on washi paper:

- **Target Aesthetic**: Quiet, surgical, high-contrast editorial minimalism. A precision scalpel, not a toy.
- **Zero Radius (`0px`)**: Sharp corners everywhere. No pill buttons or decorative rounded borders.
- **Palette**: Monochromatic core (`#F4EFE6` washi paper and `#0A0A0A` sumi ink) with single hanko seal red (`#8B1A1A`) reserved exclusively for primary CTA moments.
- **Typography Pairing**:
  - **Display / Titles**: *Cormorant Garamond* (Bold, intentional ink strokes).
  - **Data / Labels / UI**: *Courier Prime* (Raw typewriter mono precision).
  - **Body Prose**: *Libre Baskerville* (Refined editorial readability).

---

## ✨ Key Features

### 1. Multi-Modal Ingestion
- **Website URL**: Deep URL scraping extracts favicons, high-res SVG/PNG logos, stylesheets, web fonts, and semantic text.
- **Document & PDF Upload**: Ingest brand guides, decks, and design documents directly via client-side PDF parsing (`unpdf`).
- **Asset Drop**: Drag-and-drop imagery, logos, or raw hex code strings.

### 2. Semantic Color Intelligence
- **Automatic Role Assignment**: Maps extracted colors to semantic roles (`Primary`, `Secondary`, `Background`, `Surface`, `Text`, `Accent`).
- **WCAG Contrast Ratios**: Automated AA and AAA contrast ratio verification with relative luminance analysis.
- **Interactive Palette Editor**: Rename, lock, edit hex values, or add custom brand swatches.

### 3. Typography Hierarchy & Font Discovery
- **Scale Detection**: Identifies display headings (`H1` through `H6`), body prose, and code/mono font sizes.
- **Google Fonts Auto-Resolution**: Resolves and imports corresponding Google Font families dynamically with interactive specimen previews.

### 4. Logo & Asset Studio
- **Vector Discovery**: Detects SVG marks, icons, and primary wordmarks.
- **Automated Logo Variants**: Generates monochrome, dark mode, light mode, inverted, and favicon variants.

### 5. Design Tokens Engine
- Spacing scales, structural borders, elevation rules, and animation tokens ready for consumption in design tools and front-end frameworks.

### 6. Brand Voice & AI Copywriting
- Extracts tone of voice, key brand vocabulary, and dos/don'ts.
- Automatically generates on-brand sample copy tailored for sales outreach, landing page headers, and client proposals.

### 7. Version History & Visual Diff Viewer
- Built-in design system versioning (`/design/history`) allowing teams to inspect visual diffs between iterations of a brand kit.

### 8. Sharing & Collaboration
- Generate secure public share tokens (`/share/$shareToken`) for read-only client presentations with zero login friction.

---

## 🛠 Architecture & Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Framework** | [TanStack Start](https://tanstack.com/start) | Full-stack React framework with Server Functions and SSR |
| **Routing** | [TanStack Router](https://tanstack.com/router) | Type-safe client & server routing with code-splitting |
| **Frontend UI** | [React 19](https://react.dev/) | Latest React release with server actions and concurrent features |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Next-generation utility-first CSS engine |
| **Primitives** | [Radix UI](https://www.radix-ui.com/) | Accessible, unstyled UI primitives (Dialog, Tabs, Tooltip, Switch, etc.) |
| **Icons** | [Lucide React](https://lucide.dev/) | Clean, consistent iconography |
| **State & Cache** | [TanStack Query](https://tanstack.com/query) | Async state synchronization and caching |
| **Database & Auth** | [Supabase](https://supabase.com/) | PostgreSQL database, Row Level Security (RLS), and Storage |
| **Packaging & PDF** | [JSZip](https://stuk.github.io/jszip/) & [jsPDF](https://github.com/parallax/jsPDF) | In-browser ZIP bundling and vector PDF generation |
| **Runtime / Edge** | [Cloudflare Workers](https://workers.cloudflare.com/) / Nitro | Ultra-low latency edge compute execution |
| **Testing** | [Vitest](https://vitest.dev/) & [Playwright](https://playwright.dev/) | Unit, integration, and end-to-end browser testing |

---

## 📂 Project Directory Structure

```text
brand-muse-79/
├── .agents/                    # Agent skills & references
│   └── skills/start-here-guide
├── e2e/                        # Playwright end-to-end test suites
├── scripts/                    # Build scripts & validation tooling
├── src/
│   ├── components/             # Reusable UI & view components
│   │   ├── ui/                 # Radix UI + Tailwind primitive components
│   │   ├── extraction-progress.tsx
│   │   ├── ingestion-panel.tsx # Primary input interface (URL / PDF / Drop)
│   │   ├── quiet-loader.tsx    # Minimalist status indicators
│   │   ├── recent-kits.tsx     # Local kit archive
│   │   ├── site-header.tsx     # Navigation & brand header
│   │   └── start-here-button.tsx
│   ├── hooks/                  # Custom React hooks (e.g., use-mobile)
│   ├── integrations/           # External service SDKs
│   │   └── supabase/           # Client, server client, middleware & types
│   ├── lib/                    # Core utilities, functions & export builders
│   │   ├── color.ts            # WCAG contrast & luminance algorithms
│   │   ├── exports.ts          # CSS, Tailwind, PDF, Tokens & ZIP generators
│   │   ├── font-loader.ts      # Web font loader & specimen renderer
│   │   ├── kits.functions.ts   # TanStack Start server functions for kits
│   │   └── logo-variants.functions.ts # Canvas-based variant generation
│   ├── routes/                 # File-based TanStack routes
│   │   ├── __root.tsx          # Root layout & global providers
│   │   ├── index.tsx           # Home landing & ingestion
│   │   ├── kit.$kitId.tsx      # Interactive brand kit workbench
│   │   ├── library.tsx         # Saved brand kits collection
│   │   ├── design.tsx          # Live design system documentation
│   │   ├── design.history.tsx  # Version history browser
│   │   ├── design.history.diff.tsx # Visual diff comparison tool
│   │   ├── share.$shareToken.tsx   # Public read-only client share view
│   │   └── start-here.tsx      # Onboarding guide
│   └── server/                 # Server-side scraper & AI extraction logic
│       ├── ai.server.ts        # AI brand voice & positioning synthesis
│       ├── css-colors.server.ts # Server-side CSS color parser
│       ├── extraction.server.ts # Website DOM & asset extractor
│       ├── fonts.server.ts     # Font discovery engine
│       └── logo-probe.server.ts # Vector & image logo detector
├── supabase/
│   ├── migrations/             # SQL schema migrations
│   └── config.toml             # Local Supabase configuration
├── DESIGN.md                   # Full Design System & Philosophy specification
├── package.json
├── tsconfig.json
├── vite.config.ts
└── wrangler.jsonc              # Cloudflare Workers deployment configuration
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or higher (or Bun `1.1+`)
- **npm** or **bun**
- **Git**
- A free [Supabase](https://supabase.com/) project (for database and storage)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/girishlade111/brand-muse-79.git
   cd brand-muse-79
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

### Environment Variables

Copy the sample environment file:
```bash
cp .env.example .env
```

Open `.env` and fill in your Supabase project credentials:
```env
# Supabase Configuration
SUPABASE_PROJECT_ID="your-supabase-project-id"
SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
SUPABASE_URL="https://your-project-id.supabase.co"

# Client Vite Configuration
VITE_SUPABASE_PROJECT_ID="your-supabase-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
```

### Running the Dev Server

Start the local Vite development server:
```bash
npm run dev
```

Visit `http://localhost:3000` (or the port indicated in your console) to view the application.

### Linting and Formatting

```bash
# Run ESLint and script checks
npm run lint

# Format code with Prettier
npm run format
```

### Testing

```bash
# Run unit and integration tests with Vitest
npm run test

# Run end-to-end browser tests with Playwright
npm run test:e2e
```

---

## 📦 Export Formats

Brand DNA allows you to export your generated brand kit in multiple formats:

| Format | File | Purpose |
|---|---|---|
| **CSS Variables** | `tokens.css` | Native CSS custom properties for web apps |
| **Tailwind Config** | `tailwind.config.js` | Drop-in Tailwind CSS theme extensions |
| **Tokens Studio** | `tokens.json` | Compatible with Figma Tokens / Tokens Studio |
| **Brand Guidelines PDF** | `brand-guidelines.pdf` | High-resolution editorial PDF style guide |
| **Complete ZIP Archive** | `brand-kit.zip` | Bundles logos, font specimens, tokens & configs |
| **Design Prompt Markdown** | `DESIGN.md` | Context prompt for AI web app builders |

---

## 🗄 Database Schema (Supabase)

The project uses PostgreSQL tables defined in `supabase/`:

- **`brand_kits`**: Core kit metadata, source URL/text, brand positioning, typography scale, motion and imagery styles.
- **`kit_colors`**: Hex values, semantic roles, locking state, and display positions.
- **`kit_assets`**: Logos, icons, dimensions, and Supabase storage paths.
- **`kit_fonts`**: Primary, secondary, and mono font family configurations.
- **`design_doc_versions`**: Audit log of changes to design system specifications.

---

## 🌐 Deployment

### Cloudflare Workers
This project includes pre-configured Cloudflare deployment settings in `wrangler.jsonc` and uses `@cloudflare/vite-plugin`:

```bash
# Build the production application
npm run build

# Deploy via Wrangler
npx wrangler deploy
```

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome!
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
