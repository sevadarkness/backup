// ChatBackup - Content Script (ISOLATED)
// - Injects extractor.js into MAIN world
// - Uses bridge to load full history via WAWeb*
// - Differentiates sender/receiver and downloads images
(function () {
  "use strict";

  if (window.__chatbackup_content_loaded__) return;
  window.__chatbackup_content_loaded__ = true;

  const BRIDGE_NS = "chatbackup_bridge_v1";

  const SEL = {
    SIDE: "#pane-side",
    HEADER: '#main header, header[data-testid="conversation-header"]',
    HEADER_TITLE: '#main header span[dir="auto"], #main header span[title], [data-testid="conversation-title"]',
    HEADER_SUBTITLE: '#main header span[title] + span, [data-testid="conversation-info-header-chat-subtitle"]',
    AVATAR: '#main header img[draggable="false"], [data-testid="conversation-panel-header"] img',
    QR: 'canvas[aria-label*="QR"], [data-ref="qr-code"], [data-testid="qrcode"], [data-testid="qrcode-canvas"]'
  };

  // Inject JSZip into MAIN world
  function injectJSZip() {
    const id = "__chatbackup_jszip__";
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = chrome.runtime.getURL("libs/jszip.min.js");
    s.onload = () => console.log('[ChatBackup] JSZip carregado no mundo MAIN');
    s.onerror = () => console.error('[ChatBackup] Falha ao carregar JSZip');
    (document.head || document.documentElement).appendChild(s);
  }

  // Inject extractor.js once
  function inject() {
    const id = "__chatbackup_extractor__";
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = chrome.runtime.getURL("content/extractor.js");
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  }
  
  // Inject both JSZip and extractor
  injectJSZip();
  inject();

  function isVisible(el) {
    if (!el) return false;
    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 10 && r.height > 10;
  }

  function checkConnected() {
    const side = document.querySelector(SEL.SIDE);
    if (!side) return false;
    const qr = document.querySelector(SEL.QR);
    // Only treat as disconnected if QR is visible
    if (qr && isVisible(qr)) return false;
    return true;
  }

  function detectCurrentChat() {
    // Try multiple selectors for header
    const header = document.querySelector('#main header') || 
                   document.querySelector('[data-testid="conversation-header"]');
    if (!header) return null;
    
    // Buscar nome em vários lugares possíveis
    const titleEl = header.querySelector('span[dir="auto"]') ||
                    header.querySelector('span[title]') ||
                    header.querySelector('[data-testid="conversation-title"]');
    
    const name = titleEl?.getAttribute("title") || 
                 titleEl?.textContent?.trim() || 
                 "";
    
    if (!name) return null;

    // Detectar se é grupo
    const subtitle = header.querySelector('span[title] + span') ||
                     header.querySelector('[data-testid="conversation-info-header-chat-subtitle"]');
    const isGroup = subtitle?.textContent?.includes(",") || 
                    subtitle?.textContent?.includes("participantes") ||
                    subtitle?.textContent?.includes("participants");
    
    // Buscar avatar com múltiplos seletores
    const avatarEl = header.querySelector('img[draggable="false"]') ||
                     header.querySelector('img');
    const avatar = avatarEl?.src || null;

    return { name, isGroup, avatar };
  }

  async function getEnhancedChatInfo() {
    const basicInfo = detectCurrentChat();
    if (!basicInfo) return null;

    // Try to get additional info from bridge (including profile pic)
    try {
      const chatInfo = await bridge.getChatInfo();
      if (chatInfo?.profilePic) {
        return { ...basicInfo, avatar: chatInfo.profilePic };
      }
    } catch (e) {
      // Ignore errors, use basic info
    }

    return basicInfo;
  }

  class Bridge {
    constructor(onEvent) {
      this.pending = new Map();
      this.onEvent = onEvent;

      window.addEventListener("message", (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.ns !== BRIDGE_NS) return;

        if (data.dir === "evt" && data.type) {
          try { this.onEvent?.(data.type, data.payload); } catch {}
          return;
        }

        if (data.dir === "res" && data.id) {
          const p = this.pending.get(data.id);
          if (!p) return;
          this.pending.delete(data.id);
          if (data.ok) p.resolve(data.result);
          else p.reject(new Error(data.error || "bridge_error"));
        }
      });
    }

    request(action, payload, timeoutMs = 120000) {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const msg = { ns: BRIDGE_NS, dir: "req", id, action, payload };
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error("bridge_timeout"));
        }, timeoutMs);
        this.pending.set(id, {
          resolve: (v) => { clearTimeout(t); resolve(v); },
          reject: (e) => { clearTimeout(t); reject(e); }
        });
        window.postMessage(msg, "*");
      });
    }

    ping() { return this.request("ping", {}, 8000); }
    setCancel(cancel) { return this.request("setCancel", { cancel: !!cancel }, 4000); }
    getActiveChatMessages(opts, timeoutMs) { return this.request("getActiveChatMessages", opts || {}, timeoutMs || 300000); }
    downloadImageDataUrl(msgId, timeoutMs) { return this.request("downloadImageDataUrl", { msgId }, timeoutMs || 30000); }
    getChatInfo() { return this.request("getChatInfo", {}, 8000); }
  }

  let cancelRequested = false;
  let exporting = false;
  let currentChatCache = null;

  const bridge = new Bridge((type, payload) => {
    if (!exporting) return;
    if (type === "waLoadProgress") {
      const loaded = payload?.loaded ?? 0;
      const target = payload?.target ?? 0;
      const attempt = payload?.attempt ?? 0;
      const maxLoads = payload?.maxLoads ?? 1;

      let percent = 5;
      if (payload?.phase === "tick") {
        percent = Math.min(80, 5 + Math.round((attempt / Math.max(maxLoads, 1)) * 75));
      } else if (payload?.phase === "final") {
        percent = 85;
      }
      chrome.runtime.sendMessage({ type: "progress", current: loaded, total: target, percent, status: `Carregando histórico... (${loaded} msgs)` });
    }
  });

  // Listener immediate for background/popup ping
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      if (msg.action === "ping") {
        sendResponse({ pong: true });
        return true;
      }
      if (msg.action === "getStatus") {
        (async () => {
          const connected = checkConnected();
          let chat = detectCurrentChat();
          
          // Try to get enhanced info with profile pic
          if (chat) {
            try {
              const enhanced = await getEnhancedChatInfo();
              if (enhanced) chat = enhanced;
            } catch (e) {
              // Use basic chat info
            }
          }
          
          currentChatCache = chat || currentChatCache;
          sendResponse({
            connected,
            currentChat: chat || currentChatCache,
            stats: { total: 0, media: 0, links: 0, docs: 0 },
            message: connected ? "Conectado" : "WhatsApp não conectado (faça login no QR Code)"
          });
        })();
        return true;
      }
      if (msg.action === "cancelExport") {
        cancelRequested = true;
        bridge.setCancel(true).catch(() => {});
        sendResponse({ cancelled: true });
        return true;
      }
      if (msg.action === "startExport") {
        startExport(msg.settings).then(() => {}).catch(() => {});
        sendResponse({ started: true });
        return true;
      }
    } catch (e) {
      sendResponse({ error: String(e?.message || e) });
      return true;
    }
    sendResponse({ error: "unknown_action" });
    return true;
  });

  async function startExport(settings) {
    if (exporting) return;
    exporting = true;
    cancelRequested = false;
    await bridge.setCancel(false).catch(() => {});
    document.documentElement.classList.add("chatbackup-exporting");

    try {
      const chat = detectCurrentChat();
      if (!chat) throw new Error("Abra uma conversa (clique em um chat) antes de exportar.");
      currentChatCache = chat;
      chrome.runtime.sendMessage({ type: "chatUpdate", chat });

      // Ensure bridge ready
      await bridge.ping();

      const wantAll = settings.messageLimit === -1;
      const hardCap = 100000;
      const limit = wantAll ? -1 : Math.min(Number(settings.messageLimit) || 1000, hardCap);

      // heavier loads for all
      const maxLoads = wantAll ? 8000 : 1200;
      const delayMs = wantAll ? 900 : 650;

      chrome.runtime.sendMessage({ type: "progress", current: 0, total: wantAll ? hardCap : (limit || 0), percent: 2, status: "Buscando mensagens (API interna)..." });

      const wa = await bridge.getActiveChatMessages({ limit, maxLoads, delayMs }, wantAll ? 360000 : 120000);
      if (!wa?.ok || !Array.isArray(wa.messages) || wa.messages.length === 0) {
        throw new Error("Falha ao obter mensagens via API interna. Abra a conversa e tente novamente.");
      }

      const normalized = normalizeWAMessages(wa.messages, settings, chat);
      chrome.runtime.sendMessage({ type: "progress", current: normalized.length, total: wa.target || 0, percent: 88, status: "Processando mensagens..." });

      if (settings.includeMedia) {
        await processImages(normalized, settings, chat);
      }

      chrome.runtime.sendMessage({ type: "progress", current: normalized.length, total: wa.target || 0, percent: 94, status: "Gerando arquivo..." });

      await generateExport(normalized, settings, chat);

      chrome.runtime.sendMessage({ type: "complete", count: normalized.length });
    } catch (e) {
      chrome.runtime.sendMessage({ type: "error", error: String(e?.message || e) });
    } finally {
      document.documentElement.classList.remove("chatbackup-exporting");
      exporting = false;
    }
  }

  function normalizeWAMessages(messages, settings, chat) {
    const out = [];
    const otherName = chat?.name || "Contato";
    
    // Parse date filters
    let fromDate = null;
    let toDate = null;
    if (settings.dateFrom) {
      fromDate = new Date(settings.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
    }
    if (settings.dateTo) {
      toDate = new Date(settings.dateTo);
      toDate.setHours(23, 59, 59, 999);
    }

    for (const m of messages) {
      if (cancelRequested) break;

      const ts = (typeof m.t === "number") ? new Date(m.t * 1000) : null;
      
      // Apply date filter
      if (ts && fromDate && ts < fromDate) continue;
      if (ts && toDate && ts > toDate) continue;
      
      const timestamp = settings.includeTimestamps && ts ? ts.toLocaleString("pt-BR") : "";

      const isOutgoing = !!m.fromMe;
      const sender = settings.includeSender ? (isOutgoing ? "Você" : (m.sender || otherName)) : "";

      const type = String(m.type || "chat");
      let text = m.text || "";
      let media = null;

      if (settings.includeMedia && (type === "image" || type === "sticker" || type === "video" || type === "audio" || type === "ptt" || type === "document")) {
        media = { type, msgId: m.id || null, dataUrl: null, fileName: null, failed: false, mimetype: m.mimetype || null };
        if (!text) text = `[${type}]`;
      }

      // Skip empty
      if (!text && !media) continue;

      out.push({ id: m.id || null, timestamp, sender, text, isOutgoing, media });
    }
    return out;
  }

  function sanitizeFilename(name) {
    return String(name || "file").replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_").slice(0, 180);
  }
  
  function extractMimeFromDataUrl(dataUrl) {
    const parts = String(dataUrl).split(",");
    const meta = parts[0] || "";
    return (meta.match(/data:([^;]+);/i) || [])[1] || "application/octet-stream";
  }

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl).split(",");
    const meta = parts[0] || "";
    const b64 = parts[1] || "";
    const mime = extractMimeFromDataUrl(dataUrl);
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function extFromMime(mime, mediaType) {
    const m = String(mime || "").toLowerCase();
    // Images
    if (m.includes("png")) return "png";
    if (m.includes("webp")) return "webp";
    if (m.includes("gif")) return "gif";
    if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
    // Videos
    if (m.includes("mp4")) return "mp4";
    if (m.includes("webm")) return "webm";
    if (m.includes("3gpp")) return "3gp";
    // Audio
    if (m.includes("ogg")) return "ogg";
    if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
    if (m.includes("opus")) return "opus";
    if (m.includes("aac")) return "aac";
    // Documents
    if (m.includes("pdf")) return "pdf";
    if (m.includes("msword") || m.includes("doc")) return "doc";
    if (m.includes("spreadsheet") || m.includes("xls")) return "xls";
    if (m.includes("presentation") || m.includes("ppt")) return "ppt";
    if (m.includes("zip")) return "zip";
    if (m.includes("rar")) return "rar";
    
    // Fallback based on media type
    if (mediaType === "video") return "mp4";
    if (mediaType === "audio" || mediaType === "ptt") return "ogg";
    if (mediaType === "document") return "pdf";
    if (mediaType === "image" || mediaType === "sticker") return "jpg";
    
    return "bin";
  }

  async function downloadBlob(blob, fileName) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      chrome.runtime.sendMessage({ action: "download", url, fileName }, () => {
        URL.revokeObjectURL(url);
        resolve();
      });
    });
  }

  async function processImages(messages, settings, chat) {
    // Support image, sticker, video, audio, ptt (voice messages), document
    const list = messages.filter(m => m.media && 
      (m.media.type === "image" || m.media.type === "sticker" || 
       m.media.type === "video" || m.media.type === "audio" || 
       m.media.type === "ptt" || m.media.type === "document") && 
      m.media.msgId);
    if (!list.length) return;

    const wantFiles = !!settings.downloadMediaFiles;
    const wantInline = settings.format === "html";
    const inlineTypes = ['image', 'sticker', 'video', 'audio', 'ptt'];

    const MAX_INLINE_TOTAL = 25 * 1024 * 1024; // ~25MB
    let inlineTotal = 0;
    let successCount = 0;
    let failCount = 0;

    const LIMIT_MEDIA = 5000; // safety
    const work = list.slice(0, LIMIT_MEDIA);

    for (let i = 0; i < work.length; i++) {
      if (cancelRequested) break;

      const msg = work[i];
      const pct = 88 + Math.round((i / Math.max(work.length, 1)) * 5);
      chrome.runtime.sendMessage({ 
        type: "progress", 
        current: i + 1, 
        total: work.length, 
        percent: Math.min(pct, 93), 
        status: `Baixando mídias... (${i+1}/${work.length}, ✓${successCount} ✗${failCount})` 
      });

      let res = null;
      try {
        res = await bridge.downloadImageDataUrl(msg.media.msgId, 30000);
      } catch {
        res = null;
      }

      if (res?.ok && res.dataUrl) {
        const mime = res.mime || (String(res.dataUrl).match(/^data:([^;]+);/i)?.[1]) || "application/octet-stream";
        const ext = extFromMime(mime, msg.media.type);
        const baseName = sanitizeFilename(`${chat.name}_${i+1}`);
        const fileName = `${baseName}_${msg.media.msgId}.${ext}`;
        msg.media.fileName = fileName;
        msg.media.mimetype = mime;

        // Always store dataUrl for ZIP generation (if media is included)
        // We'll use it to create the ZIP file
        msg.media.dataUrl = res.dataUrl;

        // download file separately if requested (in addition to ZIP)
        if (wantFiles) {
          try {
            const blob = dataUrlToBlob(res.dataUrl);
            await downloadBlob(blob, fileName);
          } catch {
            // ignore
          }
        }
        
        successCount++;
      } else {
        msg.media.failed = true;
        failCount++;
      }

      if (i % 10 === 0) await new Promise(r => setTimeout(r, 80));
    }
    
    // Final progress update with summary (percent matches loop calculation)
    const finalPct = Math.min(88 + Math.round((work.length / Math.max(work.length, 1)) * 5), 93);
    chrome.runtime.sendMessage({ 
      type: "progress", 
      current: work.length, 
      total: work.length, 
      percent: finalPct, 
      status: `Mídias processadas: ${successCount} sucesso, ${failCount} falhas` 
    });
  }

  async function generateExport(messages, settings, chat) {
    const stamp = new Date().toISOString().slice(0, 10);
    const base = sanitizeFilename(`${chat.name}_${stamp}`);
    
    // Check if we have media that needs to be bundled
    const hasMediaFiles = settings.includeMedia && messages.some(m => m.media && m.media.dataUrl);

    // If we have media files, create a ZIP
    if (hasMediaFiles) {
      await generateZipExport(messages, settings, chat, base);
    } else {
      // Standard single-file export
      let content = "";
      let mime = "text/plain;charset=utf-8";
      let ext = "txt";

      if (settings.format === "csv") {
        ({ content, mime, ext } = { content: generateCSV(messages, settings), mime: "text/csv;charset=utf-8", ext: "csv" });
      } else if (settings.format === "json") {
        ({ content, mime, ext } = { content: JSON.stringify({ chatName: chat.name, exportDate: new Date().toISOString(), messageCount: messages.length, messages }, null, 2), mime: "application/json;charset=utf-8", ext: "json" });
      } else if (settings.format === "html") {
        ({ content, mime, ext } = { content: generateHTML(messages, settings, chat), mime: "text/html;charset=utf-8", ext: "html" });
      } else {
        ({ content, mime, ext } = { content: generateTXT(messages, settings, chat), mime: "text/plain;charset=utf-8", ext: "txt" });
      }

      await downloadBlob(new Blob([content], { type: mime }), `${base}.${ext}`);
    }
  }

  async function generateZipExport(messages, settings, chat, baseName) {
    try {
      // Use the extractor (MAIN world) to generate ZIP
      const result = await bridge.request("generateZip", {
        messages: messages.map(m => ({
          id: m.id,
          timestamp: m.timestamp,
          sender: m.sender,
          text: m.text,
          isOutgoing: m.isOutgoing,
          type: m.media?.type || 'chat',
          mediaBase64: m.media?.dataUrl || null,
          mimetype: m.media?.mimetype || null,
          fileName: m.media?.fileName || null
        })),
        chatName: chat.name
      }, 60000);
      
      if (result.ok && result.dataUrl) {
        // Download the ZIP
        const blob = dataUrlToBlob(result.dataUrl);
        await downloadBlob(blob, result.filename);
        return;
      } else {
        throw new Error(result.error || 'Falha ao gerar ZIP');
      }
    } catch (e) {
      console.error('[ChatBackup] Falha ao gerar ZIP:', e);
      // Fallback to regular HTML export
      const content = generateHTML(messages, settings, chat);
      await downloadBlob(new Blob([content], { type: 'text/html;charset=utf-8' }), `${baseName}.html`);
    }
  }

  function escCSV(s) { return String(s || "").replace(/"/g, '""').replace(/\n/g, " "); }
  function escHTML(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function generateCSV(messages, settings) {
    const headers = [];
    if (settings.includeTimestamps) headers.push("Data/Hora");
    if (settings.includeSender) headers.push("Remetente");
    headers.push("Mensagem");
    headers.push("Tipo");
    if (settings.includeMedia) headers.push("Mídia");

    const rows = [headers.join(",")];
    for (const m of messages) {
      const cols = [];
      if (settings.includeTimestamps) cols.push(`"${escCSV(m.timestamp)}"`);
      if (settings.includeSender) cols.push(`"${escCSV(m.sender)}"`);
      cols.push(`"${escCSV(m.text)}"`);
      cols.push(m.isOutgoing ? "Enviada" : "Recebida");
      if (settings.includeMedia) {
        const mediaInfo = m.media ? (m.media.fileName || m.media.type) : "";
        cols.push(escCSV(mediaInfo));
      }
      rows.push(cols.join(","));
    }
    return "\uFEFF" + rows.join("\n");
  }

  function generateTXT(messages, settings, chat) {
    const lines = [
      `Exportação do WhatsApp - ${chat.name}`,
      `Data: ${new Date().toLocaleString("pt-BR")}`,
      `Total: ${messages.length} mensagens`,
      "=".repeat(50),
      ""
    ];
    for (const m of messages) {
      let line = "";
      if (settings.includeTimestamps && m.timestamp) line += `[${m.timestamp}] `;
      if (settings.includeSender && m.sender) line += `${m.sender}: `;
      line += m.text || "";
      if (m.media) {
        const mediaInfo = m.media.fileName ? `${m.media.type}: ${m.media.fileName}` : m.media.type;
        line += ` [${mediaInfo}]`;
      }
      lines.push(line);
    }
    return lines.join("\n");
  }

  function generateHTML(messages, settings, chat) {
    let htmlMsgs = "";
    for (const m of messages) {
      const cls = m.isOutgoing ? "out" : "in";
      let mediaHTML = "";
      if (settings.includeMedia && m.media) {
        if (m.media.dataUrl) {
          const safeDataUrl = escHTML(m.media.dataUrl);
          const safeMime = escHTML(m.media.mime || '');
          const safeFileName = escHTML(m.media.fileName || 'arquivo');
          if (m.media.type === "video") {
            mediaHTML = `<video class="video" controls><source src="${safeDataUrl}" type="${safeMime || 'video/mp4'}">Seu navegador não suporta vídeo.</video>`;
          } else if (m.media.type === "audio" || m.media.type === "ptt") {
            mediaHTML = `<audio class="audio" controls><source src="${safeDataUrl}" type="${safeMime || 'audio/ogg'}">Seu navegador não suporta áudio.</audio>`;
          } else if (m.media.type === "document") {
            mediaHTML = `<div class="media"><a href="${safeDataUrl}" download="${safeFileName}">📎 ${safeFileName}</a></div>`;
          } else {
            mediaHTML = `<img class="img" src="${safeDataUrl}" alt="imagem" />`;
          }
        } else {
          const label = m.media.failed ? `${m.media.type} (falhou)` : m.media.type;
          const fn = m.media.fileName ? ` — ${escHTML(m.media.fileName)}` : "";
          mediaHTML = `<div class="media">[${escHTML(label)}${fn}]</div>`;
        }
      }
      htmlMsgs += `
        <div class="msg ${cls}">
          ${settings.includeSender ? `<div class="sender">${escHTML(m.sender)}</div>` : ""}
          <div class="text">${escHTML(m.text)}</div>
          ${mediaHTML}
          ${settings.includeTimestamps ? `<div class="time">${escHTML(m.timestamp)}</div>` : ""}
        </div>
      `;
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WhatsApp - ${escHTML(chat.name)}</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#efeae2;margin:0;padding:18px}
    .wrap{max-width:860px;margin:0 auto}
    .head{background:#075E54;color:#fff;padding:16px;border-radius:12px}
    .head h1{margin:0;font-size:18px}
    .head p{margin:6px 0 0;font-size:12px;opacity:.85}
    .chat{margin-top:12px;padding:14px;background:rgba(255,255,255,.65);border-radius:12px}
    .msg{max-width:70%;padding:10px 12px;border-radius:10px;margin:8px 0;box-shadow:0 1px 0.5px rgba(0,0,0,.13)}
    .msg.in{background:#fff;margin-right:auto;border-top-left-radius:0}
    .msg.out{background:#DCF8C6;margin-left:auto;border-top-right-radius:0}
    .sender{font-weight:700;color:#075E54;font-size:12px;margin-bottom:2px}
    .text{font-size:14px;white-space:pre-wrap}
    .time{font-size:11px;color:#667781;text-align:right;margin-top:6px}
    .media{font-size:12px;color:#5a6b79;background:rgba(0,0,0,.05);padding:8px;border-radius:8px;margin-top:8px}
    .img{max-width:100%;border-radius:10px;margin-top:8px}
    .video{max-width:100%;border-radius:10px;margin-top:8px}
    .audio{width:100%;margin-top:8px}
    .foot{margin-top:12px;text-align:center;color:#667781;font-size:12px}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <h1>${escHTML(chat.name)}</h1>
      <p>Exportado em ${new Date().toLocaleString("pt-BR")} • ${messages.length} mensagens</p>
    </div>
    <div class="chat">${htmlMsgs}</div>
    <div class="foot">Exportado com ChatBackup • 100% local</div>
  </div>
</body>
</html>`;
  }
})();
