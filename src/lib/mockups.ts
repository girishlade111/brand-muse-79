// Live AI Brand Mockups Studio — Deterministic Compositor & Mockup Engine.
// Provides high-resolution vector mockup templates for 5 core brand categories,
// responsive canvas rendering, and client-side high-DPI export utilities.

export const MOCKUP_CATEGORIES = [
  "social-media",
  "stationery",
  "merchandise",
  "outdoor",
  "saas-dashboard",
] as const;

export type MockupCategory = (typeof MOCKUP_CATEGORIES)[number];

export const MOCKUP_CATEGORY_META: Record<
  MockupCategory,
  { label: string; description: string; icon: string }
> = {
  "social-media": {
    label: "Social Media (Instagram/LinkedIn)",
    description: "High-contrast square posts and wide executive banners",
    icon: "Share2",
  },
  stationery: {
    label: "Stationery & Business Cards",
    description: "Front & back business card stack and editorial letterhead folio",
    icon: "CreditCard",
  },
  merchandise: {
    label: "Merchandise (T-shirt/Mug)",
    description: "Heavyweight cotton apparel and ceramic studio coffee mug",
    icon: "Shirt",
  },
  outdoor: {
    label: "Outdoor & Billboard",
    description: "Architectural metro billboard and backlit street kiosk poster",
    icon: "Maximize2",
  },
  "saas-dashboard": {
    label: "SaaS Dashboard Hero",
    description: "State-of-the-art product platform hero with live analytics",
    icon: "LayoutDashboard",
  },
};

export type MockupPreset = {
  id: string;
  category: MockupCategory;
  name: string;
  width: number;
  height: number;
  aspectRatio: string;
  description: string;
};

export const MOCKUP_PRESETS: Record<string, MockupPreset> = {
  "instagram-square": {
    id: "instagram-square",
    category: "social-media",
    name: "Instagram Square Post",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    description: "1080 × 1080 editorial feed graphic with structured brand typography",
  },
  "linkedin-banner": {
    id: "linkedin-banner",
    category: "social-media",
    name: "LinkedIn Executive Banner",
    width: 1584,
    height: 396,
    aspectRatio: "4:1",
    description: "1584 × 396 wide-format banner with value proposition and logo lockup",
  },
  "business-cards": {
    id: "business-cards",
    category: "stationery",
    name: "Business Cards (Front & Back)",
    width: 1200,
    height: 800,
    aspectRatio: "3:2",
    description: "Premium tactile card presentation with foil embossed logo and founder details",
  },
  "letterhead-folio": {
    id: "letterhead-folio",
    category: "stationery",
    name: "Editorial Letterhead Folio",
    width: 850,
    height: 1100,
    aspectRatio: "1:1.29",
    description: "850 × 1100 formal brand correspondence folio with watermark and hanko seal",
  },
  "crewneck-tshirt": {
    id: "crewneck-tshirt",
    category: "merchandise",
    name: "Heavyweight Cotton T-Shirt",
    width: 1200,
    height: 1200,
    aspectRatio: "1:1",
    description: "Minimalist streetwear silhouette with chest brand imprint and custom hem label",
  },
  "ceramic-mug": {
    id: "ceramic-mug",
    category: "merchandise",
    name: "Ceramic Studio Mug",
    width: 1200,
    height: 1200,
    aspectRatio: "1:1",
    description: "12oz ceramic coffee mug with wrap-around brand logo and ambient shadow",
  },
  "metro-billboard": {
    id: "metro-billboard",
    category: "outdoor",
    name: "Metro Station Billboard",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    description: "Architectural outdoor billboard with overhead lighting and structural frame",
  },
  "bus-shelter-poster": {
    id: "bus-shelter-poster",
    category: "outdoor",
    name: "Bus Shelter Backlit Poster",
    width: 1200,
    height: 1600,
    aspectRatio: "3:4",
    description: "Vertical illuminated street poster with high-contrast positioning quote",
  },
  "saas-hero-dark": {
    id: "saas-hero-dark",
    category: "saas-dashboard",
    name: "SaaS Dashboard Hero (Dark)",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    description: "Precision instrument dark SaaS product platform with live metric charts",
  },
  "saas-hero-light": {
    id: "saas-hero-light",
    category: "saas-dashboard",
    name: "SaaS Dashboard Hero (Light)",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    description: "Editorial washi paper analytics dashboard with clean structural rules",
  },
};

export const PRESETS_BY_CATEGORY: Record<MockupCategory, MockupPreset[]> = {
  "social-media": [MOCKUP_PRESETS["instagram-square"], MOCKUP_PRESETS["linkedin-banner"]],
  stationery: [MOCKUP_PRESETS["business-cards"], MOCKUP_PRESETS["letterhead-folio"]],
  merchandise: [MOCKUP_PRESETS["crewneck-tshirt"], MOCKUP_PRESETS["ceramic-mug"]],
  outdoor: [MOCKUP_PRESETS["metro-billboard"], MOCKUP_PRESETS["bus-shelter-poster"]],
  "saas-dashboard": [MOCKUP_PRESETS["saas-hero-dark"], MOCKUP_PRESETS["saas-hero-light"]],
};

export type BrandVariant = "light" | "dark";

export type MockupColorInput = {
  hex: string;
  role?: string | null;
  name?: string | null;
};

export type MockupFontInput = {
  family?: string | null;
  role?: string | null;
};

export type MockupRenderOptions = {
  presetId: string;
  variant: BrandVariant;
  kitName: string;
  headline: string;
  tagline: string;
  cta: string;
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  accentColor?: string;
  headingFont?: string;
  monoFont?: string;
  logoUrl?: string | null;
};

// ---------------------------------------------------------------------------
// Color & Typography Helpers
// ---------------------------------------------------------------------------

