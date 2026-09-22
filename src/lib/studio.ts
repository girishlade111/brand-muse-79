// Generative Marketing & Social Asset Studio — pure rendering engine.
// Canvas/SVG renderer that applies extracted brand tokens (colors, fonts,
// logo variants) to live marketing mockups. No React. Fully unit-testable.

export const STUDIO_ASSET_TYPES = [
  "linkedin-banner",
  "twitter-header",
  "instagram-post",
  "og-card",
  "deck-cover",
] as const;

export type StudioAssetType = (typeof STUDIO_ASSET_TYPES)[number];

export const STUDIO_TEMPLATES = [
  "minimalist",
  "editorial",
  "high-impact-tech",
  "typographic-grid",
] as const;

export type StudioTemplate = (typeof STUDIO_TEMPLATES)[number];

export const STUDIO_COLOR_SCHEMES = ["light", "dark", "hanko-accent"] as const;

export type StudioColorScheme = (typeof STUDIO_COLOR_SCHEMES)[number];

export const STUDIO_LOGO_PLACEMENTS = [
  "top-left",
  "centered",
  "watermark",
  "bottom-right",
] as const;

export type StudioLogoPlacement = (typeof STUDIO_LOGO_PLACEMENTS)[number];

export type StudioKitColor = {
  hex: string;
  role?: string | null;
  name?: string | null;
};

export type StudioKitFont = {
  family?: string | null;
  source_family?: string | null;
  role?: string | null;
  google_font?: boolean | null;
  file_urls?: Array<{ url: string }> | null;
};

export type StudioKitAsset = {
  kind: string;
  url: string;
  storage_path?: string | null;
};

export type StudioPalette = {
  background: string;
  ink: string;
  muted: string;
  accent: string;
  primary: string;
  secondary: string;
  hairline: string;
};

export type StudioRenderOpts = {
  assetType: StudioAssetType;
  template: StudioTemplate;
  colorScheme: StudioColorScheme;
  logoPlacement: StudioLogoPlacement;
  headline: string;
  body: string;
  cta: string;
  kitName: string;
  colors: StudioKitColor[];
  fonts: StudioKitFont[];
  logoUrl: string | null;
};

export const STUDIO_ASSET_META: Record<
  StudioAssetType,
  { label: string; width: number; height: number }
> = {
  "linkedin-banner": { label: "LinkedIn Banner", width: 1584, height: 396 },
  "twitter-header": { label: "Twitter / X Header", width: 1500, height: 500 },
  "instagram-post": { label: "Instagram Post", width: 1080, height: 1080 },
  "og-card": { label: "OpenGraph Card", width: 1200, height: 630 },
  "deck-cover": { label: "Deck Cover", width: 1920, height: 1080 },
};

export const STUDIO_TEMPLATE_META: Record<StudioTemplate, { label: string }> = {
  minimalist: { label: "Minimalist" },
  editorial: { label: "Editorial" },
  "high-impact-tech": { label: "High-Impact Tech" },
  "typographic-grid": { label: "Typographic Grid" },
};

