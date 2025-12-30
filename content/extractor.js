// ChatBackup - Extractor (MAIN world)
// Bridge namespace
(function () {
  "use strict";

  if (window.__CHATBACKUP_BRIDGE_READY__) return;
  window.__CHATBACKUP_BRIDGE_READY__ = true;

  const BRIDGE_NS = "chatbackup_bridge_v1";
  window.__CHATBACKUP_CANCEL__ = false;

  const state = { ready: false, modules: {}, meta: { strategy: "unknown", loadedAt: Date.now() } };

  function emit(type, payload) {
    try { window.postMessage({ ns: BRIDGE_NS, dir: "evt", type, payload }, "*"); } catch {}
  }

  function tryRequire(name) {
    try {
      if (typeof window.require !== "function") return null;
      return window.require(name);
    } catch {
      return null;
    }
  }

  function loadModules() {
    const want = ["WAWebChatCollection", "WAWebCmd"];
    let found = 0;
    for (const n of want) {
      const mod = tryRequire(n);
      if (mod) { state.modules[n] = mod; found++; }
    }
    state.ready = found > 0;
    state.meta.strategy = found ? "global-require" : "none";
    try { console.log("[ChatBackup/Bridge] Ready:", state.meta.strategy, Object.keys(state.modules)); } catch {}
    emit("ready", { ok: state.ready, keys: Object.keys(state.modules), meta: state.meta });
  }

  function getChatCollection() {
    const CCmod = state.modules.WAWebChatCollection;
    return CCmod?.ChatCollection || CCmod?.default?.ChatCollection || CCmod?.ChatCollectionImpl || CCmod || null;
  }

  function getActiveChat() {
    const CC = getChatCollection();
    return CC?.getActive?.() || CC?.getActiveChat?.() || null;
  }

  function getMsgsArray(chat) {
    const msgs = chat?.msgs || chat?.msgCollection || chat?.__x_msgs || null;
    if (!msgs) return [];
    const arr = msgs.getModelsArray?.() || msgs.models?.slice?.() || msgs._models?.slice?.() || msgs._models || [];
    return Array.isArray(arr) ? arr : [];
  }

  function pickFromMe(msg) {
    return !!(msg?.fromMe ?? msg?.__x_fromMe ?? msg?.id?.fromMe ?? false);
  }

  function pickTimestamp(msg) {
    const t = msg?.t ?? msg?.__x_t ?? msg?.timestamp ?? null;
    return (typeof t === "number") ? t : null; // seconds
  }

  function pickType(msg) {
    const t = msg?.type || msg?.__x_type || msg?.mediaType || "chat";
    return String(t || "chat");
  }

  function pickText(msg) {
    const t = msg?.body ?? msg?.__x_body ?? msg?.caption ?? msg?.text ?? "";
    return String(t || "");
  }

  function pickSenderName(msg) {
    try {
      if (pickFromMe(msg)) return "Você";
      const author = msg?.author || msg?.sender || msg?.senderObj || msg?.__x_author || null;
      const name = author?.pushname || author?.name || author?.formattedName || msg?.notifyName || msg?.senderName || "";
      return String(name || "Contato");
    } catch {
      return "Contato";
    }
  }

  async function tryLoadEarlier(chat) {
    // Many builds expose one of these
    const fns = [
      chat?.loadEarlierMsgs,
      chat?.msgs?.loadEarlierMsgs,
      chat?.msgs?.loadEarlierMsgs?.bind(chat?.msgs),
    ].filter(fn => typeof fn === "function");

    for (const fn of fns) {
      try {
        const r = fn();
        if (r && typeof r.then === "function") await r;
        return true;
      } catch {}
    }
    return false;
  }

  function uiNudgeScrollTop() {
    const sels = [
      '[data-testid="conversation-panel-messages"]',
      '#main [role="application"]',
      '#main [data-testid="conversation-panel-body"]',
      '#main'
    ];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!el) continue;
      try {
        el.scrollTop = 0;
        el.dispatchEvent(new Event("scroll", { bubbles: true }));
        return true;
      } catch {}
    }
    return false;
  }

  function noMoreState(chat) {
    try {
      const st = chat?.msgs?.msgLoadState || chat?.msgs?.loadState || chat?.msgLoadState || null;
      if (!st) return false;
      return !!(st.noEarlierMsgs || st.noMore || st.atStart || st.loadedAll || st.noMoreMsgs || st.isComplete);
    } catch {
      return false;
    }
  }

  async function getActiveChatMessages(opts) {
    const chat = getActiveChat();
    if (!chat) return { ok: false, error: "no_active_chat" };

    const hardCap = 100000;
    const wantAll = (opts?.limit === -1 || opts?.limit === Infinity);
    const target = wantAll ? hardCap : Math.min(Number(opts?.limit) || 1000, hardCap);
    const maxLoads = Math.min(Number(opts?.maxLoads) || (wantAll ? 5000 : 500), 8000);
    const delayMs = Math.min(Math.max(Number(opts?.delayMs) || (wantAll ? 900 : 650), 150), 2000);

    let prevLen = -1;
    let stable = 0;

    emit("waLoadProgress", { phase: "start", target, maxLoads });

    for (let i = 0; i < maxLoads; i++) {
      if (window.__CHATBACKUP_CANCEL__) break;

      const arr = getMsgsArray(chat);
      const len = arr.length;

      emit("waLoadProgress", { phase: "tick", attempt: i + 1, loaded: len, target, maxLoads });

      if (len >= target) break;
      if (noMoreState(chat)) break;

      if (len == prevLen) stable++;
      else stable = 0;
      prevLen = len;

      if (stable >= 4) {
        uiNudgeScrollTop();
        await new Promise(r => setTimeout(r, delayMs));
        stable = 0;
        continue;
      }

      const ok = await tryLoadEarlier(chat);
      uiNudgeScrollTop();
      await new Promise(r => setTimeout(r, delayMs));

      if (!ok && stable >= 2) break;
    }

    const arr = getMsgsArray(chat);

    const mapped = arr.map(m => ({
      id: m?.id?._serialized || m?.id?.toString?.() || null,
      t: pickTimestamp(m),
      fromMe: pickFromMe(m),
      sender: pickSenderName(m),
      text: pickText(m),
      type: pickType(m),
    }));

    // keep media-only too (text empty but type != chat)
    const filtered = mapped.filter(x => x.text || (x.type && x.type !== "chat"));
    const hasTs = filtered.some(x => typeof x.t === "number");
    if (hasTs) filtered.sort((a,b) => (a.t ?? 0) - (b.t ?? 0));

    let out = filtered;
    if (out.length > target) out = out.slice(out.length - target);

    emit("waLoadProgress", { phase: "final", loaded: out.length, target, maxLoads });
    return { ok: true, messages: out, returned: out.length, target };
  }

  function findMsgById(chat, msgId) {
    if (!msgId) return null;
    const arr = getMsgsArray(chat);
    for (const m of arr) {
      const id = m?.id?._serialized || m?.id?.toString?.() || null;
      if (id === msgId) return m;
    }
    return null;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("file_reader_error"));
      r.onload = () => resolve(String(r.result || ""));
      r.readAsDataURL(blob);
    });
  }

  async function downloadImageDataUrl(payload) {
    const chat = getActiveChat();
    if (!chat) return { ok: false, error: "no_active_chat" };

    const msg = findMsgById(chat, String(payload?.msgId || ""));
    if (!msg) return { ok: false, error: "msg_not_found" };

    // only attempt if method exists
    try {
      if (typeof msg.downloadMedia === "function") {
        const res = await msg.downloadMedia();
        if (res instanceof Blob) {
          const dataUrl = await blobToDataUrl(res);
          return { ok: true, dataUrl, mime: res.type || "" };
        }
        if (typeof res === "string") {
          if (res.startsWith("data:")) return { ok: true, dataUrl: res, mime: "" };
          return { ok: true, dataUrl: "data:image/jpeg;base64," + res, mime: "image/jpeg" };
        }
        if (res && typeof res === "object") {
          if (res.data && (res.mimetype || res.type)) {
            const mt = res.mimetype || res.type;
            return { ok: true, dataUrl: "data:" + mt + ";base64," + res.data, mime: mt, filename: res.filename || "" };
          }
        }
      }
    } catch {}

    // fallback: mediaData.downloadMedia()
    try {
      if (msg.mediaData && typeof msg.mediaData.downloadMedia === "function") {
        const blob = await msg.mediaData.downloadMedia();
        if (blob instanceof Blob) {
          const dataUrl = await blobToDataUrl(blob);
          return { ok: true, dataUrl, mime: blob.type || "" };
        }
      }
    } catch {}

    return { ok: false, error: "download_failed" };
  }

  // bridge request handler
  window.addEventListener("message", async (event) => {
    try {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.ns !== BRIDGE_NS || data.dir !== "req") return;

      const reply = (ok, result, error) => {
        window.postMessage({ ns: BRIDGE_NS, dir: "res", id: data.id, ok, result, error }, "*");
      };

      if (data.action === "ping") {
        reply(true, { ready: state.ready, meta: state.meta, keys: Object.keys(state.modules) });
        return;
      }

      if (data.action === "setCancel") {
        window.__CHATBACKUP_CANCEL__ = !!data.payload?.cancel;
        reply(true, { cancel: window.__CHATBACKUP_CANCEL__ });
        return;
      }

      if (!state.ready) {
        reply(false, null, "not_ready");
        return;
      }

      if (data.action === "getActiveChatMessages") {
        const res = await getActiveChatMessages(data.payload || {});
        reply(true, res);
        return;
      }

      if (data.action === "downloadImageDataUrl") {
        const res = await downloadImageDataUrl(data.payload || {});
        reply(true, res);
        return;
      }

      reply(false, null, "unknown_action");
    } catch (e) {
      try { window.postMessage({ ns: BRIDGE_NS, dir: "res", id: event?.data?.id, ok: false, error: String(e?.message || e) }, "*"); } catch {}
    }
  });

  // wait until whatsapp UI appears, then load
  (function waitLoad() {
    const ok = document.querySelector("#pane-side") || document.querySelector('[data-testid="chat-list"]');
    if (ok) loadModules();
    else setTimeout(waitLoad, 800);
  })();
})();
