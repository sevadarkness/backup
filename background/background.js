// ChatBackup - Background (MV3)
// - Job start/cancel
// - Downloads
let currentJob = null;

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs?.[0]?.id ?? null;
}

function pingTab(tabId) {
  return new Promise((resolve) => {
    if (!tabId) return resolve({ ok: false, error: "no_tab" });
    chrome.tabs.sendMessage(tabId, { action: "ping" }, (resp) => {
      if (chrome.runtime.lastError) return resolve({ ok: false, error: chrome.runtime.lastError.message });
      resolve({ ok: !!resp?.pong });
    });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (msg.action === "download") {
      chrome.downloads.download({
        url: msg.url,
        filename: sanitizeFilename(msg.fileName),
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) sendResponse({ success: false, error: chrome.runtime.lastError.message });
        else sendResponse({ success: true, downloadId });
      });
      return true;
    }

    if (msg.action === "checkActiveWhatsApp") {
      (async () => {
        const tabId = await getActiveTabId();
        const ping = await pingTab(tabId);
        sendResponse({ success: ping.ok, tabId, error: ping.ok ? null : ping.error });
      })();
      return true;
    }

    if (msg.action === "startBackup") {
      (async () => {
        const tabId = await getActiveTabId();
        const ping = await pingTab(tabId);
        if (!ping.ok) {
          sendResponse({ success: false, error: "Abra o WhatsApp Web (web.whatsapp.com) e recarregue a página." });
          return;
        }

        currentJob = { tabId, canceled: false, startedAt: Date.now() };
        chrome.tabs.sendMessage(tabId, { action: "startExport", settings: msg.settings }, () => {});
        sendResponse({ success: true });
      })();
      return true;
    }

    if (msg.action === "cancelBackup") {
      (async () => {
        if (!currentJob?.tabId) {
          sendResponse({ success: false, error: "Nenhuma exportação ativa." });
          return;
        }
        currentJob.canceled = true;
        chrome.tabs.sendMessage(currentJob.tabId, { action: "cancelExport" }, () => {});
        sendResponse({ success: true });
      })();
      return true;
    }

    if (msg.action === "getContacts") {
      (async () => {
        const tabId = await getActiveTabId();
        const ping = await pingTab(tabId);
        if (!ping.ok) {
          sendResponse({ success: false, error: "Abra o WhatsApp Web (web.whatsapp.com) e recarregue a página." });
          return;
        }
        
        chrome.tabs.sendMessage(tabId, { action: "getContacts" }, (resp) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse(resp || { success: false, error: "No response" });
          }
        });
      })();
      return true;
    }

    sendResponse({ success: false, error: "unknown_action" });
    return true;
  } catch (e) {
    sendResponse({ success: false, error: String(e?.message || e) });
    return true;
  }
});

function sanitizeFilename(filename) {
  return String(filename || "chatbackup_export")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .substring(0, 200);
}
