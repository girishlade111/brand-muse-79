// Brand Muse QA — Popup Controller
import { generateJsonReport, generatePrintableHtmlReport } from "../lib/report";
import type { AuditSummary, BrandKitData, ExtensionMessage } from "../lib/types";

// State
let activeKit: BrandKitData | null = null;
let currentSummary: AuditSummary | null = null;
let highlightsEnabled = true;

// DOM Elements
const connectCard = document.getElementById("connect-card")!;
const activeKitCard = document.getElementById("active-kit-card")!;
const auditActionCard = document.getElementById("audit-action-card")!;
const resultsCard = document.getElementById("results-card")!;
const connectionBadge = document.getElementById("connection-status-badge")!;

const kitInput = document.getElementById("kit-input") as HTMLInputElement;
const hostInput = document.getElementById("host-input") as HTMLInputElement;
const btnConnect = document.getElementById("btn-connect") as HTMLButtonElement;
const connectError = document.getElementById("connect-error")!;
const btnDisconnect = document.getElementById("btn-disconnect") as HTMLButtonElement;

const activeKitName = document.getElementById("active-kit-name")!;
const paletteSwatches = document.getElementById("palette-swatches")!;
const fontChips = document.getElementById("font-chips")!;

const btnAudit = document.getElementById("btn-audit") as HTMLButtonElement;
const toggleHighlights = document.getElementById("toggle-highlights") as HTMLInputElement;

const scoreOverall = document.getElementById("score-overall")!;
const scoreColor = document.getElementById("score-color")!;
const scoreFont = document.getElementById("score-font")!;
const scoreContrast = document.getElementById("score-contrast")!;

const countOffbrandColors = document.getElementById("count-offbrand-colors")!;
const countUnapprovedFonts = document.getElementById("count-unapproved-fonts")!;
const countContrastFailures = document.getElementById("count-contrast-failures")!;

const btnExportJson = document.getElementById("btn-export-json") as HTMLButtonElement;
const btnExportPdf = document.getElementById("btn-export-pdf") as HTMLButtonElement;

/**
 * Initialize popup state from chrome.storage.local
 */
async function init(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return;
  }

  const data = await chrome.storage.local.get([
    "brandMuseActiveKit",
    "brandMuseHost",
    "brandMuseLastSummary",
    "brandMuseHighlightsEnabled",
  ]);

  if (data.brandMuseHost) {
    hostInput.value = data.brandMuseHost;
  }

  if (data.brandMuseHighlightsEnabled !== undefined) {
    highlightsEnabled = Boolean(data.brandMuseHighlightsEnabled);
    toggleHighlights.checked = highlightsEnabled;
  } else {
    toggleHighlights.checked = true;
  }

  if (data.brandMuseActiveKit) {
    activeKit = data.brandMuseActiveKit;
    renderConnectedKit(activeKit!);
  }

  if (data.brandMuseLastSummary) {
    currentSummary = data.brandMuseLastSummary;
    renderResults(currentSummary!);
  }
}

/**
 * Parses user input to extract kitId or shareToken.
 * Can be a UUID, shareToken string, or full URL (e.g. http://localhost:5173/share/xyz).
 */
function parseKitInput(raw: string): { identifier: string; isShareUrl: boolean } {
  const trimmed = raw.trim();
  if (trimmed.includes("/share/")) {
    const parts = trimmed.split("/share/");
    const token = parts[1]?.split("?")[0]?.replace(/\/$/, "");
    return { identifier: token, isShareUrl: true };
  }
  if (trimmed.includes("/kit/")) {
    const parts = trimmed.split("/kit/");
    const id = parts[1]?.split("?")[0]?.replace(/\/$/, "");
    return { identifier: id, isShareUrl: false };
  }
  return { identifier: trimmed, isShareUrl: false };
}

/**
 * Connect to Brand Muse REST API and fetch kit definition.
 */
