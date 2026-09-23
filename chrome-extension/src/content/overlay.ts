// Interactive Live DOM Highlighting Overlay & Tooltip System
import type { AuditSummary, AuditViolation } from "../lib/types";

let overlayRoot: HTMLElement | null = null;
let currentSummary: AuditSummary | null = null;
let isHighlightsVisible = false;
const activeFixes = new Map<HTMLElement, { property: string; originalValue: string }>();

const OVERLAY_ID = "brand-muse-overlay-root";
const OUTLINE_CLASS = "brand-muse-offending-element";

/**
 * Initializes or retrieves the overlay root container.
 */
function getOrCreateOverlayRoot(): HTMLElement {
  let root = document.getElementById(OVERLAY_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = OVERLAY_ID;
    root.setAttribute("data-brand-muse-qa", "true");
    root.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483640;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    document.body.appendChild(root);
  }
  return root;
}

/**
 * Injects non-intrusive CSS styles for highlighted elements.
 */
function injectHighlightStyles(): void {
  const styleId = "brand-muse-highlight-styles";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    .${OUTLINE_CLASS} {
      outline: 2px dashed #EF4444 !important;
      outline-offset: 2px !important;
      transition: outline-color 0.2s ease, outline-width 0.2s ease !important;
      cursor: pointer !important;
    }
    .${OUTLINE_CLASS}:hover {
      outline: 2px solid #DC2626 !important;
      box-shadow: 0 0 12px rgba(239, 68, 68, 0.4) !important;
    }
    .${OUTLINE_CLASS}[data-bm-type="unapproved_font"] {
      outline-color: #F59E0B !important;
    }
    .${OUTLINE_CLASS}[data-bm-type="unapproved_font"]:hover {
      outline-color: #D97706 !important;
      box-shadow: 0 0 12px rgba(245, 158, 11, 0.4) !important;
    }
    .${OUTLINE_CLASS}[data-bm-type="wcag_contrast_failure"] {
      outline-color: #EC4899 !important;
    }
    .${OUTLINE_CLASS}[data-bm-type="wcag_contrast_failure"]:hover {
      outline-color: #DB2777 !important;
      box-shadow: 0 0 12px rgba(236, 72, 153, 0.4) !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Creates and attaches the floating tooltip next to an element.
 */
function showTooltip(el: HTMLElement, violation: AuditViolation): void {
  removeTooltip();

  const tooltip = document.createElement("div");
  tooltip.id = "brand-muse-active-tooltip";
  tooltip.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    background: #0F172A;
    color: #F8FAFC;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 12px 14px;
    width: 320px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    line-height: 1.4;
    pointer-events: auto;
    animation: bmFadeIn 0.15s ease-out;
  `;

  // Compute tooltip position
  const rect = el.getBoundingClientRect();
  let top = rect.bottom + 8;
  let left = rect.left;

  // Viewport boundary adjustments
  if (top + 220 > window.innerHeight) {
    top = Math.max(10, rect.top - 200);
  }
  if (left + 330 > window.innerWidth) {
    left = Math.max(10, window.innerWidth - 340);
  }

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;

  const badgeColor =
    violation.type === "off_brand_color"
      ? "#EF4444"
      : violation.type === "unapproved_font"
        ? "#F59E0B"
        : "#EC4899";

  const badgeTitle =
    violation.type === "off_brand_color"
      ? "OFF-BRAND COLOR"
      : violation.type === "unapproved_font"
        ? "UNAPPROVED FONT"
        : "WCAG CONTRAST FAILURE";

  const isColor = violation.type === "off_brand_color";

  tooltip.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <span style="background:${badgeColor}22; color:${badgeColor}; border:1px solid ${badgeColor}66; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700; letter-spacing:0.5px;">
        ${badgeTitle}
      </span>
      <button id="bm-close-tooltip" style="background:none; border:none; color:#94A3B8; font-size:16px; cursor:pointer; line-height:1; padding:0 4px;">&times;</button>
    </div>
    
    <div style="font-size:12px; color:#CBD5E1; margin-bottom:10px;">
      ${escapeHtml(violation.message)}
    </div>

    <div style="background:#1E293B; border-radius:6px; padding:8px 10px; margin-bottom:10px; font-size:12px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span style="color:#94A3B8;">Actual:</span>
        <span style="font-family:monospace; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
          ${isColor ? `<span style="width:10px; height:10px; border-radius:2px; background:${violation.actualValue}; border:1px solid #475569;"></span>` : ""}
          ${escapeHtml(violation.actualValue)}
        </span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:#94A3B8;">Suggested:</span>
        <span style="font-family:monospace; color:#34D399; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
          ${isColor ? `<span style="width:10px; height:10px; border-radius:2px; background:${violation.suggestedReplacement}; border:1px solid #475569;"></span>` : ""}
          ${escapeHtml(violation.suggestedReplacement)}
        </span>
      </div>
    </div>

    <div style="display:flex; gap:8px;">
      <button id="bm-preview-fix" style="flex:1; background:#10B981; color:#0F172A; border:none; border-radius:4px; padding:6px 10px; font-size:11px; font-weight:700; cursor:pointer;">
        ⚡ Preview Fix
      </button>
      <button id="bm-revert-fix" style="display:none; flex:1; background:#475569; color:#FFF; border:none; border-radius:4px; padding:6px 10px; font-size:11px; font-weight:700; cursor:pointer;">
        ↩ Revert
      </button>
    </div>
  `;

  document.body.appendChild(tooltip);

  // Close handler
  document.getElementById("bm-close-tooltip")?.addEventListener("click", (e) => {
    e.stopPropagation();
    removeTooltip();
  });

  // Preview fix handler
  const previewBtn = document.getElementById("bm-preview-fix") as HTMLButtonElement;
  const revertBtn = document.getElementById("bm-revert-fix") as HTMLButtonElement;

  if (activeFixes.has(el)) {
    previewBtn.style.display = "none";
    revertBtn.style.display = "block";
  }

  previewBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    applyLiveFix(el, violation);
    previewBtn.style.display = "none";
    revertBtn.style.display = "block";
  });

  revertBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    revertLiveFix(el);
    revertBtn.style.display = "none";
    previewBtn.style.display = "block";
  });
}

