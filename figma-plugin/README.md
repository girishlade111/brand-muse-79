# Brand Muse · Official Figma Plugin Bridge

> Synchronize brand design tokens, local variables, typography text styles, and vector logos directly from your Brand Muse Brand Kit into Figma with live two-way diff tracking.

---

## Features

1. **Automated Figma Local Variables**:
   - **Color Collections**: Ingests primary, secondary, surface, accent, and semantic color tokens with exact RGB float mapping and hex descriptions.
   - **Spacing Collections**: Creates numerical float variables for layout spacing scales (`4px` to `48px`).
   - **Radius Collections**: Enforces strict "Invisible Instrument" border-radius tokens (`0px` standard).
2. **Typography Text Styles**:
   - Generates Figma Text Styles for Display H1, Section Titles H2, Body Copy, and Monospace Eyebrows with appropriate font families, weights, and line heights.
3. **1-Click Vector Logo Canvas Placement**:
   - Places cleaned SVG vector logos and marks directly onto the current Figma canvas with auto-spacing and selection.
4. **2-Way Diffing Notification**:
   - Visual status badge (`[ SYNCHRONIZED ]`, `▲ [ UPDATE AVAILABLE ]`, `○ [ UNLINKED ]`) that alerts designers when the cloud Brand Kit has changed since the last local synchronization.

---

## Running in Figma Developer Mode

### Prerequisites
- Figma Desktop App (Mac or Windows).

### Step 1: Import the Plugin Manifest
1. Open the **Figma Desktop App**.
2. Go to **Plugins** -> **Development** -> **Import plugin from manifest...** (or right-click canvas -> *Plugins* -> *Development* -> *Import plugin from manifest...*).
3. Select the [`figma-plugin/manifest.json`](manifest.json) file in this directory.

### Step 2: Obtain Credentials from Brand Muse
1. Open your Brand Kit in Brand Muse (`/kit/:kitId`).
2. Scroll to the **Export** section and find the **Figma Plugin Bridge** card.
3. Copy your **Brand Kit ID** and **Sync Access Token** (or make the kit public).

### Step 3: Synchronize Tokens
1. In Figma, run **Brand Muse · Token Sync** from the Plugins menu.
2. Paste your **Brand Kit ID** and **Sync Access Token**.
3. Set your API Host URL (defaults to `http://localhost:5173` for local development, or your production deployment URL).
4. Click **[ SYNC FIGMA VARIABLES ]** to generate all Local Variables and Text Styles.
5. Click **[ INSERT LOGOS ]** to place scalable vector brand logos directly onto your canvas.

---

## REST Synchronization API

The plugin communicates with the Brand Muse cloud via a secure REST endpoint:

```http
GET /api/v1/kits/:kitId/tokens?token=:shareToken
```

### Headers
- `Content-Type: application/json`
- `Authorization: Bearer <shareToken>` (optional if `token` query param is provided)

### Response Payload Structure
```json
{
  "version": "1.0.0",
  "kitId": "123e4567-e89b-12d3-a456-426614174000",
  "kitName": "Kyoto Ink Works",
  "updatedAt": "2026-09-23T00:00:00.000Z",
  "hash": "e4f8a19b",
  "dtcg": {
    "color": {
      "primary": {
        "$value": "#0A0A0A",
        "$type": "color",
        "$description": "primary · Sumi Black"
      }
    },
    "font": {
      "font-display": {
        "$value": "Cormorant Garamond",
        "$type": "fontFamily"
      }
    },
    "dimension": {
      "spacing-md": {
        "$value": "16px",
        "$type": "dimension"
      }
    }
  },
  "figmaVariables": {
    "collections": [
      {
        "name": "Kyoto Ink Works / Colors",
        "modes": ["Default"],
        "variables": [
          {
            "name": "color/primary",
            "type": "COLOR",
            "valuesByMode": {
              "Default": { "r": 0.039, "g": 0.039, "b": 0.039, "a": 1 }
            },
            "hex": "#0A0A0A"
          }
        ]
      }
    ],
    "textStyles": [
      {
        "name": "Display / H1 (Display)",
        "fontFamily": "Cormorant Garamond",
        "fontStyle": "Bold",
        "fontSize": 48
      }
    ],
    "logos": [
      {
        "kind": "logo-vector",
        "url": "https://...",
        "name": "Kyoto Ink Works - logo-vector"
      }
    ]
  }
}
```

---

## Compiling from TypeScript

The pre-compiled `code.js` is included in this repository so no build step is strictly required. To modify and recompile the plugin controller:

```bash
npx tsc -p figma-plugin
```
