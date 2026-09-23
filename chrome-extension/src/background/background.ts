// Brand Muse QA — Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Brand Muse QA] Extension installed and active.");
});

// Update extension badge when audit completes on an active tab
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "UPDATE_BADGE") {
    const tabId = sender.tab?.id || message.tabId;
    const count = message.count;

    if (tabId && chrome.action) {
      if (typeof count === "number" && count > 0) {
        chrome.action.setBadgeText({ tabId, text: String(count) });
        chrome.action.setBadgeBackgroundColor({ tabId, color: "#EF4444" });
      } else {
        chrome.action.setBadgeText({ tabId, text: "" });
      }
    }
    sendResponse({ success: true });
  }
  return true;
});