function removeTooltip(): void {
  const existing = document.getElementById("brand-muse-active-tooltip");
  if (existing) existing.remove();
}

/**
 * Previews a suggested brand replacement directly on the live DOM element.
 */
function applyLiveFix(el: HTMLElement, violation: AuditViolation): void {
  if (activeFixes.has(el)) return;

  const prop = violation.property;
  const originalValue = el.style.getPropertyValue(prop);
  activeFixes.set(el, { property: prop, originalValue });

  if (violation.type === "off_brand_color") {
    el.style.setProperty(prop, violation.suggestedReplacement, "important");
  } else if (violation.type === "unapproved_font") {
    el.style.setProperty(
      "font-family",
      `"${violation.suggestedReplacement}", sans-serif`,
      "important",
    );
  }
}

/**
 * Reverts live fix back to original inline style.
 */
function revertLiveFix(el: HTMLElement): void {
  const fix = activeFixes.get(el);
  if (!fix) return;
  if (fix.originalValue) {
    el.style.setProperty(fix.property, fix.originalValue);
  } else {
    el.style.removeProperty(fix.property);
  }
  activeFixes.delete(el);
}

/**
 * Floating HUD widget on the bottom right of the page.
 */
function createOrUpdateFloatingHud(summary: AuditSummary): void {
  const hudId = "brand-muse-floating-hud";
  let hud = document.getElementById(hudId);
  if (!hud) {
    hud = document.createElement("div");
    hud.id = hudId;
    hud.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483646;
      background: #0F172A;
      color: #F8FAFC;
      border: 1px solid #334155;
      border-radius: 28px;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -4px rgba(0,0,0,0.4);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      pointer-events: auto;
    `;
    document.body.appendChild(hud);
  }

  const scoreColor =
    summary.overallScore >= 90 ? "#10B981" : summary.overallScore >= 70 ? "#F59E0B" : "#EF4444";

  hud.innerHTML = `
    <div style="display:flex; align-items:center; gap:6px; font-weight:800; letter-spacing:-0.3px;">
      <span style="font-size:14px;">⚡</span>
      <span>Brand Muse QA</span>
    </div>
    <div style="width:1px; height:18px; background:#334155;"></div>
    <div style="display:flex; align-items:center; gap:6px;">
      <span style="font-size:12px; color:#94A3B8;">Score:</span>
      <span style="font-weight:900; color:${scoreColor};">${summary.overallScore}%</span>
    </div>
    <div style="width:1px; height:18px; background:#334155;"></div>
    <div style="font-size:12px; color:#CBD5E1;">
      <span style="color:#EF4444; font-weight:700;">${summary.totalViolations}</span> deviations
    </div>
    <button id="bm-hud-toggle" style="background:#1E293B; border:1px solid #475569; color:#F8FAFC; border-radius:14px; padding:4px 10px; font-size:11px; font-weight:600; cursor:pointer;">
      ${isHighlightsVisible ? "Hide Outlines" : "Show Outlines"}
    </button>
  `;

  document.getElementById("bm-hud-toggle")?.addEventListener("click", () => {
    toggleHighlights(!isHighlightsVisible);
    createOrUpdateFloatingHud(summary);
  });
}

/**
 * Toggles highlight borders on all offending elements.
 */
export function toggleHighlights(enabled: boolean, summary?: AuditSummary): void {
  isHighlightsVisible = enabled;
  injectHighlightStyles();

  if (summary) {
    currentSummary = summary;
  }

  // Remove existing highlights
  const highlighted = document.querySelectorAll(`.${OUTLINE_CLASS}`);
  highlighted.forEach((el) => {
    el.classList.remove(OUTLINE_CLASS);
    el.removeAttribute("data-bm-type");
  });

  removeTooltip();

  if (!enabled || !currentSummary) {
    return;
  }

  // Apply highlight class to all offending elements
  for (const violation of currentSummary.violations) {
    try {
      const el = document.querySelector<HTMLElement>(violation.selector);
      if (el && !el.closest(`#${OVERLAY_ID}`)) {
        el.classList.add(OUTLINE_CLASS);
        el.setAttribute("data-bm-type", violation.type);

        // Click to show tooltip
        el.onclick = (e) => {
          e.stopPropagation();
          showTooltip(el, violation);
        };
      }
    } catch {
      // Continue if selector error
    }
  }

  createOrUpdateFloatingHud(currentSummary);
}

/**
 * Clears all highlights and HUD elements from the page.
 */
export function clearOverlay(): void {
  const highlighted = document.querySelectorAll(`.${OUTLINE_CLASS}`);
  highlighted.forEach((el) => {
    el.classList.remove(OUTLINE_CLASS);
    el.removeAttribute("data-bm-type");
  });

  removeTooltip();

  document.getElementById("brand-muse-floating-hud")?.remove();
  document.getElementById(OVERLAY_ID)?.remove();

  // Revert active fixes
  activeFixes.forEach((_, el) => revertLiveFix(el));
  activeFixes.clear();

  isHighlightsVisible = false;
  currentSummary = null;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
