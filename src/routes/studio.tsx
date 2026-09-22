import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { StudioSection } from "@/components/studio/studio-section";

export const Route = createFileRoute("/studio")({
  component: StudioPreviewPage,
  head: () => ({
    meta: [
      { title: "Social Asset Studio — Brand Kit" },
      {
        name: "description",
        content:
          "Preview marketing mockups for LinkedIn, X, Instagram, OpenGraph and deck covers with live brand tokens.",
      },
    ],
  }),
});

const DEMO_COLORS = [
  { hex: "#0A0A0A", role: "primary" },
  { hex: "#F4EFE6", role: "background" },
  { hex: "#8B1A1A", role: "accent" },
  { hex: "#5F5A52", role: "muted" },
  { hex: "#D8D0C3", role: "surface" },
];

const DEMO_FONTS = [
  { family: "Cormorant Garamond", role: "heading", google_font: true },
  { family: "Courier Prime", role: "mono", google_font: true },
];

// Standalone preview tool: same studio engine, demo tokens, no kit required.
// Text and export work fully; AI copy activates once opened from a saved kit.
function StudioPreviewPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          to="/"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
        >
          ← New kit
        </Link>
        <div className="mt-6 border-b border-[color:var(--border-subtle)] pb-6 sm:pb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            // standalone preview
          </p>
          <h1 className="mt-3 break-words text-4xl tracking-tight [font-family:'Cormorant_Garamond',serif] sm:text-6xl">
            Social Asset Studio
          </h1>
          <p className="mt-3 max-w-2xl font-mono text-[11px] uppercase leading-relaxed tracking-[0.14em] text-muted-foreground">
            LinkedIn banners, X headers, Instagram posts, OpenGraph cards, deck covers. Rendered
            live from brand tokens.
          </p>
        </div>
        <div className="mt-8">
          <StudioSection
            kitName="Demo Brand"
            colors={DEMO_COLORS}
            fonts={DEMO_FONTS}
            assets={[]}
            defaultHeadline="Steal any brand."
            defaultBody="Colors. Typography. Voice. Tokens. Extracted, structured, exported."
            defaultCta="Start extracting"
          />
        </div>
      </main>
    </div>
  );
}
