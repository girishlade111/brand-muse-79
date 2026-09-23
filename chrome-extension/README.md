# Brand Muse Chrome Extension — Design QA & Live Brand Auditor

Real-time DOM inspection and design QA Chrome Extension (Manifest V3) for Brand Muse kits.

---

## Features

- **Connect to Brand Muse**:
  - Connect with a single paste of any Brand Muse **Share Token**, **Kit ID** (UUID), or live URL (e.g. `http://localhost:5173/share/...` or `https://brandmuse.io/share/...`).
  - Fetches and caches the full brand identity (colors, roles, fonts, tokens).
- **Real-Time DOM Inspection**:
  - **Off-Brand Colors**: Scans rendered text, backgrounds, borders, and SVGs. Flags any color deviating from the brand kit's hex palette by a CIE76 distance of $\Delta E > 5.0$. Recommends the closest semantic brand palette match (e.g. `Suggested replacement: #0A0A0A (Primary)`).
  - **Unapproved Typography**: Flags font families that are not in the approved brand kit.
  - **WCAG Accessibility Contrast Failures**: Resolves the true composite background color under text elements and checks contrast ratio against WCAG AA standards (4.5:1 for normal text, 3.0:1 for large text $\ge 24\text{px}$ or $\ge 18.66\text{px}$ bold).
- **Interactive Highlighting Overlay**:
  - Draws subtle red / amber outlines around offending elements directly on the active webpage.
  - Hover or click any highlighted element to view an interactive dark-glassmorphism tooltip with the deviation reason, actual vs. suggested replacement, and a live **⚡ Preview Fix** button to test the change in-place.
  - Includes a non-intrusive floating HUD at the bottom-right showing live score and quick toggle controls.
- **Compliance Scorecard & Export Engine**:
  - Computes overall Brand Compliance Score (0–100%) and sub-scores for Colors, Typography, and Contrast.
  - **Export JSON**: Complete machine-readable audit report with selectors, element tags, values, and suggestions.
  - **1-Page PDF / Printable Report**: Executive compliance scorecard with score gauge, deviation tables, and print-ready stylesheet.

---

## Installation & Development

### 1. Build the Extension
```bash
npm run build:extension
```
This builds all extension artifacts into `chrome-extension/dist/`.

### 2. Load into Google Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable the **Developer mode** toggle in the top right corner.
3. Click **Load unpacked**.
4. Select the `chrome-extension/dist` folder in this repository.
5. The **Brand Muse — Design QA & Live Brand Auditor** extension is now installed!

### 3. Usage
1. Click the Brand Muse extension icon in the Chrome toolbar.
2. Enter your Brand Muse **Share Token** or **Kit ID** (and optional Brand Muse host URL, default: `http://localhost:5173`).
3. Click **🔗 Connect & Sync Kit**.
4. Navigate to any website tab you want to audit.
5. Click **🔍 Audit Active Tab** and toggle **Highlight Deviations**.
6. Hover over offending elements on the page to view suggestions, preview fixes live, or export the audit scorecard!
