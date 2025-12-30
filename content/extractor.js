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

  async function getAllContacts() {
    try {
      const CC = getChatCollection();
      if (!CC) return { success: false, error: "ChatCollection not available" };
      
      const chats = CC.getModelsArray?.() || CC.models || [];
      
      const contacts = chats
        .filter(chat => chat?.id?._serialized) // Filtrar chats válidos
        .map(chat => {
          const info = getChatInfo(chat);
          return {
            id: chat.id._serialized,
            name: info?.name || chat.id._serialized,
            isGroup: info?.isGroup || false,
            unreadCount: chat.unreadCount || chat.__x_unreadCount || 0,
            lastMessageTime: chat.t || chat.__x_t || 0
          };
        })
        .sort((a, b) => b.lastMessageTime - a.lastMessageTime); // Ordenar por mais recente
      
      return { success: true, contacts };
    } catch (e) {
      return { success: false, error: String(e?.message || e) };
    }
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

  async function getChatInfoById(chatId) {
    try {
      const CC = getChatCollection();
      if (!CC) return { ok: false, error: "ChatCollection not available" };
      
      const chats = CC.getModelsArray?.() || CC.models || [];
      const chat = chats.find(c => c?.id?._serialized === chatId);
      
      if (!chat) {
        return { ok: false, error: "Chat não encontrado" };
      }
      
      const info = getChatInfo(chat);
      
      return {
        ok: true,
        chat: {
          name: info?.name || chatId,
          isGroup: info?.isGroup || false,
          profilePic: info?.profilePic || null
        }
      };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  }

  async function getActiveChatMessages(opts) {
    const CC = getChatCollection();
    if (!CC) return { ok: false, error: "ChatCollection not available" };
    
    let chat;
    if (opts?.chatId) {
      // Se chatId fornecido, buscar esse chat específico
      const chats = CC.getModelsArray?.() || CC.models || [];
      chat = chats.find(c => c?.id?._serialized === opts.chatId);
      if (!chat) return { ok: false, error: "Chat não encontrado" };
    } else {
      // Se não, usar o chat ativo
      chat = getActiveChat();
      if (!chat) return { ok: false, error: "no_active_chat" };
    }

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

  function getExtensionFromMimetype(mimetype, type) {
    const map = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'audio/ogg': 'ogg',
      'audio/ogg; codecs=opus': 'ogg',
      'audio/mp4': 'm4a',
      'audio/mpeg': 'mp3',
      'audio/aac': 'aac',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/3gpp': '3gp',
      'video/quicktime': 'mov',
      'application/pdf': 'pdf',
      'application/zip': 'zip',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt'
    };
    
    if (map[mimetype]) return map[mimetype];
    if (type === 'ptt' || type === 'audio') return 'ogg';
    if (type === 'image' || type === 'sticker') return 'webp';
    if (type === 'video') return 'mp4';
    if (type === 'document') return 'bin';
    return 'bin';
  }

  // ============ Manual Decryption Functions ============
  
  // Get media URL from message object
  function getMediaUrl(msg) {
    // Only use properties that survive serialization
    if (msg.deprecatedMms3Url) {
      return msg.deprecatedMms3Url;
    }
    
    if (msg.directPath) {
      return "https://mmg.whatsapp.net" + msg.directPath;
    }
    
    return null;
  }

  // Get mediaKey from message object
  function getMediaKey(msg) {
    // Only use properties that survive serialization
    return msg.mediaKey || null;
  }

  // HKDF Expand with WhatsApp info strings
  async function hkdfExpand(key, type) {
    const info = {
      'image': 'WhatsApp Image Keys',
      'video': 'WhatsApp Video Keys',
      'audio': 'WhatsApp Audio Keys',
      'ptt': 'WhatsApp Audio Keys',
      'document': 'WhatsApp Document Keys',
      'sticker': 'WhatsApp Image Keys'
    };
    
    const infoStr = info[type] || 'WhatsApp Document Keys';
    const infoBytes = new TextEncoder().encode(infoStr);
    
    // Import key for HKDF
    const baseKey = await crypto.subtle.importKey(
      'raw', key, { name: 'HKDF' }, false, ['deriveBits']
    );
    
    // Derive 112 bytes
    const expanded = await crypto.subtle.deriveBits(
      { name: 'HKDF', salt: new Uint8Array(32), info: infoBytes, hash: 'SHA-256' },
      baseKey, 112 * 8
    );
    
    return new Uint8Array(expanded);
  }

  // Decrypt media using manual decryption
  async function decryptMedia(encryptedData, mediaKeyBase64, mediaType) {
    // Convert mediaKey from base64 to ArrayBuffer
    const mediaKey = Uint8Array.from(atob(mediaKeyBase64), c => c.charCodeAt(0));
    
    // Expand the key using HKDF
    const mediaKeyExpanded = await hkdfExpand(mediaKey, mediaType);
    
    // Extract IV (bytes 0-16) and cipher key (bytes 16-48)
    const iv = mediaKeyExpanded.slice(0, 16);
    const cipherKey = mediaKeyExpanded.slice(16, 48);
    
    // Remove last 10 bytes (MAC)
    const encryptedWithoutMac = encryptedData.slice(0, -10);
    
    // Import the key for AES-CBC
    const key = await crypto.subtle.importKey(
      'raw', cipherKey, { name: 'AES-CBC' }, false, ['decrypt']
    );
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv },
      key,
      encryptedWithoutMac
    );
    
    return decrypted;
  }

  // Main download and decrypt function
  async function downloadAndDecryptMedia(msg) {
    const url = getMediaUrl(msg);
    const mediaKey = getMediaKey(msg);
    
    // Validação mais robusta
    if (!url) {
      throw new Error('URL de mídia não disponível - mídia pode não ter sido carregada');
    }
    
    if (!mediaKey) {
      throw new Error('mediaKey não disponível');
    }
    
    // Verificar se URL é válida (não undefined/null convertido para string)
    if (!url.startsWith('http')) {
      throw new Error(`URL inválida: ${url}`);
    }
    
    // Download encrypted data
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - Mídia pode ter expirado`);
    }
    
    const encryptedData = await response.arrayBuffer();
    
    // Decrypt
    const decryptedData = await decryptMedia(
      new Uint8Array(encryptedData),
      mediaKey,
      msg.type
    );
    
    // Return blob
    return new Blob([decryptedData], { type: msg.mimetype });
  }

  // ============ End Manual Decryption Functions ============


  async function downloadMediaForExport(messages, options = {}) {
    const { exportImages, exportAudios, exportDocs } = options;
    
    if (!exportImages && !exportAudios && !exportDocs) {
      return { images: [], audios: [], docs: [] };
    }
    
    const dm = tryRequire('WAWebDownloadManager')?.downloadManager;
    
    const mediaGroups = {
      images: [],  // type: image, sticker
      audios: [],  // type: ptt, audio
      docs: []     // type: document
    };
    
    // Filter messages by type
    for (const msg of messages) {
      if (!msg || window.__CHATBACKUP_CANCEL__) break;
      
      const type = msg.type || 'chat';
      
      // Check if message has media - mediaKey is the most reliable indicator
      if (!msg.mediaKey) continue;
      
      // NOVO: Verificar se tem URL disponível ANTES de adicionar à fila
      const hasMediaUrl = getMediaUrl(msg) !== null;
      
      if (!hasMediaUrl) {
        console.log(`[ChatBackup] Skipping ${type} without media URL (ID: ${msg.id || 'unknown'})`);
        continue; // Pular esta mídia - não tem como baixar
      }
      
      if (exportImages && (type === 'image' || type === 'sticker' || type === 'video')) {
        mediaGroups.images.push(msg);
      } else if (exportAudios && (type === 'ptt' || type === 'audio')) {
        mediaGroups.audios.push(msg);
      } else if (exportDocs && type === 'document') {
        mediaGroups.docs.push(msg);
      }
    }
    
    const results = { images: [], audios: [], docs: [] };
    
    // Download each group with concurrency control
    const downloadWithLimit = async (group, groupName) => {
      const concurrencyLimit = 3;
      const chunks = [];
      
      for (let i = 0; i < group.length; i += concurrencyLimit) {
        chunks.push(group.slice(i, i + concurrencyLimit));
      }
      
      let processedCount = 0;
      let failedCount = 0;
      
      for (const chunk of chunks) {
        if (window.__CHATBACKUP_CANCEL__) break;
        
        const promises = chunk.map(async (msg) => {
          try {
            let blob = null;
            
            // IMPORTANTE: downloadAndMaybeDecrypt NÃO funciona com mensagens serializadas
            // porque perde as referências internas do objeto WhatsApp
            // Usar APENAS o método manual de download e decriptação
            
            const url = getMediaUrl(msg);
            const mediaKey = getMediaKey(msg);
            
            if (url && mediaKey) {
              try {
                blob = await downloadAndDecryptMedia(msg);
              } catch (e) {
                const msgId = msg?.id || msg?.t || 'unknown';
                console.warn(`[ChatBackup] Download failed for ${msg?.type} (ID: ${msgId}):`, e?.message);
              }
            } else {
              console.log(`[ChatBackup] Skipping ${msg?.type} - missing URL or mediaKey`);
            }
            
            if (blob && blob.size > 0) {
              const ext = getExtensionFromMimetype(msg.mimetype, msg.type);
              
              // Generate unique filename
              const timestamp = msg.t || Date.now();
              const basename = msg.caption ? sanitizeFilename(msg.caption).slice(0, 50) : `${msg.type}_${timestamp}`;
              const filename = `${basename}.${ext}`;
              
              // Increment AFTER success
              processedCount++;
              emit('mediaProgress', {
                groupName,
                current: processedCount,
                total: group.length,
                failed: failedCount
              });
              
              return { blob, filename };
            }
            
            // Failed to download
            failedCount++;
            emit('mediaProgress', {
              groupName,
              current: processedCount,
              total: group.length,
              failed: failedCount
            });
            return null;
          } catch (e) {
            const msgId = msg.id || msg.t || 'unknown';
            console.error(`[ChatBackup] Error downloading media ${groupName} (ID: ${msgId}):`, e?.message || e);
            failedCount++;
            emit('mediaProgress', {
              groupName,
              current: processedCount,
              total: group.length,
              failed: failedCount
            });
            return null;
          }
        });
        
        const downloaded = await Promise.all(promises);
        results[groupName].push(...downloaded.filter(f => f !== null));
        
        // Small delay between batches
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 200));
        }
      }
      
      // Emit final progress with failed count
      if (failedCount > 0) {
        console.log(`[ChatBackup] ${groupName}: ${results[groupName].length} succeeded, ${failedCount} failed`);
      }
    };
    
    // Download each media type sequentially
    if (exportImages && mediaGroups.images.length > 0) {
      await downloadWithLimit(mediaGroups.images, 'images');
    }
    
    if (exportAudios && mediaGroups.audios.length > 0) {
      await downloadWithLimit(mediaGroups.audios, 'audios');
    }
    
    if (exportDocs && mediaGroups.docs.length > 0) {
      await downloadWithLimit(mediaGroups.docs, 'docs');
    }
    
    // Create ZIPs internally and return blob URLs instead of blob objects
    const zipResults = { images: null, audios: null, docs: null };
    
    // Helper function to create ZIP internally and return blob URL
    const createZipInternal = async (mediaFiles, zipName, groupName) => {
      if (!mediaFiles || mediaFiles.length === 0) return null;
      
      try {
        // Aguardar JSZip carregar com polling (máximo 10 segundos)
        let JSZip = window.JSZip;
        let attempts = 0;
        const maxAttempts = 100;
        
        while (!JSZip && attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 100));
          JSZip = window.JSZip;
          attempts++;
          if (attempts % 10 === 0) {
            console.log(`[ChatBackup] Waiting for JSZip... attempt ${attempts}`);
          }
        }
        
        if (!JSZip) {
          throw new Error("JSZip library not loaded after 10 seconds. Please refresh the page.");
        }
        
        console.log('[ChatBackup] JSZip found, creating ZIP...');
        
        const zip = new JSZip();
        const usedNames = new Set();
        
        for (const item of mediaFiles) {
          // Validate blob before processing
          if (!item?.blob || !(item.blob instanceof Blob) || item.blob.size === 0) {
            console.warn(`[ChatBackup] Skipping invalid media file: ${item?.filename || 'unknown'}`);
            continue;
          }
          
          const { blob, filename } = item;
          let finalName = filename;
          let counter = 1;
          
          // Handle duplicate filenames
          while (usedNames.has(finalName)) {
            const parts = filename.split('.');
            const ext = parts.length > 1 ? parts.pop() : '';
            const base = parts.join('.');
            finalName = ext ? `${base}_${counter}.${ext}` : `${base}_${counter}`;
            counter++;
          }
          
          usedNames.add(finalName);
          zip.file(finalName, blob);
        }
        
        emit('zipProgress', { zipName, status: 'generating' });
        const zipBlob = await zip.generateAsync({ 
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
        
        // Create blob URL that can be passed via postMessage
        const blobUrl = URL.createObjectURL(zipBlob);
        
        return { 
          blobUrl, 
          filename: zipName,
          count: mediaFiles.length
        };
      } catch (e) {
        console.error(`[ChatBackup] Error creating ZIP for ${groupName}:`, e);
        return null;
      }
    };
    
    if (exportImages && results.images.length > 0) {
      zipResults.images = await createZipInternal(results.images, 'images.zip', 'images');
    }
    
    if (exportAudios && results.audios.length > 0) {
      zipResults.audios = await createZipInternal(results.audios, 'audios.zip', 'audios');
    }
    
    if (exportDocs && results.docs.length > 0) {
      zipResults.docs = await createZipInternal(results.docs, 'docs.zip', 'docs');
    }
    
    return zipResults;
  }

  function sanitizeFilename(name) {
    return String(name || "file").replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_").slice(0, 180);
  }

  async function createMediaZip(mediaFiles, zipName) {
    if (!mediaFiles || mediaFiles.length === 0) return null;
    
    try {
      // Aguardar JSZip carregar com polling (máximo 10 segundos)
      let JSZip = window.JSZip;
      let attempts = 0;
      const maxAttempts = 100;
      
      while (!JSZip && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 100));
        JSZip = window.JSZip;
        attempts++;
        if (attempts % 10 === 0) {
          console.log(`[ChatBackup] Waiting for JSZip... attempt ${attempts}`);
        }
      }
      
      if (!JSZip) {
        throw new Error("JSZip library not loaded after 10 seconds. Please refresh the page.");
      }
      
      console.log('[ChatBackup] JSZip found, creating ZIP...');
      
      const zip = new JSZip();
      
      // Track filenames to avoid duplicates
      const usedNames = new Set();
      
      for (const item of mediaFiles) {
        // Validate blob before processing
        if (!item?.blob || !(item.blob instanceof Blob) || item.blob.size === 0) {
          console.warn(`[ChatBackup] Skipping invalid media file: ${item?.filename || 'unknown'}`);
          continue;
        }
        
        const { blob, filename } = item;
        let finalName = filename;
        let counter = 1;
        
        // Handle duplicate filenames
        while (usedNames.has(finalName)) {
          const parts = filename.split('.');
          const ext = parts.length > 1 ? parts.pop() : '';
          const base = parts.join('.');
          finalName = ext ? `${base}_${counter}.${ext}` : `${base}_${counter}`;
          counter++;
        }
        
        usedNames.add(finalName);
        zip.file(finalName, blob);
      }
      
      emit('zipProgress', { zipName, status: 'generating' });
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      return { blob: zipBlob, filename: zipName };
    } catch (e) {
      console.error(`[ChatBackup] Error creating ZIP:`, e);
      throw e;
    }
  }

  // Export functions for bridge access
  window.__chatbackup_downloadMediaForExport = downloadMediaForExport;
  window.__chatbackup_createMediaZip = createMediaZip;

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

      if (data.action === "getContacts") {
        const res = await getAllContacts();
        reply(res.success, res.success ? res : null, res.success ? null : res.error);
        return;
      }

      if (data.action === "getChatInfoById") {
        const res = await getChatInfoById(data.payload?.chatId);
        reply(res.ok, res.ok ? res : null, res.ok ? null : res.error);
        return;
      }

      if (data.action === "downloadMediaForExport") {
        const res = await downloadMediaForExport(data.payload?.messages || [], data.payload?.options || {});
        reply(true, res);
        return;
      }

      if (data.action === "createMediaZip") {
        const res = await createMediaZip(data.payload?.mediaFiles || [], data.payload?.zipName || 'media.zip');
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