function cleanHex(hex: string, fallback: string): string {
  const h = String(hex ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toUpperCase();
  if (/^#[0-9a-fA-F]{8}$/.test(h)) return `#${h.slice(1, 7).toUpperCase()}`;
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    const expanded = h
      .slice(1)
      .split("")
      .map((c) => c + c)
      .join("");
    return `#${expanded.toUpperCase()}`;
  }
  return fallback;
}

function luminance(hex: string): number {
  const h = cleanHex(hex, "#000000").slice(1);
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function withAlpha(hex: string, alpha: number): string {
  const h = cleanHex(hex, "#0A0A0A").slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function roleOf(c: StudioKitColor): string {
  return String(c.role ?? "").toLowerCase();
}

export function resolveStudioPalette(
  colors: StudioKitColor[],
  scheme: StudioColorScheme,
): StudioPalette {
  const valid = (colors ?? [])
    .map((c) => ({ ...c, hex: cleanHex(c.hex, "") }))
    .filter((c) => /^#[0-9A-F]{6}$/.test(c.hex));
  const byRole = (roles: string[]) => valid.find((c) => roles.includes(roleOf(c)));
  const sorted = [...valid].sort((a, b) => luminance(b.hex) - luminance(a.hex));
  const lightest = sorted[0]?.hex ?? "#F4EFE6";
  const darkest = sorted[sorted.length - 1]?.hex ?? "#0A0A0A";

  const primary =
    byRole(["primary"])?.hex ??
    valid.find((c) => !/background|surface|muted|text/i.test(roleOf(c)))?.hex ??
    valid[0]?.hex ??
    "#0A0A0A";
  const secondary =
    byRole(["secondary", "accent", "accent-2", "cta"])?.hex ??
    valid.find((c) => c.hex !== primary)?.hex ??
    "#5F5A52";
  const extractedAccent =
    byRole(["accent", "cta", "accent-2"])?.hex ??
    (luminance(secondary) < 0.25 ? secondary : "#8B1A1A");

  if (scheme === "dark") {
    const background = luminance(darkest) < 0.08 ? darkest : "#0A0A0A";
    const ink = luminance(lightest) > 0.6 ? lightest : "#F4EFE6";
    return {
      background,
      ink,
      muted: withAlpha(ink, 0.55),
      accent: extractedAccent,
      primary,
      secondary,
      hairline: withAlpha(ink, 0.22),
    };
  }
  if (scheme === "hanko-accent") {
    const background = /^#[0-9A-F]{6}$/.test(extractedAccent) ? extractedAccent : "#8B1A1A";
    const ink = luminance(background) > 0.3 ? "#0A0A0A" : "#F4EFE6";
    return {
      background,
      ink,
      muted: withAlpha(ink, 0.7),
      accent: ink,
      primary,
      secondary: ink,
      hairline: withAlpha(ink, 0.35),
    };
  }
  const background = luminance(lightest) > 0.55 ? lightest : "#F4EFE6";
  const ink = luminance(darkest) < 0.25 ? darkest : "#0A0A0A";
  return {
    background,
    ink,
    muted: withAlpha(ink, 0.55),
    accent: extractedAccent,
    primary,
    secondary,
    hairline: withAlpha(ink, 0.22),
  };
}

const LOGO_KINDS = [
  "logo-on-dark",
  "logo-light",
  "logo-inverted",
  "logo-on-light",
  "logo-dark",
  "logo",
  "wordmark",
  "logo-mark",
  "logomark",
  "icon",
  "favicon",
  "og-image",
];

// Pick the appropriate logo variant (light / dark / inverted) for a scheme.
export function pickStudioLogo(
  assets: StudioKitAsset[],
  scheme: StudioColorScheme,
): StudioKitAsset | null {
  const list = (assets ?? []).filter((a) => a && typeof a.url === "string" && a.url.length > 4);
  if (!list.length) return null;
  const rank = (kind: string): number => {
    const k = String(kind ?? "").toLowerCase();
    const i = LOGO_KINDS.indexOf(k);
    return i === -1 ? 50 : i;
  };
  const ordered = [...list].sort((a, b) => rank(a.kind) - rank(b.kind));
  if (scheme === "dark") {
    return (
      ordered.find((a) => ["logo-on-dark", "logo-light", "logo-inverted"].includes(a.kind)) ??
      ordered[0] ??
      null
    );
  }
  return (
    ordered.find((a) => ["logo-on-light", "logo-dark", "logo"].includes(a.kind)) ??
    ordered[0] ??
    null
  );
}

export function resolveStudioFonts(fonts: StudioKitFont[]): { display: string; body: string } {
  const usable = (fonts ?? []).filter((f) => f && typeof f.family === "string" && f.family.trim());
  const fam = (f: StudioKitFont): string => {
    const hasFiles = Array.isArray(f.file_urls) && f.file_urls.length > 0;
    const raw = (hasFiles && f.source_family ? f.source_family : f.family) ?? "";
    return (
      String(raw)
        .trim()
        .replace(/^["']|["']$/g, "") || ""
    );
  };
  const byRole = (roles: string[]) =>
    usable.find((f) => roles.includes(String(f.role ?? "").toLowerCase()));
  const display = fam(byRole(["display", "heading", "h1"]) ?? usable[0] ?? { family: "" });
  const body = fam(byRole(["body", "text", "mono"]) ?? usable[1] ?? usable[0] ?? { family: "" });
  const clean = (s: string, fb: string) =>
    /^(var\(|--|calc\(|env\()/i.test(s.trim()) || !s.trim() ? fb : s.trim();
  return {
    display: clean(display, "Cormorant Garamond"),
    body: clean(body, "Courier Prime"),
  };
}

export function escapeXml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Greedy word wrap by character budget (keeps SVG text layout deterministic).
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  // If words remain beyond maxLines, ellipsize the last line.
  const used = lines.join(" ").split(" ").filter(Boolean).length;
  if (used < words.length && lines.length) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.length > maxChars - 1 ? `${last.slice(0, maxChars - 1)}…` : last;
  }
  return lines.slice(0, maxLines);
}

function fontStack(primary: string, kind: "display" | "body"): string {
  const safe = primary.replace(/["\\]/g, "");
  return kind === "display"
    ? `"${safe}", "Cormorant Garamond", Georgia, serif`
    : `"${safe}", "Courier Prime", "JetBrains Mono", monospace`;
}

export function studioFilename(
  kitName: string,
  assetType: StudioAssetType,
  ext: "svg" | "png",
): string {
  const base = String(kitName || "kit")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "kit"}-${assetType}.${ext}`;
}

// Build a clean, standalone SVG string for the studio canvas.
export function buildStudioSVG(opts: StudioRenderOpts): string {
  const meta = STUDIO_ASSET_META[opts.assetType];
  const { width: w, height: h } = meta;
  const palette = resolveStudioPalette(opts.colors, opts.colorScheme);
  const fonts = resolveStudioFonts(opts.fonts);
  const pad = Math.round(Math.min(w, h) * 0.07);
  const isWide = w / h > 1.4;
  const isSquare = Math.abs(w / h - 1) < 0.15;

  const headline = String(opts.headline || "").trim() || "Steal any brand.";
  const body = String(opts.body || "").trim();
  const cta = String(opts.cta || "").trim();
  const kitName = String(opts.kitName || "Brand").trim() || "Brand";

  const headChars = isWide ? 26 : isSquare ? 20 : 30;
  const headLines = wrapText(headline, headChars, isSquare ? 4 : 3);
  const bodyLines = wrapText(body, isWide ? 52 : 40, 3);
  const headSize = Math.round(
    Math.min(
      w * (isWide ? 0.052 : 0.062),
      (h * 0.62) / Math.max(1, headLines.length + bodyLines.length * 0.42),
    ),
  );
  const bodySize = Math.round(Math.max(11, Math.min(w * 0.016, h * 0.045)));
  const eyebrowSize = Math.round(Math.max(10, Math.min(w * 0.013, h * 0.04)));
  const ctaSize = Math.round(Math.max(11, Math.min(w * 0.015, h * 0.042)));

  const displayStack = fontStack(fonts.display, "display");
  const bodyStack = fontStack(fonts.body, "body");

  const upperHeadline = opts.template === "high-impact-tech";
  const headText = (s: string) => (upperHeadline ? s.toUpperCase() : s);

  // Text block origin depends on template.
  const tx = opts.template === "editorial" ? pad + Math.round(w * 0.02) : pad;
  let ty = pad + eyebrowSize + Math.round(h * 0.04);
  // Watermark / centered logos shift the block down slightly.
  if (opts.logoPlacement === "centered") ty += Math.round(h * 0.09);

  const parts: string[] = [];
  const textFill = palette.ink;
  const mutedFill = palette.muted;

  // Eyebrow
  parts.push(
    `<text x="${tx}" y="${ty}" font-family=${quoteAttr(bodyStack)} font-size="${eyebrowSize}" letter-spacing="3" fill="${mutedFill}">// ${escapeXml(kitName.toUpperCase())} — ${escapeXml(meta.label.toUpperCase())}</text>`,
  );
  ty += Math.round(headSize * 0.9);

  // Editorial accent bar
  if (opts.template === "editorial") {
    parts.push(
      `<rect x="${pad}" y="${ty - headSize}" width="6" height="${headLines.length * headSize * 1.08}" fill="${palette.accent}" />`,
    );
  }

  // Headline lines
  headLines.forEach((line, i) => {
    const weight = opts.template === "minimalist" ? 500 : 700;
    const style =
      opts.template === "editorial" && i === headLines.length - 1
        ? ' font-style="italic" font-weight="400"'
        : "";
    parts.push(
      `<text x="${tx}" y="${ty + i * Math.round(headSize * 1.04)}" font-family=${quoteAttr(displayStack)} font-size="${headSize}" font-weight="${weight}"${style} fill="${textFill}">${escapeXml(headText(line))}</text>`,
    );
  });
  ty += headLines.length * Math.round(headSize * 1.04);

  // Minimalist hairline rule
  if (opts.template === "minimalist") {
    ty += Math.round(h * 0.025);
    parts.push(
      `<rect x="${tx}" y="${ty}" width="${Math.round(w * 0.12)}" height="2" fill="${palette.accent}" />`,
    );
    ty += Math.round(h * 0.035);
  } else {
    ty += Math.round(h * 0.03);
  }

  // Body lines
  bodyLines.forEach((line, i) => {
    parts.push(
      `<text x="${tx}" y="${ty + i * Math.round(bodySize * 1.55)}" font-family=${quoteAttr(bodyStack)} font-size="${bodySize}" letter-spacing="1" fill="${mutedFill}">${escapeXml(line.toUpperCase().slice(0, 90))}</text>`,
    );
  });
  if (bodyLines.length) ty += bodyLines.length * Math.round(bodySize * 1.55) + Math.round(h * 0.03);

  // CTA
  if (cta) {
    const ctaW = Math.min(Math.round(w * 0.4), Math.round(cta.length * ctaSize * 0.72 + 48));
    const ctaH = Math.round(ctaSize * 2.6);
    // Keep CTA inside canvas.
    if (ty + ctaH < h - pad * 0.6) {
      const fill = opts.template === "high-impact-tech" ? palette.accent : palette.ink;
      const label = palette.background;
      parts.push(`<rect x="${tx}" y="${ty}" width="${ctaW}" height="${ctaH}" fill="${fill}" />`);
      parts.push(
        `<text x="${tx + ctaW / 2}" y="${ty + ctaH / 2 + ctaSize * 0.36}" text-anchor="middle" font-family=${quoteAttr(bodyStack)} font-size="${ctaSize}" letter-spacing="2" fill="${label}">[ ${escapeXml(cta.toUpperCase().slice(0, 28))} ]</text>`,
      );
      ty += ctaH;
    }
  }

  // Template decorations (behind text? appended first for background ones).
  const bg: string[] = [];
  bg.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="${palette.background}" />`);
  // Washi grain: subtle horizontal hairlines.
  bg.push(
    `<rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="${palette.hairline}" stroke-width="2" />`,
  );
  if (opts.template === "typographic-grid") {
    const glyph = escapeXml((headline.trim().charAt(0) || "B").toUpperCase());
    bg.push(
      `<text x="${w - pad}" y="${h - Math.round(pad * 0.4)}" text-anchor="end" font-family=${quoteAttr(displayStack)} font-size="${Math.round(h * 0.85)}" font-weight="700" fill="${palette.ink}" opacity="0.07">${glyph}</text>`,
    );
    const cols = 4;
    for (let i = 1; i < cols; i++) {
      const gx = Math.round((w / cols) * i);
      bg.push(
        `<line x1="${gx}" y1="0" x2="${gx}" y2="${h}" stroke="${palette.hairline}" stroke-width="1" />`,
      );
    }
  }
  if (opts.template === "high-impact-tech") {
    bg.push(
      `<rect x="0" y="${h - Math.round(h * 0.07)}" width="${w}" height="${Math.round(h * 0.07)}" fill="${palette.accent}" />`,
    );
    for (let i = 1; i < 5; i++) {
      const gx = Math.round((w / 5) * i);
      bg.push(
        `<line x1="${gx}" y1="0" x2="${gx}" y2="${h}" stroke="${palette.hairline}" stroke-width="1" stroke-dasharray="2 6" />`,
      );
    }
  }
  if (opts.template === "editorial") {
    bg.push(
      `<text x="${pad}" y="${pad + eyebrowSize}" font-family=${quoteAttr(bodyStack)} font-size="${eyebrowSize}" fill="${palette.accent}">01.</text>`,
    );
  }

  // Footer meta
  const footer = `${w} × ${h} — ${STUDIO_TEMPLATE_META[opts.template].label}`;
  bg.push(
    `<text x="${pad}" y="${h - Math.round(pad * 0.45)}" font-family=${quoteAttr(bodyStack)} font-size="${eyebrowSize}" letter-spacing="2" fill="${mutedFill}">${escapeXml(footer.toUpperCase())}</text>`,
  );

  // Logo
  const logo = opts.logoUrl ? String(opts.logoUrl) : "";
  if (logo) {
    const href = escapeXml(logo);
    const logoH = Math.round(h * (opts.logoPlacement === "watermark" ? 0.42 : 0.1));
    const logoW = Math.round(logoH * 2.4);
    if (opts.logoPlacement === "top-left") {
      parts.push(
        `<image href="${href}" xlink:href="${href}" x="${w - pad - logoW}" y="${pad}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet" />`,
      );
    } else if (opts.logoPlacement === "centered") {
      const cx = Math.round(w / 2 - logoW / 2);
      parts.push(
        `<image href="${href}" xlink:href="${href}" x="${cx}" y="${pad}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet" />`,
      );
    } else if (opts.logoPlacement === "bottom-right") {
      parts.push(
        `<image href="${href}" xlink:href="${href}" x="${w - pad - logoW}" y="${h - pad - logoH - Math.round(pad * 0.5)}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet" />`,
      );
    } else {
      const cx = Math.round(w / 2 - logoW * 1.5);
      const cy = Math.round(h / 2 - logoH * 1.5);
      parts.push(
        `<image href="${href}" xlink:href="${href}" x="${cx}" y="${cy}" width="${logoW * 3}" height="${logoH * 3}" preserveAspectRatio="xMidYMid meet" opacity="0.12" />`,
      );
    }
  }

  const inner = [...bg, ...parts].join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeXml(`${kitName} ${meta.label}`)}"><title>${escapeXml(`${kitName} — ${meta.label}`)}</title>${inner}</svg>`;
}

function quoteAttr(s: string): string {
  return `"${s.replace(/"/g, "'")}"`;
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    if (blob.size > 4 * 1024 * 1024) return null;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Best-effort: inline the remote logo so canvas rasterization is not tainted.
export async function inlineStudioLogo(svg: string, logoUrl: string | null): Promise<string> {
  if (!logoUrl) return svg;
  const dataUrl = await fetchImageAsDataUrl(logoUrl);
  if (!dataUrl) return svg;
  return svg.split(logoUrl).join(dataUrl);
}

// Rasterize a standalone studio SVG to PNG at 2x retina scale via canvas.
export async function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
  scale = 2,
): Promise<Blob> {
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = new Image();
  img.decoding = "sync";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not rasterize studio preview"));
    img.src = svgUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG export failed");
  return blob;
}