async function handleConnect(): Promise<void> {
  const rawInput = kitInput.value.trim();
  const host = hostInput.value.trim().replace(/\/$/, "");

  if (!rawInput) {
    showError("Please enter a Kit ID or Share Token.");
    return;
  }

  btnConnect.disabled = true;
  btnConnect.innerHTML = "<span>Connecting...</span>";
  connectError.style.display = "none";

  try {
    const { identifier } = parseKitInput(rawInput);
    const endpoint = `${host}/api/v1/kits/${encodeURIComponent(identifier)}`;

    const res = await fetch(endpoint, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Failed to fetch kit (HTTP ${res.status})`);
    }

    const kit: BrandKitData = await res.json();
    if (!kit || !kit.colors) {
      throw new Error("Invalid Brand Kit response payload.");
    }

    activeKit = kit;
    await chrome.storage.local.set({
      brandMuseActiveKit: kit,
      brandMuseHost: host,
    });

    renderConnectedKit(kit);
  } catch (err: any) {
    showError(err.message || "Network error while connecting to Brand Muse.");
  } finally {
    btnConnect.disabled = false;
    btnConnect.innerHTML = "<span>🔗 Connect & Sync Kit</span>";
  }
}

/**
 * Renders connected brand kit details in popup.
 */
function renderConnectedKit(kit: BrandKitData): void {
  connectCard.classList.add("hidden");
  activeKitCard.classList.remove("hidden");
  auditActionCard.classList.remove("hidden");

  connectionBadge.textContent = "Connected";
  connectionBadge.classList.add("connected");
  activeKitName.textContent = kit.name || "Brand Kit";

  // Render palette swatches
  paletteSwatches.innerHTML = "";
  for (const c of kit.colors || []) {
    const swatch = document.createElement("div");
    swatch.className = "swatch";
    swatch.style.backgroundColor = c.hex;
    swatch.title = `${c.hex}${c.role ? ` (${c.role})` : ""}`;
    paletteSwatches.appendChild(swatch);
  }

  // Render font chips
  fontChips.innerHTML = "";
  for (const f of kit.fonts || []) {
    const chip = document.createElement("div");
    chip.className = "font-chip";
    chip.textContent = `${f.family}${f.role ? ` (${f.role})` : ""}`;
    fontChips.appendChild(chip);
  }
}

/**
 * Disconnect current brand kit.
 */
async function handleDisconnect(): Promise<void> {
  activeKit = null;
  currentSummary = null;

  await chrome.storage.local.remove(["brandMuseActiveKit", "brandMuseLastSummary"]);

  // Clear overlays from active tab
  await sendTabMessage({ type: "CLEAR_HIGHLIGHTS" });

  connectCard.classList.remove("hidden");
  activeKitCard.classList.add("hidden");
  auditActionCard.classList.add("hidden");
  resultsCard.classList.add("hidden");

  connectionBadge.textContent = "Not Connected";
  connectionBadge.classList.remove("connected");
}

/**
 * Execute audit on active tab.
 */
async function handleAudit(): Promise<void> {
  if (!activeKit) {
    showError("No brand kit connected.");
    return;
  }

  btnAudit.disabled = true;
  btnAudit.innerHTML = "<span>Scanning Page DOM...</span>";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("Unable to identify active browser tab.");
    }

    // Ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
    } catch {
      // Content script already injected
    }

    // Send AUDIT_REQUEST
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "AUDIT_REQUEST",
      payload: {
        kit: activeKit,
        enableHighlights: highlightsEnabled,
      },
    });

    if (response?.error) {
      throw new Error(response.error);
    }

    if (response?.summary) {
      currentSummary = response.summary;
      await chrome.storage.local.set({ brandMuseLastSummary: currentSummary });
      renderResults(currentSummary!);

      // Update badge
      chrome.runtime.sendMessage({
        type: "UPDATE_BADGE",
        tabId: tab.id,
        count: currentSummary!.totalViolations,
      });
    }
  } catch (err: any) {
    alert(`Audit Error: ${err.message || "Failed to inspect tab"}`);
  } finally {
    btnAudit.disabled = false;
    btnAudit.innerHTML = "<span>🔍 Audit Active Tab</span>";
  }
}

/**
 * Renders scorecard metrics in popup.
 */
function renderResults(summary: AuditSummary): void {
  resultsCard.classList.remove("hidden");

  scoreOverall.textContent = `${summary.overallScore}%`;
  scoreColor.textContent = `${summary.colorScore}%`;
  scoreFont.textContent = `${summary.typographyScore}%`;
  scoreContrast.textContent = `${summary.contrastScore}%`;

  // Color score circle
  const circle = document.getElementById("score-circle")!;
  const color =
    summary.overallScore >= 90 ? "#10B981" : summary.overallScore >= 70 ? "#F59E0B" : "#EF4444";
  circle.style.borderColor = color;
  scoreOverall.style.color = color;

  countOffbrandColors.textContent = String(summary.offBrandColorCount);
  countUnapprovedFonts.textContent = String(summary.unapprovedFontCount);
  countContrastFailures.textContent = String(summary.contrastFailureCount);
}

/**
 * Helper to send messages to active tab.
 */
async function sendTabMessage(message: ExtensionMessage): Promise<any> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch {
      // Tab may not have content script running
    }
  }
  return null;
}

/**
 * Handles toggle highlights.
 */
async function handleToggleHighlights(): Promise<void> {
  highlightsEnabled = toggleHighlights.checked;
  await chrome.storage.local.set({ brandMuseHighlightsEnabled: highlightsEnabled });

  await sendTabMessage({
    type: "TOGGLE_HIGHLIGHTS",
    payload: {
      enabled: highlightsEnabled,
      summary: currentSummary,
    },
  });
}

/**
 * Download JSON audit report.
 */
function handleExportJson(): void {
  if (!currentSummary) return;

  const jsonStr = generateJsonReport(currentSummary);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const hostname = new URL(currentSummary.url || "https://example.com").hostname.replace(/\./g, "_");
  const a = document.createElement("a");
  a.href = url;
  a.download = `brand-muse-audit-${hostname}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Open 1-Page PDF / Printable Report in a new browser tab.
 */
function handleExportPdf(): void {
  if (!currentSummary) return;

  const html = generatePrintableHtmlReport(currentSummary);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  chrome.tabs.create({ url });
}

function showError(msg: string): void {
  connectError.textContent = msg;
  connectError.style.display = "block";
}

// Event Listeners
btnConnect.addEventListener("click", handleConnect);
btnDisconnect.addEventListener("click", handleDisconnect);
btnAudit.addEventListener("click", handleAudit);
toggleHighlights.addEventListener("change", handleToggleHighlights);
btnExportJson.addEventListener("click", handleExportJson);
btnExportPdf.addEventListener("click", handleExportPdf);

// Start
init();
