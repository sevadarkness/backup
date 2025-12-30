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
    const want = [
      "WAWebChatCollection",
      "WAWebCmd",
      "WAWebMsgCollection",
      "WAWebChatLoadMessages",
      "WAWebDownloadManager",
      "WAWebContactCollection",
      "WAWebGroupMetadataCollection"
    ];
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

  function getChatInfo(chat) {
    if (!chat) return null;
    
    // Tentar múltiplas propriedades para o nome
    const name = chat?.name || 
                 chat?.formattedTitle || 
                 chat?.__x_formattedTitle ||
                 chat?.contact?.name ||
                 chat?.contact?.pushname || 
                 chat?.contact?.__x_pushname ||
                 chat?.id?._serialized || 
                 "Conversa";
    
    const isGroup = !!(chat?.isGroup || chat?.__x_isGroup);
    
    // Tentar múltiplas propriedades para a foto
    // NOTE: These paths depend on WhatsApp Web's internal API structure
    // and may break with future WhatsApp updates. Multiple fallback paths
    // are provided to improve compatibility across different versions.
    let profilePic = null;
    try {
      profilePic = chat?.contact?.profilePicThumb?.__x_imgFull || 
                   chat?.contact?.profilePicThumb?.__x_img || 
                   chat?.contact?.profilePicThumb?.img ||
                   chat?.__x_profilePicThumb ||
                   chat?.__x_groupMeta?.profilePicThumb?.__x_imgFull ||
                   chat?.__x_groupMeta?.profilePicThumb?.__x_img ||
                   chat?.groupMetadata?.profilePicThumb?.__x_imgFull ||
                   chat?.groupMetadata?.profilePicThumb?.__x_img ||
                   chat?.groupMetadata?.profilePicThumb ||
                   null;
    } catch (e) {
      // Fail silently - profile picture is optional
      profilePic = null;
    }
    
    const participants = isGroup ? 
      (chat?.groupMetadata?.participants?.length || 
       chat?.__x_groupMetadata?.participants?.length || null) : null;
    
    return {
      name,
      isGroup,
      profilePic,
      participants
    };
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
    // Try WAWebChatLoadMessages first (most reliable method from problem statement)
    try {
      const ChatLoadMessages = state.modules.WAWebChatLoadMessages;
      if (ChatLoadMessages?.loadEarlierMsgs) {
        const result = await ChatLoadMessages.loadEarlierMsgs(chat);
        return result;
      }
    } catch (e) {
      console.debug("[ChatBackup] WAWebChatLoadMessages failed:", e?.message || e);
    }

    // Fallback: try other methods
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

    emit("waLoadProgress", { phase: "start", target, maxLoads });

    for (let i = 0; i < maxLoads; i++) {
      if (window.__CHATBACKUP_CANCEL__) break;

      const beforeLen = getMsgsArray(chat).length;

      emit("waLoadProgress", { phase: "tick", attempt: i + 1, loaded: beforeLen, target, maxLoads });

      // Check if we've reached target or no more messages available
      if (beforeLen >= target) break;
      if (noMoreState(chat)) break;

      // Try to load earlier messages
      try {
        await tryLoadEarlier(chat);
      } catch (e) {
        console.warn("[ChatBackup] Error loading earlier messages:", e?.message || e);
      }

      // Nudge UI and wait
      uiNudgeScrollTop();
      await new Promise(r => setTimeout(r, delayMs));

      const afterLen = getMsgsArray(chat).length;

      // If no new messages were loaded, we've reached the end
      if (afterLen === beforeLen) {
        console.log("[ChatBackup] No more messages to load. Total:", afterLen);
        break;
      }
    }

    const arr = getMsgsArray(chat);

    const mapped = arr.map(m => ({
      id: m?.id?._serialized || m?.id?.toString?.() || null,
      t: pickTimestamp(m),
      fromMe: pickFromMe(m),
      sender: pickSenderName(m),
      text: pickText(m),
      type: pickType(m),
      // Extended properties for better media handling
      from: m?.__x_from?._serialized || m?.from?._serialized || null,
      to: m?.__x_to?._serialized || m?.to?._serialized || null,
      author: m?.__x_author?._serialized || m?.author?._serialized || null,
      ack: m?.__x_ack ?? m?.ack ?? null,
      caption: m?.__x_caption || m?.caption || null,
      mimetype: m?.__x_mimetype || m?.mimetype || null,
      size: m?.__x_size || m?.size || null,
      mediaKey: m?.__x_mediaKey || m?.mediaKey || null,
      directPath: m?.__x_directPath || m?.directPath || null,
      filehash: m?.__x_filehash || m?.filehash || null,
      encFilehash: m?.__x_encFilehash || m?.encFilehash || null,
      mediaKeyTimestamp: m?.__x_mediaKeyTimestamp || m?.mediaKeyTimestamp || null, // Used by downloadAndMaybeDecrypt
      deprecatedMms3Url: m?.__x_deprecatedMms3Url || m?.deprecatedMms3Url || null, // Fallback direct CDN URL
      hasMedia: !!(m?.__x_mediaKey || m?.mediaKey || m?.mediaData || m?.__x_mediaData)
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

      if (data.action === "getChatInfo") {
        const chat = getActiveChat();
        const info = getChatInfo(chat);
        reply(true, info);
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
