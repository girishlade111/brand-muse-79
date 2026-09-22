// Sandbox codegen - pure per-component snippet builders (HTML / React / Svelte).
// Same theme + component always yields the same output. No React.

import { resolveSemanticPalette } from "@/lib/exports";
import { resolveStudioFonts } from "@/lib/studio";

export type SandboxColor = { hex: string; role?: string | null; name?: string | null };
export type SandboxFont = { family?: string | null; role?: string | null };

export type CodeTarget = "html" | "react" | "svelte";
export type SandboxComponentId = "buttons" | "form" | "pricing" | "metric" | "feature" | "nav";

export type SandboxTheme = {
  brand: string;
  primary: string;
  primaryFg: string;
  ink: string;
  paper: string;
  accent: string;
  accentFg: string;
  muted: string;
  border: string;
  displayFont: string;
  bodyFont: string;
};

export function resolveSandboxTheme(
  kitName: string,
  colors: SandboxColor[],
  fonts: SandboxFont[],
): SandboxTheme {
  const s = resolveSemanticPalette(
    colors.map((c) => ({ id: c.hex, hex: c.hex, role: c.role, name: c.name })),
  );
  const f = resolveStudioFonts(fonts.map((x) => ({ family: x.family ?? "", role: x.role ?? "" })));
  return {
    brand: kitName || "Brand",
    primary: s.primary,
    primaryFg: s.primaryForeground,
    ink: s.foreground,
    paper: s.background,
    accent: s.accent,
    accentFg: s.accentForeground,
    muted: s.muted,
    border: s.foreground,
    displayFont: f.display,
    bodyFont: f.body,
  };
}

export const TARGETS: Array<{ id: CodeTarget; label: string }> = [
  { id: "html", label: "HTML" },
  { id: "react", label: "React" },
  { id: "svelte", label: "Svelte 5" },
];