export function cleanHexColor(hex?: string | null, fallback = "#0A0A0A"): string {
  if (!hex) return fallback;
  const h = String(hex).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toUpperCase();
  if (/^#[0-9a-fA-F]{8}$/.test(h)) return `#${h.slice(1, 7).toUpperCase()}`;
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`.toUpperCase();
  }
  return fallback;
}

export function escapeXml(str?: string | null): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function wrapTextLines(text: string, maxCharsPerLine: number, maxLines = 4): string[] {
  const words = (text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = "";

  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

// ---------------------------------------------------------------------------
// Deterministic High-Resolution SVG Compositor
// ---------------------------------------------------------------------------

export function buildMockupSVG(opts: MockupRenderOptions): string {
  const preset = MOCKUP_PRESETS[opts.presetId] ?? MOCKUP_PRESETS["instagram-square"];
  const { width, height } = preset;
  const isDark = opts.variant === "dark";

  // Palette resolution
  const sumi = "#0A0A0A";
  const washi = "#F4EFE6";
  const hankoRed = "#8B1A1A";

  const primary = cleanHexColor(opts.primaryColor, isDark ? washi : sumi);
  const secondary = cleanHexColor(opts.secondaryColor, isDark ? "#EDE8DE" : "#262626");
  const bg = cleanHexColor(opts.backgroundColor, isDark ? sumi : washi);
  const accent = cleanHexColor(opts.accentColor, hankoRed);

  const displayFont = opts.headingFont || "Cormorant Garamond, serif";
  const monoFont = opts.monoFont || "Courier Prime, monospace";

  const kitNameEsc = escapeXml(opts.kitName || "BRAND MUSE");
  const headlineEsc = escapeXml(opts.headline || "The Invisible Instrument");
  const taglineEsc = escapeXml(opts.tagline || "Precision architecture. Zero decorative distraction.");
  const ctaEsc = escapeXml(opts.cta || "DISCOVER IDENTITY");

  // Logo rendering block
  const renderLogo = (x: number, y: number, w: number, h: number, fgColor = primary) => {
    if (opts.logoUrl) {
      return `
        <image href="${escapeXml(opts.logoUrl)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" />
      `;
    }
    // Elegant fallback typographic mark
    return `
      <g transform="translate(${x}, ${y})">
        <rect width="${w}" height="${h}" fill="none" stroke="${fgColor}" stroke-width="1.5" />
        <text x="${w / 2}" y="${h / 2 + 5}" font-family="${monoFont}" font-size="12" font-weight="700" fill="${fgColor}" text-anchor="middle" letter-spacing="2">
          ${kitNameEsc.slice(0, 16).toUpperCase()}
        </text>
      </g>
    `;
  };

  let content = "";

  switch (preset.id) {
    case "instagram-square": {
      const surfaceColor = isDark ? "#141414" : "#EDE8DE";
      const inkColor = isDark ? washi : sumi;
      const subtleBorder = isDark ? "rgba(244,239,230,0.18)" : "rgba(10,10,10,0.18)";
      const headlineLines = wrapTextLines(opts.headline || "The Invisible Instrument", 22, 3);

      content = `
        <rect width="${width}" height="${height}" fill="${bg}" />
        <!-- Structural 1px Ink Border Frame -->
        <rect x="54" y="54" width="${width - 108}" height="${height - 108}" fill="${surfaceColor}" stroke="${subtleBorder}" stroke-width="1" />
        <rect x="66" y="66" width="${width - 132}" height="${height - 132}" fill="none" stroke="${inkColor}" stroke-width="1.5" />
        
        <!-- Header: Top Meta Info & Logo -->
        <g transform="translate(100, 110)">
          <text x="0" y="24" font-family="${monoFont}" font-size="13" font-weight="700" fill="${inkColor}" letter-spacing="3">
            // SPECIFICATION · ${kitNameEsc.toUpperCase()}
          </text>
          <text x="${width - 300}" y="24" font-family="${monoFont}" font-size="12" fill="${inkColor}" opacity="0.6" letter-spacing="2" text-anchor="end">
            FIG. 01 / BRAND MOCKUP
          </text>
          <line x1="0" y1="44" x2="${width - 200}" y2="44" stroke="${subtleBorder}" stroke-width="1" />
        </g>

        <!-- Brand Logo Placement -->
        <g transform="translate(100, 190)">
          ${renderLogo(0, 0, 180, 50, inkColor)}
        </g>

        <!-- Center Editorial Headline -->
        <g transform="translate(100, 390)">
          ${headlineLines
            .map(
              (line, idx) => `
            <text x="0" y="${idx * 78}" font-family="${displayFont}" font-size="74" font-weight="700" fill="${inkColor}" letter-spacing="-1">
              ${escapeXml(line)}
            </text>
          `,
            )
            .join("")}
          
          <!-- Tagline -->
          <text x="0" y="${headlineLines.length * 78 + 36}" font-family="${monoFont}" font-size="16" fill="${inkColor}" opacity="0.8" letter-spacing="1">
            ${taglineEsc}
          </text>
        </g>

        <!-- Palette Swatches Strip -->
        <g transform="translate(100, 780)">
          <text x="0" y="0" font-family="${monoFont}" font-size="11" fill="${inkColor}" opacity="0.5" letter-spacing="2">
            ACTIVE SYSTEM CHROMATICS:
          </text>
          <g transform="translate(0, 16)">
            <rect x="0" y="0" width="80" height="32" fill="${primary}" stroke="${subtleBorder}" />
            <rect x="90" y="0" width="80" height="32" fill="${secondary}" stroke="${subtleBorder}" />
            <rect x="180" y="0" width="80" height="32" fill="${bg}" stroke="${subtleBorder}" />
            <rect x="270" y="0" width="80" height="32" fill="${accent}" stroke="${subtleBorder}" />
            
            <text x="40" y="48" font-family="${monoFont}" font-size="9" fill="${inkColor}" opacity="0.7" text-anchor="middle">${primary}</text>
            <text x="130" y="48" font-family="${monoFont}" font-size="9" fill="${inkColor}" opacity="0.7" text-anchor="middle">${secondary}</text>
            <text x="220" y="48" font-family="${monoFont}" font-size="9" fill="${inkColor}" opacity="0.7" text-anchor="middle">${bg}</text>
            <text x="310" y="48" font-family="${monoFont}" font-size="9" fill="${inkColor}" opacity="0.7" text-anchor="middle">${accent}</text>
          </g>
        </g>

        <!-- Bottom Footer with Hanko Seal & CTA -->
        <g transform="translate(100, 930)">
          <line x1="0" y1="0" x2="${width - 200}" y2="0" stroke="${subtleBorder}" stroke-width="1" />
          <g transform="translate(0, 30)">
            <!-- Hanko Seal Mark -->
            <rect x="0" y="0" width="28" height="28" fill="${accent}" />
            <text x="14" y="19" font-family="${monoFont}" font-size="14" font-weight="700" fill="${washi}" text-anchor="middle">印</text>
            
            <text x="42" y="18" font-family="${monoFont}" font-size="13" font-weight="700" fill="${inkColor}" letter-spacing="3">
              [ ${ctaEsc.toUpperCase()} ]
            </text>
          </g>
          
          <text x="${width - 200}" y="48" font-family="${monoFont}" font-size="11" fill="${inkColor}" opacity="0.5" text-anchor="end" letter-spacing="2">
            SHARP EDGES · 0PX RADIUS · RAW EFFICIENCY
          </text>
        </g>
      `;
      break;
    }

    case "linkedin-banner": {
      const inkColor = isDark ? washi : sumi;
      const surfaceColor = isDark ? "#141414" : "#EDE8DE";
      const subtleBorder = isDark ? "rgba(244,239,230,0.18)" : "rgba(10,10,10,0.18)";

      content = `
        <rect width="${width}" height="${height}" fill="${bg}" />
        <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="${surfaceColor}" stroke="${subtleBorder}" stroke-width="1" />
        
        <!-- Left Side: Brand Identity & Positioning -->
        <g transform="translate(70, 70)">
          <!-- Eyebrow -->
          <text x="0" y="18" font-family="${monoFont}" font-size="12" font-weight="700" fill="${accent}" letter-spacing="3">
            // ARCHITECTURAL IDENTITY · ${kitNameEsc.toUpperCase()}
          </text>
          
          <!-- Headline -->
          <text x="0" y="75" font-family="${displayFont}" font-size="52" font-weight="700" fill="${inkColor}" letter-spacing="-0.5">
            ${headlineEsc}
          </text>
          
          <!-- Subtitle / Tagline -->
          <text x="0" y="125" font-family="${monoFont}" font-size="14" fill="${inkColor}" opacity="0.85" letter-spacing="1">
            ${taglineEsc}
          </text>

          <!-- CTA Pill -->
          <g transform="translate(0, 160)">
            <rect x="0" y="0" width="220" height="42" fill="${inkColor}" />
            <text x="110" y="26" font-family="${monoFont}" font-size="12" font-weight="700" fill="${bg}" text-anchor="middle" letter-spacing="2">
              [ ${ctaEsc.toUpperCase()} ]
            </text>
          </g>
        </g>

        <!-- Right Side: Brand Mark & Color Accent Grid -->
        <g transform="translate(${width - 450}, 70)">
          <rect x="0" y="0" width="380" height="256" fill="${bg}" stroke="${inkColor}" stroke-width="1.5" />
          <g transform="translate(40, 40)">
            ${renderLogo(0, 0, 300, 70, inkColor)}
          </g>
          
          <!-- Color Palette Strip inside card -->
          <g transform="translate(40, 150)">
            <text x="0" y="0" font-family="${monoFont}" font-size="10" fill="${inkColor}" opacity="0.6" letter-spacing="2">
              SYSTEM SWATCHES:
            </text>
            <g transform="translate(0, 12)">
              <rect x="0" y="0" width="65" height="24" fill="${primary}" stroke="${subtleBorder}" />
              <rect x="75" y="0" width="65" height="24" fill="${secondary}" stroke="${subtleBorder}" />
              <rect x="150" y="0" width="65" height="24" fill="${bg}" stroke="${subtleBorder}" />
              <rect x="225" y="0" width="65" height="24" fill="${accent}" stroke="${subtleBorder}" />
            </g>
          </g>

          <text x="40" y="230" font-family="${monoFont}" font-size="10" fill="${inkColor}" opacity="0.4" letter-spacing="2">
            0PX RADIUS · HIGH CONTRAST
          </text>
        </g>
      `;
      break;
    }

    case "business-cards": {
      const inkColor = isDark ? washi : sumi;
      const cardW = 500;
      const cardH = 300;

      content = `
        <rect width="${width}" height="${height}" fill="${isDark ? "#121212" : "#E4DEC8"}" />
        <!-- Ambient Stage Gradients / Subtle Noise Base -->
        <radialGradient id="stageGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${isDark ? "#222222" : "#F4EFE6"}" stop-opacity="0.4" />
          <stop offset="100%" stop-color="${isDark ? "#0A0A0A" : "#D4CDBC"}" stop-opacity="0.8" />
        </radialGradient>
        <rect width="${width}" height="${height}" fill="url(#stageGlow)" />

        <!-- Labeling -->
        <text x="80" y="80" font-family="${monoFont}" font-size="12" font-weight="700" fill="${inkColor}" letter-spacing="3">
          // STATIONERY SUITE · ${kitNameEsc.toUpperCase()} · 350GSM COTTON BUSINESS CARDS
        </text>

        <!-- Front Card (Dark/Primary Foil) with Cast Shadow -->
        <g transform="translate(100, 200)">
          <!-- Shadow -->
          <rect x="20" y="24" width="${cardW}" height="${cardH}" fill="#000000" opacity="0.25" />
          <!-- Card Body -->
          <rect width="${cardW}" height="${cardH}" fill="${primary}" stroke="${primary === bg ? inkColor : "none"}" stroke-width="1" />
          <!-- Inner Hairline Border -->
          <rect x="16" y="16" width="${cardW - 32}" height="${cardH - 32}" fill="none" stroke="${secondary}" stroke-opacity="0.3" stroke-width="1" />
          
          <!-- Centered Logo -->
          <g transform="translate(100, 110)">
            ${renderLogo(0, 0, 300, 60, secondary)}
          </g>

          <text x="${cardW / 2}" y="${cardH - 35}" font-family="${monoFont}" font-size="10" fill="${secondary}" opacity="0.7" text-anchor="middle" letter-spacing="3">
            ARCHIVE EDITIONS · EST. 2026
          </text>
        </g>

        <!-- Back Card (Washi Surface) with Overlapping Angle -->
        <g transform="translate(580, 320)">
          <!-- Shadow -->
          <rect x="25" y="25" width="${cardW}" height="${cardH}" fill="#000000" opacity="0.3" />
          <!-- Card Body -->
          <rect width="${cardW}" height="${cardH}" fill="${washi}" stroke="${sumi}" stroke-width="1.5" />
          
          <!-- Content layout -->
          <g transform="translate(40, 50)">
            <text x="0" y="20" font-family="${displayFont}" font-size="28" font-weight="700" fill="${sumi}">
              Girish Lade
            </text>
            <text x="0" y="44" font-family="${monoFont}" font-size="11" font-weight="700" fill="${hankoRed}" letter-spacing="2">
              PRINCIPAL BRAND ARCHITECT
            </text>

            <line x1="0" y1="70" x2="${cardW - 80}" y2="70" stroke="rgba(10,10,10,0.15)" stroke-width="1" />

            <g transform="translate(0, 95)">
              <text x="0" y="0" font-family="${monoFont}" font-size="11" fill="${sumi}" opacity="0.75" letter-spacing="1">
                E: contact@${kitNameEsc.toLowerCase().replace(/[^a-z0-9]/g, "")}.studio
              </text>
              <text x="0" y="24" font-family="${monoFont}" font-size="11" fill="${sumi}" opacity="0.75" letter-spacing="1">
                W: www.${kitNameEsc.toLowerCase().replace(/[^a-z0-9]/g, "")}.design
              </text>
              <text x="0" y="48" font-family="${monoFont}" font-size="11" fill="${sumi}" opacity="0.75" letter-spacing="1">
                T: +1 (800) ARCHIVE-0
              </text>
            </g>

            <!-- Bottom Hanko Seal -->
            <g transform="translate(${cardW - 130}, 130)">
              <rect width="36" height="36" fill="${hankoRed}" />
              <text x="18" y="24" font-family="${monoFont}" font-size="16" font-weight="700" fill="${washi}" text-anchor="middle">印</text>
            </g>
          </g>
        </g>
      `;
      break;
    }

    case "letterhead-folio": {
      const inkColor = isDark ? washi : sumi;

      content = `
        <rect width="${width}" height="${height}" fill="${isDark ? "#101010" : "#E2DCB9"}" />
        
        <!-- Sheet of High-End Paper -->
        <g transform="translate(80, 60)">
          <!-- Paper Cast Shadow -->
          <rect x="18" y="22" width="${width - 160}" height="${height - 120}" fill="#000000" opacity="${isDark ? 0.45 : 0.18}" />
          <!-- Paper Sheet -->
          <rect width="${width - 160}" height="${height - 120}" fill="${bg}" stroke="${inkColor}" stroke-width="1.5" />
          
          <!-- Letterhead Header -->
          <g transform="translate(60, 60)">
            <text x="0" y="24" font-family="${displayFont}" font-size="34" font-weight="700" fill="${inkColor}">
              ${kitNameEsc}
            </text>
            <text x="0" y="48" font-family="${monoFont}" font-size="10" font-weight="700" fill="${accent}" letter-spacing="2">
              BRAND SPECIFICATION &amp; DESIGN SYSTEM DIRECTIVE
            </text>
            
            <text x="${width - 280}" y="24" font-family="${monoFont}" font-size="11" fill="${inkColor}" opacity="0.6" text-anchor="end">
              DOC REF: BM-2026-09
            </text>
            <text x="${width - 280}" y="44" font-family="${monoFont}" font-size="11" fill="${inkColor}" opacity="0.6" text-anchor="end">
              DATE: SEPTEMBER 2026
            </text>

            <line x1="0" y1="70" x2="${width - 280}" y2="70" stroke="${inkColor}" stroke-width="1.5" />
          </g>

          <!-- Formal Letter Prose Body -->
          <g transform="translate(60, 200)">
            <text x="0" y="24" font-family="${monoFont}" font-size="12" font-weight="700" fill="${inkColor}" letter-spacing="1">
              SUBJECT: ARCHITECTURAL IDENTITY DISCIPLINE
            </text>

            <g transform="translate(0, 60)">
              <text x="0" y="0" font-family="${displayFont}" font-size="20" fill="${inkColor}" font-style="italic">
                "The Invisible Instrument"
              </text>
              <text x="0" y="32" font-family="${monoFont}" font-size="12" fill="${inkColor}" opacity="0.85" letter-spacing="0.5">
                This document ratifies the official aesthetic parameters of ${kitNameEsc}.
              </text>
              <text x="0" y="60" font-family="${monoFont}" font-size="12" fill="${inkColor}" opacity="0.85" letter-spacing="0.5">
                1. Structural rules: 0px border-radius everywhere. Sharp corners only.
              </text>
              <text x="0" y="88" font-family="${monoFont}" font-size="12" fill="${inkColor}" opacity="0.85" letter-spacing="0.5">
                2. Palette discipline: Sumi black, washi white, single hanko seal red.
              </text>
              <text x="0" y="116" font-family="${monoFont}" font-size="12" fill="${inkColor}" opacity="0.85" letter-spacing="0.5">
                3. Typography: Cormorant Garamond for display, Courier Prime for data.
              </text>
            </g>
          </g>

          <!-- Watermark Logo in Center Paper -->
          <g transform="translate(${width / 2 - 190}, ${height / 2 - 50})" opacity="0.08">
            ${renderLogo(0, 0, 220, 100, inkColor)}
          </g>

          <!-- Footer Signature & Hanko Stamp -->
          <g transform="translate(60, ${height - 240})">
            <line x1="0" y1="0" x2="${width - 280}" y2="0" stroke="rgba(10,10,10,0.2)" stroke-width="1" />
            <g transform="translate(0, 30)">
              <text x="0" y="16" font-family="${displayFont}" font-size="24" font-weight="700" fill="${inkColor}">
                Approved by Creative Direction
              </text>
              <text x="0" y="40" font-family="${monoFont}" font-size="11" fill="${inkColor}" opacity="0.6" letter-spacing="2">
                VERIFIED BRAND INSTRUMENT
              </text>
            </g>

            <g transform="translate(${width - 340}, 20)">
              <rect width="44" height="44" fill="${accent}" />
              <text x="22" y="30" font-family="${monoFont}" font-size="20" font-weight="700" fill="${washi}" text-anchor="middle">印</text>
            </g>
          </g>
        </g>
      `;
      break;
    }

    case "crewneck-tshirt": {
      const shirtColor = isDark ? "#171717" : "#F7F5EE";
      const printColor = isDark ? washi : sumi;

      content = `
        <rect width="${width}" height="${height}" fill="${isDark ? "#0A0A0A" : "#EDE8DE"}" />
        
        <!-- Studio Lighting Radial -->
        <radialGradient id="shirtLight" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="${isDark ? 0.08 : 0.5}" />
          <stop offset="100%" stop-color="#000000" stop-opacity="${isDark ? 0.4 : 0.05}" />
        </radialGradient>
        <rect width="${width}" height="${height}" fill="url(#shirtLight)" />

        <!-- T-Shirt Silhouette Outline with Folded Sleeves -->
        <g transform="translate(200, 160)">
          <!-- Cast Shadow -->
          <path d="M400,60 C320,50 260,110 240,140 L100,240 L160,380 L230,330 L230,860 L570,860 L570,330 L640,380 L700,240 L560,140 C540,110 480,50 400,60 Z"
                fill="#000000" opacity="${isDark ? 0.5 : 0.15}" transform="translate(15, 25)" />

          <!-- Shirt Base -->
          <path d="M400,60 C320,50 260,110 240,140 L100,240 L160,380 L230,330 L230,860 L570,860 L570,330 L640,380 L700,240 L560,140 C540,110 480,50 400,60 Z"
                fill="${shirtColor}" stroke="${isDark ? "rgba(244,239,230,0.2)" : "rgba(10,10,10,0.2)"}" stroke-width="2" />
          
          <!-- Collar Ribbing -->
          <path d="M330,80 C360,120 440,120 470,80 C440,65 360,65 330,80 Z" fill="${isDark ? "#202020" : "#E8E4DA"}" stroke="${printColor}" stroke-width="1" />
          
          <!-- Chest Print Graphic: Brand Logo & Minimal Typographic Tag -->
          <g transform="translate(280, 260)">
            <rect width="240" height="2" fill="${printColor}" opacity="0.2" />
            <g transform="translate(20, 24)">
              ${renderLogo(0, 0, 200, 50, printColor)}
            </g>
            <text x="120" y="105" font-family="${displayFont}" font-size="20" font-weight="700" fill="${printColor}" text-anchor="middle" letter-spacing="1">
              ${kitNameEsc.toUpperCase()}
            </text>
            <text x="120" y="128" font-family="${monoFont}" font-size="9" fill="${printColor}" opacity="0.7" text-anchor="middle" letter-spacing="2">
              EDITION 01 · 280GSM HEAVYWEIGHT
            </text>
          </g>

          <!-- Hem Woven Tag -->
          <g transform="translate(230, 800)">
            <rect width="36" height="40" fill="${accent}" />
            <text x="18" y="26" font-family="${monoFont}" font-size="14" font-weight="700" fill="${washi}" text-anchor="middle">印</text>
          </g>
        </g>

        <!-- Mockup Spec Tag -->
        <text x="80" y="80" font-family="${monoFont}" font-size="12" font-weight="700" fill="${isDark ? washi : sumi}" letter-spacing="3">
          // MERCHANDISE APPAREL · 100% COMBED COTTON SILHOUETTE
        </text>
      `;
      break;
    }

    case "ceramic-mug": {
      const mugColor = isDark ? "#1A1A1A" : "#F4EFE6";
      const printColor = isDark ? washi : sumi;

      content = `
        <rect width="${width}" height="${height}" fill="${isDark ? "#0A0A0A" : "#EDE8DE"}" />
        
        <!-- Table Horizon Line -->
        <line x1="0" y1="840" x2="${width}" y2="840" stroke="${isDark ? "rgba(244,239,230,0.15)" : "rgba(10,10,10,0.15)"}" stroke-width="1.5" />
        
        <!-- Ceramic Mug Rendering -->
        <g transform="translate(360, 260)">
          <!-- Cast Shadow on Table -->
          <ellipse cx="240" cy="590" rx="280" ry="45" fill="#000000" opacity="${isDark ? 0.6 : 0.16}" />

          <!-- Mug Handle -->
          <path d="M420,180 C540,180 540,400 420,420" fill="none" stroke="${mugColor}" stroke-width="50" stroke-linecap="square" />
          <path d="M420,180 C540,180 540,400 420,420" fill="none" stroke="${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}" stroke-width="3" />

          <!-- Mug Body (Straight-walled Cylinder with 0px radius) -->
          <rect x="60" y="80" width="360" height="490" fill="${mugColor}" stroke="${isDark ? "rgba(244,239,230,0.25)" : "rgba(10,10,10,0.25)"}" stroke-width="2" />
          
          <!-- Inner Rim -->
          <ellipse cx="240" cy="80" rx="180" ry="32" fill="${isDark ? "#0D0D0D" : "#E2DCB9"}" stroke="${isDark ? "rgba(244,239,230,0.3)" : "rgba(10,10,10,0.3)"}" stroke-width="2" />

          <!-- Mug Face Brand Imprint -->
          <g transform="translate(130, 240)">
            ${renderLogo(0, 0, 220, 60, printColor)}
            <text x="110" y="110" font-family="${displayFont}" font-size="28" font-weight="700" fill="${printColor}" text-anchor="middle">
              ${kitNameEsc.toUpperCase()}
            </text>
            <text x="110" y="136" font-family="${monoFont}" font-size="10" font-weight="700" fill="${accent}" text-anchor="middle" letter-spacing="2">
              COFFEE · CODE · CRAFT
            </text>
          </g>
        </g>

        <!-- Spec Caption -->
        <text x="80" y="80" font-family="${monoFont}" font-size="12" font-weight="700" fill="${isDark ? washi : sumi}" letter-spacing="3">
          // CERAMIC OBJECT 01 · ${kitNameEsc.toUpperCase()} · 12OZ MATTE GLAZE MUG
        </text>
      `;
      break;
    }

    case "metro-billboard": {
      const inkColor = isDark ? washi : sumi;

      content = `
        <rect width="${width}" height="${height}" fill="${isDark ? "#080808" : "#D4CDBC"}" />
        
        <!-- Concrete / Architectural Background Beam Structure -->
        <rect x="0" y="0" width="${width}" height="120" fill="${isDark ? "#141414" : "#C4BDAA"}" />
        <line x1="0" y1="120" x2="${width}" y2="120" stroke="#000000" stroke-width="2" />

        <!-- Spotlights Fixtures along top -->
        <g stroke="${isDark ? washi : sumi}" stroke-width="2" fill="none">
          <line x1="400" y1="90" x2="400" y2="130" />
          <circle cx="400" cy="135" r="8" fill="${accent}" />
          
          <line x1="960" y1="90" x2="960" y2="130" />
          <circle cx="960" cy="135" r="8" fill="${accent}" />

          <line x1="1520" y1="90" x2="1520" y2="130" />
          <circle cx="1520" cy="135" r="8" fill="${accent}" />
        </g>

        <!-- Billboard Massive Frame with Cast Shadow -->
        <g transform="translate(160, 180)">
          <!-- Outer Shadow -->
          <rect x="25" y="30" width="1600" height="740" fill="#000000" opacity="0.5" />
          <!-- Heavy Structural Outer Steel Rim (0px radius) -->
          <rect width="1600" height="740" fill="#141414" stroke="#000000" stroke-width="4" />
          
          <!-- Inner Billboard Display Area -->
          <rect x="24" y="24" width="1552" height="692" fill="${bg}" />

          <!-- Massive Headline & Content Layout -->
          <g transform="translate(100, 140)">
            <text x="0" y="0" font-family="${monoFont}" font-size="14" font-weight="700" fill="${accent}" letter-spacing="4">
              // METROPOLITAN CAMPAIGN · ${kitNameEsc.toUpperCase()} · NATIVE DISPLAY
            </text>
            
            <text x="0" y="90" font-family="${displayFont}" font-size="88" font-weight="700" fill="${inkColor}" letter-spacing="-2">
              ${headlineEsc}
            </text>
            
            <text x="0" y="160" font-family="${monoFont}" font-size="20" fill="${inkColor}" opacity="0.85" letter-spacing="1">
              ${taglineEsc}
            </text>

            <g transform="translate(0, 230)">
              <rect width="280" height="60" fill="${inkColor}" />
              <text x="140" y="38" font-family="${monoFont}" font-size="14" font-weight="700" fill="${bg}" text-anchor="middle" letter-spacing="3">
                [ ${ctaEsc.toUpperCase()} ]
              </text>
            </g>
          </g>

          <!-- Large Right Side Logo Placement -->
          <g transform="translate(1050, 220)">
            ${renderLogo(0, 0, 420, 160, inkColor)}
          </g>
        </g>
      `;
      break;
    }

    case "bus-shelter-poster": {
      const inkColor = isDark ? washi : sumi;

      content = `
        <rect width="${width}" height="${height}" fill="${isDark ? "#0A0A0A" : "#CFC8B5"}" />
        
        <!-- Architectural Street Kiosk Steel Outer Casing -->
        <g transform="translate(160, 100)">
          <!-- Drop Shadow -->
          <rect x="20" y="20" width="880" height="1400" fill="#000000" opacity="0.4" />
          <!-- Steel Rim Frame -->
          <rect width="880" height="1400" fill="#171717" stroke="#000000" stroke-width="4" />
          
          <!-- Backlit Display Area -->
          <rect x="24" y="24" width="832" height="1352" fill="${bg}" stroke="${isDark ? "rgba(244,239,230,0.2)" : "rgba(10,10,10,0.2)"}" stroke-width="1.5" />
          
          <!-- Top Kiosk Header -->
          <g transform="translate(80, 100)">
            <text x="0" y="0" font-family="${monoFont}" font-size="13" font-weight="700" fill="${accent}" letter-spacing="3">
              // URBAN TRANSIT DISPLAY · ${kitNameEsc.toUpperCase()}
            </text>
            <text x="${832 - 160}" y="0" font-family="${monoFont}" font-size="12" fill="${inkColor}" opacity="0.5" text-anchor="end">
              LOC: SOHO ARCHIVE
            </text>
            <line x1="0" y1="24" x2="${832 - 160}" y2="24" stroke="${inkColor}" stroke-opacity="0.2" stroke-width="1" />
          </g>

          <!-- Brand Logo in Poster -->
          <g transform="translate(80, 200)">
            ${renderLogo(0, 0, 300, 90, inkColor)}
          </g>

          <!-- Poster Giant Typography -->
          <g transform="translate(80, 480)">
            ${wrapTextLines(opts.headline || "The Invisible Instrument", 16, 4)
              .map(
                (line, idx) => `
              <text x="0" y="${idx * 90}" font-family="${displayFont}" font-size="82" font-weight="700" fill="${inkColor}" letter-spacing="-1">
                ${escapeXml(line)}
              </text>
            `,
              )
              .join("")}

            <g transform="translate(0, 380)">
              <text x="0" y="0" font-family="${monoFont}" font-size="16" fill="${inkColor}" opacity="0.8" letter-spacing="1">
                ${taglineEsc}
              </text>
            </g>
          </g>

          <!-- Bottom CTA and QR Code Frame -->
          <g transform="translate(80, 1140)">
            <line x1="0" y1="0" x2="${832 - 160}" y2="0" stroke="${inkColor}" stroke-opacity="0.2" stroke-width="1" />
            
            <g transform="translate(0, 40)">
              <rect width="240" height="52" fill="${inkColor}" />
              <text x="120" y="32" font-family="${monoFont}" font-size="13" font-weight="700" fill="${bg}" text-anchor="middle" letter-spacing="2">
                [ ${ctaEsc.toUpperCase()} ]
              </text>
            </g>

            <!-- QR code frame -->
            <g transform="translate(${832 - 250}, 24)">
              <rect width="70" height="70" fill="none" stroke="${inkColor}" stroke-width="1.5" />
              <rect x="8" y="8" width="20" height="20" fill="${accent}" />
              <rect x="42" y="8" width="20" height="20" fill="${inkColor}" />
              <rect x="8" y="42" width="20" height="20" fill="${inkColor}" />
              <text x="35" y="86" font-family="${monoFont}" font-size="8" fill="${inkColor}" opacity="0.6" text-anchor="middle">SCAN</text>
            </g>
          </g>
        </g>
      `;
      break;
    }

    case "saas-hero-dark":
    case "saas-hero-light":
    default: {
      const isSaaSLight = preset.id === "saas-hero-light";
      const saasBg = isSaaSLight ? washi : sumi;
      const saasSurface = isSaaSLight ? "#EDE8DE" : "#141414";
      const saasInk = isSaaSLight ? sumi : washi;
      const saasBorder = isSaaSLight ? "rgba(10,10,10,0.2)" : "rgba(244,239,230,0.18)";

      content = `
        <rect width="${width}" height="${height}" fill="${isSaaSLight ? "#E5DFC8" : "#050505"}" />

        <!-- Browser Platform Window Container -->
        <g transform="translate(100, 60)">
          <!-- Window Shadow -->
          <rect x="20" y="30" width="1720" height="960" fill="#000000" opacity="${isSaaSLight ? 0.2 : 0.6}" />
          <!-- Main Window Frame (0px border-radius) -->
          <rect width="1720" height="960" fill="${saasBg}" stroke="${saasInk}" stroke-width="2" />

          <!-- Window Top Bar with Traffic Controls -->
          <g transform="translate(0, 0)">
            <rect width="1720" height="48" fill="${saasSurface}" stroke="${saasBorder}" stroke-width="1" />
            <!-- Mac / Window Dots -->
            <circle cx="30" cy="24" r="6" fill="#8B1A1A" />
            <circle cx="52" cy="24" r="6" fill="#B38F00" />
            <circle cx="74" cy="24" r="6" fill="#2E7D32" />

            <!-- URL Bar -->
            <rect x="400" y="10" width="920" height="28" fill="${saasBg}" stroke="${saasBorder}" stroke-width="1" />
            <text x="860" y="28" font-family="${monoFont}" font-size="11" fill="${saasInk}" opacity="0.7" text-anchor="middle" letter-spacing="1">
              https://app.${kitNameEsc.toLowerCase().replace(/[^a-z0-9]/g, "")}.io/workbench
            </text>
          </g>

          <!-- App Left Sidebar Navigation -->
          <g transform="translate(0, 48)">
            <rect width="260" height="912" fill="${saasSurface}" stroke="${saasBorder}" stroke-width="1" />
            
            <!-- Sidebar Logo -->
            <g transform="translate(24, 25)">
              ${renderLogo(0, 0, 210, 44, saasInk)}
              <text x="0" y="62" font-family="${monoFont}" font-size="10" font-weight="700" fill="${saasInk}" opacity="0.8" letter-spacing="2">
                ${kitNameEsc.toUpperCase()}
              </text>
            </g>

            <!-- Nav Items (0px radius) -->
            <g transform="translate(16, 120)">
              <g transform="translate(0, 0)">
                <rect width="228" height="40" fill="${primary}" />
                <text x="20" y="25" font-family="${monoFont}" font-size="11" font-weight="700" fill="${primary === washi ? sumi : washi}" letter-spacing="2">
                  // 01 DASHBOARD
                </text>
              </g>

              <g transform="translate(0, 52)">
                <text x="20" y="25" font-family="${monoFont}" font-size="11" fill="${saasInk}" opacity="0.6" letter-spacing="2">
                  // 02 BRAND ASSETS
                </text>
              </g>

              <g transform="translate(0, 96)">
                <text x="20" y="25" font-family="${monoFont}" font-size="11" fill="${saasInk}" opacity="0.6" letter-spacing="2">
                  // 03 TOKENS STUDIO
                </text>
              </g>

              <g transform="translate(0, 140)">
                <text x="20" y="25" font-family="${monoFont}" font-size="11" fill="${saasInk}" opacity="0.6" letter-spacing="2">
                  // 04 API KEYS
                </text>
              </g>
            </g>
          </g>

          <!-- Main App Workspace Area -->
          <g transform="translate(280, 68)">
            <!-- Top Metric Cards -->
            <g transform="translate(30, 20)">
              <!-- Metric 1 -->
              <rect x="0" y="0" width="310" height="120" fill="${saasSurface}" stroke="${saasBorder}" stroke-width="1" />
              <text x="24" y="32" font-family="${monoFont}" font-size="11" fill="${saasInk}" opacity="0.6" letter-spacing="2">TOTAL BRAND EXPORTS</text>
              <text x="24" y="80" font-family="${displayFont}" font-size="44" font-weight="700" fill="${saasInk}">142,850</text>
              <text x="24" y="104" font-family="${monoFont}" font-size="10" fill="${accent}">+18.4% THIS CYCLE</text>

              <!-- Metric 2 -->
              <rect x="340" y="0" width="310" height="120" fill="${saasSurface}" stroke="${saasBorder}" stroke-width="1" />
              <text x="364" y="32" font-family="${monoFont}" font-size="11" fill="${saasInk}" opacity="0.6" letter-spacing="2">ACTIVE ASSET COHORTS</text>
              <text x="364" y="80" font-family="${displayFont}" font-size="44" font-weight="700" fill="${saasInk}">99.98%</text>
              <text x="364" y="104" font-family="${monoFont}" font-size="10" fill="${saasInk}" opacity="0.6">ZERO DECORATION DRIFT</text>

              <!-- Metric 3 -->
              <rect x="680" y="0" width="310" height="120" fill="${saasSurface}" stroke="${saasBorder}" stroke-width="1" />
              <text x="704" y="32" font-family="${monoFont}" font-size="11" fill="${saasInk}" opacity="0.6" letter-spacing="2">LATENCY / AI RUNS</text>
              <text x="704" y="80" font-family="${displayFont}" font-size="44" font-weight="700" fill="${saasInk}">42ms</text>
              <text x="704" y="104" font-family="${monoFont}" font-size="10" fill="${saasInk}" opacity="0.6">DETERMINISTIC COMPOSITOR</text>

              <!-- Metric 4 -->
              <rect x="1020" y="0" width="340" height="120" fill="${saasSurface}" stroke="${saasBorder}" stroke-width="1" />
              <text x="1044" y="32" font-family="${monoFont}" font-size="11" fill="${saasInk}" opacity="0.6" letter-spacing="2">SYSTEM STATUS</text>
              <text x="1044" y="80" font-family="${displayFont}" font-size="36" font-weight="700" fill="${accent}">OPTIMIZED</text>
              <text x="1044" y="104" font-family="${monoFont}" font-size="10" fill="${saasInk}" opacity="0.6">THE INVISIBLE INSTRUMENT</text>
            </g>

            <!-- Center Analytics Trend Graph Box -->
            <g transform="translate(30, 170)">
              <rect width="1330" height="420" fill="${saasSurface}" stroke="${saasBorder}" stroke-width="1" />
              <g transform="translate(30, 35)">
                <text x="0" y="0" font-family="${monoFont}" font-size="12" font-weight="700" fill="${saasInk}" letter-spacing="2">
                  // REAL-TIME SYNTHESIS VOLUME &amp; DISPATCH VELOCITY
                </text>
                
                <!-- Chart Grid Lines -->
                <line x1="0" y1="50" x2="1270" y2="50" stroke="${saasBorder}" stroke-width="1" />
                <line x1="0" y1="120" x2="1270" y2="120" stroke="${saasBorder}" stroke-width="1" />
                <line x1="0" y1="190" x2="1270" y2="190" stroke="${saasBorder}" stroke-width="1" />
                <line x1="0" y1="260" x2="1270" y2="260" stroke="${saasBorder}" stroke-width="1" />

                <!-- Vector Polyline Chart in Primary & Accent Colors -->
                <polyline points="0,220 180,180 340,210 500,110 680,140 860,60 1020,90 1200,40"
                          fill="none" stroke="${primary}" stroke-width="3" />
                <polyline points="0,250 180,240 340,190 500,160 680,200 860,130 1020,150 1200,90"
                          fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="4,4" />
                
                <!-- Data Nodes -->
                <circle cx="500" cy="110" r="5" fill="${primary}" stroke="${saasSurface}" stroke-width="2" />
                <circle cx="860" cy="60" r="5" fill="${primary}" stroke="${saasSurface}" stroke-width="2" />
                <circle cx="1200" cy="40" r="6" fill="${accent}" stroke="${saasSurface}" stroke-width="2" />
              </g>
            </g>

            <!-- Bottom Activity Table Row -->
            <g transform="translate(30, 620)">
              <rect width="1330" height="220" fill="${saasSurface}" stroke="${saasBorder}" stroke-width="1" />
              <g transform="translate(30, 30)">
                <text x="0" y="0" font-family="${monoFont}" font-size="11" font-weight="700" fill="${saasInk}" letter-spacing="2">
                  // RECENT SYSTEM AUDIT LOG
                </text>
                
                <text x="0" y="40" font-family="${monoFont}" font-size="11" fill="${saasInk}" opacity="0.8">
                  [14:02:11] AI Mockup rendered for category "Stationery &amp; Business Cards" (HTTP 200)
                </text>
                <text x="0" y="70" font-family="${monoFont}" font-size="11" fill="${saasInk}" opacity="0.8">
                  [13:58:04] Deterministic SVG compositor executed with palette [${primary}, ${secondary}, ${bg}]
                </text>
                <text x="0" y="100" font-family="${monoFont}" font-size="11" fill="${saasInk}" opacity="0.8">
                  [13:45:22] Kit asset saved to storage bucket "brand-assets" under kind "mockup"
                </text>
              </g>
            </g>
          </g>
        </g>
      `;
      break;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&amp;family=Courier+Prime:ital,wght@0,400;0,700;1,400&amp;display=swap');
      </style>
    </defs>
    ${content}
  </svg>`.trim();
}

// ---------------------------------------------------------------------------
// Client Export Helpers
// ---------------------------------------------------------------------------

export async function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
  scale = 2,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Could not acquire 2D canvas context"));
      return;
    }
    ctx.scale(scale, scale);

    const img = new Image();
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas to PNG blob conversion failed"));
        },
        "image/png",
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to render SVG image onto canvas"));
    };

    img.src = url;
  });
}

export async function svgToWebpBlob(
  svg: string,
  width: number,
  height: number,
  scale = 2,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Could not acquire 2D canvas context"));
      return;
    }
    ctx.scale(scale, scale);

    const img = new Image();
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas to WebP blob conversion failed"));
        },
        "image/webp",
        0.95,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to render SVG image onto canvas"));
    };

    img.src = url;
  });
}

export function downloadMockupBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
