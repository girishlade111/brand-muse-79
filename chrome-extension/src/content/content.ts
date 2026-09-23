// Brand Muse QA — Content Script Entry Point
import { scanDocument } from "./dom-scanner";
import { toggleHighlights, clearOverlay } from "./overlay";
import type { AuditSummary, ExtensionMessage } from "../lib/types";

declare global {
  interface Window {
    __BRAND_MUSE_CONTENT_SCRIPT_INITIALIZED__?: boolean;
    __BRAND_MUSE_LAST_SUMMARY__?: AuditSummary;
  }
}

function initContentScript(): void {
  if (window.__BRAND_MUSE_CONTENT_SCRIPT_INITIALIZED__) {
    return;
  }
  window.__BRAND_MUSE_CONTENT_SCRIPT_INITIALIZED__ = true;

  // Listen for messages from extension popup or service worker
  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, _sender, sendResponse: (res: any) => void) => {
        try {
          switch (message.type) {
            case "AUDIT_REQUEST": {
              const kit = message.payload?.kit;
              if (!kit) {
                sendResponse({ error: "Missing Brand Kit data in audit request" });
                return true;
              }

              const summary = scanDocument(kit);
              window.__BRAND_MUSE_LAST_SUMMARY__ = summary;

              if (message.payload?.enableHighlights) {
                toggleHighlights(true, summary);
              }

              sendResponse({ summary });
              break;
            }

            case "TOGGLE_HIGHLIGHTS": {
              const enabled = Boolean(message.payload?.enabled);
              const summary = message.payload?.summary || window.__BRAND_MUSE_LAST_SUMMARY__;
              toggleHighlights(enabled, summary);
              sendResponse({ success: true, enabled });
              break;
            }

            case "CLEAR_HIGHLIGHTS": {
              clearOverlay();
              sendResponse({ success: true });
              break;
            }

            case "GET_STATUS": {
              sendResponse({
                hasAudit: Boolean(window.__BRAND_MUSE_LAST_SUMMARY__),
                summary: window.__BRAND_MUSE_LAST_SUMMARY__ || null,
              });
              break;
            }

            default:
              sendResponse({ error: "Unknown message type" });
              break;
          }
        } catch (err: any) {
          console.error("[Brand Muse Extension] Content script error:", err);
          sendResponse({ error: err?.message || "Internal content script error" });
        }
        return true; // Keep message channel open for async response
      },
    );
  }
}

initContentScript();