// Pure code generator: same theme + component always yields the same snippet.
export function sandboxCode(target: CodeTarget, id: SandboxComponentId, t: SandboxTheme): string {
  const btn =
    target === "html"
      ? (cls: string, style: string, label: string) =>
          `  <button class="${cls}" style="${style}">${label}</button>`
      : target === "react"
        ? (cls: string, style: string, label: string) =>
            `  <button className="${cls}" style={{ ${style} }}>${label}</button>`
        : (cls: string, style: string, label: string) =>
            `  <button class="${cls}" style="${style}">${label}</button>`;
  const toStyleObj = (css: string) =>
    css
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((decl) => {
        const [k, ...rest] = decl.split(":");
        const camel = k.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        return `${camel}: "${rest.join(":").trim()}"`;
      })
      .join(", ");

  const btnBase =
    "display:inline-flex;align-items:center;padding:12px 32px;font-family:'Courier Prime',monospace;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;border-radius:0;cursor:pointer";
  const styles = {
    primary: `background:${t.accent};color:${t.accentFg};border:1px solid ${t.accent};${btnBase}`,
    secondary: `background:transparent;color:${t.ink};border:1px solid ${t.ink};${btnBase}`,
    ghost: `background:transparent;color:${t.ink};border:1px solid transparent;${btnBase}`,
    disabled: `background:${t.muted};color:${t.paper};border:1px solid ${t.muted};${btnBase};opacity:0.5;cursor:not-allowed`,
  };
  const cls = "brand-btn";

  if (id === "buttons") {
    const rows = [
      btn(cls, target === "react" ? toStyleObj(styles.primary) : styles.primary, "[ Primary ]"),
      btn(
        cls,
        target === "react" ? toStyleObj(styles.secondary) : styles.secondary,
        "[ Secondary ]",
      ),
      btn(cls, target === "react" ? toStyleObj(styles.ghost) : styles.ghost, "[ Ghost ]"),
      btn(cls, target === "react" ? toStyleObj(styles.disabled) : styles.disabled, "[ Disabled ]"),
    ];
    const open =
      target === "react"
        ? `export function BrandButtons() {\n  return (\n    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>`
        : target === "svelte"
          ? `<!-- BrandButtons.svelte -->\n<div style="display:flex;gap:12px;flex-wrap:wrap">`
          : `<!-- brand buttons -->`;
    const wrapOpen =
      target === "html" ? `<div style="display:flex;gap:12px;flex-wrap:wrap">` : open;
    const close =
      target === "react" ? `    </div>\n  );\n}` : target === "svelte" ? `</div>` : `</div>`;
    return `${wrapOpen}\n${rows.join("\n")}\n${close}`;
  }

  if (id === "form") {
    const inputStyle = `width:100%;padding:12px 16px;font-family:'Courier Prime',monospace;background:transparent;color:${t.ink};border:1px solid ${t.ink};border-radius:0`;
    if (target === "react") {
      return `export function BrandForm() {
  return (
    <form style={{ display: "grid", gap: 16, maxWidth: 420 }}>
      <input placeholder="Name" style={{ ${toStyleObj(inputStyle)} }} />
      <select style={{ ${toStyleObj(inputStyle)} }}>
        <option>Starter</option>
        <option>Growth</option>
        <option>Scale</option>
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 8, accentColor: "${t.accent}" }}>
        <input type="checkbox" defaultChecked /> Email me the guide
      </label>
      <button type="submit" style={{ ${toStyleObj(styles.primary)} }}>[ Submit ]</button>
    </form>
  );
}`;
    }
    if (target === "svelte") {
      return `<!-- BrandForm.svelte -->
<script>
  let agreed = $state(true);
</script>
<form style="display:grid;gap:16px;max-width:420px">
  <input placeholder="Name" style="${inputStyle}" />
  <select style="${inputStyle}">
    <option>Starter</option>
    <option>Growth</option>
    <option>Scale</option>
  </select>
  <label style="display:flex;align-items:center;gap:8px;accent-color:${t.accent}">
    <input type="checkbox" bind:checked={agreed} /> Email me the guide
  </label>
  <button type="submit" style="${styles.primary}">[ Submit ]</button>
</form>`;
    }
    return `<!-- brand form -->
<form style="display:grid;gap:16px;max-width:420px">
  <input placeholder="Name" style="${inputStyle}" />
  <select style="${inputStyle}">
    <option>Starter</option>
    <option>Growth</option>
    <option>Scale</option>
  </select>
  <label style="display:flex;align-items:center;gap:8px;accent-color:${t.accent}">
    <input type="checkbox" checked /> Email me the guide
  </label>
  <button type="submit" style="${styles.primary}">[ Submit ]</button>
</form>`;
  }

  if (id === "pricing") {
    const card = `border:1px solid ${t.ink};background:${t.paper};padding:32px;max-width:360px;border-radius:0`;
    if (target === "react") {
      return `export function PricingTier() {
  return (
    <div style={{ ${toStyleObj(card)} }}>
      <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, letterSpacing: "0.22em" }}>// GROWTH</p>
      <p style={{ fontFamily: "'${t.displayFont}', serif", fontSize: 56, margin: "12px 0" }}>$49</p>
      <ul style={{ display: "grid", gap: 8, margin: "0 0 24px", padding: 0, listStyle: "none" }}>
        <li>— 5 brand kits</li>
        <li>— Token export</li>
        <li>— Shared workspace</li>
      </ul>
      <button style={{ ${toStyleObj(styles.primary)} }}>[ Start trial ]</button>
    </div>
  );
}`;
    }
    if (target === "svelte") {
      return `<!-- PricingTier.svelte -->
<div style="${card}">
  <p style="font-family:'Courier Prime',monospace;font-size:11px;letter-spacing:0.22em">// GROWTH</p>
  <p style="font-family:'${t.displayFont}',serif;font-size:56px;margin:12px 0">$49</p>
  <ul style="display:grid;gap:8px;margin:0 0 24px;padding:0;list-style:none">
    <li>— 5 brand kits</li>
    <li>— Token export</li>
    <li>— Shared workspace</li>
  </ul>
  <button style="${styles.primary}">[ Start trial ]</button>
</div>`;
    }
    return `<!-- pricing tier card -->
<div style="${card}">
  <p style="font-family:'Courier Prime',monospace;font-size:11px;letter-spacing:0.22em">// GROWTH</p>
  <p style="font-family:'${t.displayFont}',serif;font-size:56px;margin:12px 0">$49</p>
  <ul style="display:grid;gap:8px;margin:0 0 24px;padding:0;list-style:none">
    <li>— 5 brand kits</li>
    <li>— Token export</li>
    <li>— Shared workspace</li>
  </ul>
  <button style="${styles.primary}">[ Start trial ]</button>
</div>`;
  }

  if (id === "metric") {
    const card = `border:1px solid ${t.ink};background:${t.paper};padding:24px;max-width:280px;border-radius:0`;
    const num = `font-family:'${t.displayFont}',serif;font-size:64px;line-height:1;color:${t.ink}`;
    if (target === "react") {
      return `export function MetricCounter() {
  return (
    <div style={{ ${toStyleObj(card)} }}>
      <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, letterSpacing: "0.22em" }}>// KITS SHIPPED</p>
      <p style={{ ${toStyleObj(num)} }}>128</p>
      <p style={{ color: "${t.accent}" }}>+12 this week</p>
    </div>
  );
}`;
    }
    if (target === "svelte") {
      return `<!-- MetricCounter.svelte -->
<div style="${card}">
  <p style="font-family:'Courier Prime',monospace;font-size:11px;letter-spacing:0.22em">// KITS SHIPPED</p>
  <p style="${num}">128</p>
  <p style="color:${t.accent}">+12 this week</p>
</div>`;
    }
    return `<!-- metric counter card -->
<div style="${card}">
  <p style="font-family:'Courier Prime',monospace;font-size:11px;letter-spacing:0.22em">// KITS SHIPPED</p>
  <p style="${num}">128</p>
  <p style="color:${t.accent}">+12 this week</p>
</div>`;
  }

  if (id === "feature") {
    const card = `border:1px solid ${t.ink};border-left:6px solid ${t.accent};background:${t.paper};padding:24px;max-width:420px;border-radius:0`;
    if (target === "react") {
      return `export function FeatureHighlight() {
  return (
    <div style={{ ${toStyleObj(card)} }}>
      <p style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, letterSpacing: "0.22em" }}>01. TOKENS</p>
      <p style={{ fontFamily: "'${t.displayFont}', serif", fontSize: 28, margin: "8px 0" }}>One source of truth</p>
      <p>Every color, font, and token in a single structured kit.</p>
      <a href="#" style={{ color: "${t.accent}" }}>[ Read the guide ]</a>
    </div>
  );
}`;
    }
    if (target === "svelte") {
      return `<!-- FeatureHighlight.svelte -->
<div style="${card}">
  <p style="font-family:'Courier Prime',monospace;font-size:11px;letter-spacing:0.22em">01. TOKENS</p>
  <p style="font-family:'${t.displayFont}',serif;font-size:28px;margin:8px 0">One source of truth</p>
  <p>Every color, font, and token in a single structured kit.</p>
  <a href="#" style="color:${t.accent}">[ Read the guide ]</a>
</div>`;
    }
    return `<!-- feature highlight card -->
<div style="${card}">
  <p style="font-family:'Courier Prime',monospace;font-size:11px;letter-spacing:0.22em">01. TOKENS</p>
  <p style="font-family:'${t.displayFont}',serif;font-size:28px;margin:8px 0">One source of truth</p>
  <p>Every color, font, and token in a single structured kit.</p>
  <a href="#" style="color:${t.accent}">[ Read the guide ]</a>
</div>`;
  }

  // nav
  const bar = `display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${t.ink};padding:0 24px;height:56px;background:${t.paper}`;
  if (target === "react") {
    return `export function BrandNav() {
  return (
    <header style={{ ${toStyleObj(bar)} }}>
      <span style={{ fontFamily: "'Courier Prime', monospace", letterSpacing: "0.2em" }}>${t.brand.toUpperCase()}</span>
      <nav style={{ display: "flex", gap: 24 }}>
        <a href="#kits">Kits</a>
        <a href="#compare">Compare</a>
        <a href="#studio">Studio</a>
      </nav>
      <button style={{ ${toStyleObj(styles.primary)} }}>[ New kit ]</button>
    </header>
  );
}`;
  }
  if (target === "svelte") {
    return `<!-- BrandNav.svelte -->
<header style="${bar}">
  <span style="font-family:'Courier Prime',monospace;letter-spacing:0.2em">${t.brand.toUpperCase()}</span>
  <nav style="display:flex;gap:24px">
    <a href="#kits">Kits</a>
    <a href="#compare">Compare</a>
    <a href="#studio">Studio</a>
  </nav>
  <button style="${styles.primary}">[ New kit ]</button>
</header>`;
  }
  return `<!-- brand nav -->
<header style="${bar}">
  <span style="font-family:'Courier Prime',monospace;letter-spacing:0.2em">${t.brand.toUpperCase()}</span>
  <nav style="display:flex;gap:24px">
    <a href="#kits">Kits</a>
    <a href="#compare">Compare</a>
    <a href="#studio">Studio</a>
  </nav>
  <button style="${styles.primary}">[ New kit ]</button>
</header>`;
}
