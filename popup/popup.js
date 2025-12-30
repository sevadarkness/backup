const el = (id) => document.getElementById(id);

// Chaves para localStorage
const STORAGE_KEYS = {
  FORMAT: 'chatbackup_format',
  LIMIT: 'chatbackup_limit',
  INC_TS: 'chatbackup_inc_ts',
  INC_SENDER: 'chatbackup_inc_sender',
  DATE_FROM: 'chatbackup_date_from',
  DATE_TO: 'chatbackup_date_to',
  LAST_CHAT: 'chatbackup_last_chat',
  EXPORT_PROGRESS: 'chatbackup_export_progress'
};

const dot = el("dot");
const statusText = el("statusText");
const wrongPage = el("wrongPage");

const chatCard = el("chatCard");
const chatName = el("chatName");
const chatMeta = el("chatMeta");
const chatPhoto = el("chatPhoto");
const chatIcon = el("chatIcon");

const format = el("format");
const limit = el("limit");
const dateFrom = el("dateFrom");
const dateTo = el("dateTo");
const incTs = el("incTs");
const incSender = el("incSender");

const btnExport = el("btnExport");
const btnCancel = el("btnCancel");

const progressBox = el("progressBox");
const barFill = el("barFill");
const progPct = el("progPct");
const progStatus = el("progStatus");
const progDetail = el("progDetail");

// Contact selector elements
const btnLoadContacts = el("btnLoadContacts");
const contactsContainer = el("contactsContainer");
const searchContacts = el("searchContacts");
const contactsList = el("contactsList");
const selectedContact = el("selectedContact");
const selectedIcon = el("selectedIcon");
const selectedName = el("selectedName");
const btnClearSelection = el("btnClearSelection");

let allContacts = [];
let selectedChatId = null;

let exporting = false;

// Salvar configurações
function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.FORMAT, format.value);
  localStorage.setItem(STORAGE_KEYS.LIMIT, limit.value);
  localStorage.setItem(STORAGE_KEYS.INC_TS, incTs.checked);
  localStorage.setItem(STORAGE_KEYS.INC_SENDER, incSender.checked);
  
  if (dateFrom) localStorage.setItem(STORAGE_KEYS.DATE_FROM, dateFrom.value);
  if (dateTo) localStorage.setItem(STORAGE_KEYS.DATE_TO, dateTo.value);
}

// Carregar configurações
function loadSettings() {
  const savedFormat = localStorage.getItem(STORAGE_KEYS.FORMAT);
  const savedLimit = localStorage.getItem(STORAGE_KEYS.LIMIT);
  const savedIncTs = localStorage.getItem(STORAGE_KEYS.INC_TS);
  const savedIncSender = localStorage.getItem(STORAGE_KEYS.INC_SENDER);
  const savedDateFrom = localStorage.getItem(STORAGE_KEYS.DATE_FROM);
  const savedDateTo = localStorage.getItem(STORAGE_KEYS.DATE_TO);
  
  if (savedFormat) format.value = savedFormat;
  if (savedLimit) limit.value = savedLimit;
  if (savedIncTs !== null) incTs.checked = savedIncTs === 'true';
  if (savedIncSender !== null) incSender.checked = savedIncSender === 'true';
  
  if (dateFrom && savedDateFrom) dateFrom.value = savedDateFrom;
  if (dateTo && savedDateTo) dateTo.value = savedDateTo;
}

// Salvar progresso da exportação
function saveExportProgress(progress) {
  localStorage.setItem(STORAGE_KEYS.EXPORT_PROGRESS, JSON.stringify({
    ...progress,
    timestamp: Date.now()
  }));
}

// Carregar progresso da exportação (se ainda válido - menos de 5 minutos)
function loadExportProgress() {
  const saved = localStorage.getItem(STORAGE_KEYS.EXPORT_PROGRESS);
  if (!saved) return null;
  
  try {
    const progress = JSON.parse(saved);
    // Válido por 5 minutos
    if (Date.now() - progress.timestamp > 5 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEYS.EXPORT_PROGRESS);
      return null;
    }
    return progress;
  } catch {
    return null;
  }
}

// Limpar progresso após conclusão
function clearExportProgress() {
  localStorage.removeItem(STORAGE_KEYS.EXPORT_PROGRESS);
}

function setDot(state) { dot.className = "dot " + state; }
function showProgress(show) {
  progressBox.classList.toggle("hidden", !show);
  btnCancel.classList.toggle("hidden", !show);
}
function updateProgress({ current=0, total=0, percent=0, status="" }) {
  barFill.style.width = `${percent}%`;
  progPct.textContent = `${percent}%`;
  progStatus.textContent = status || "—";
  progDetail.textContent = total ? `${current} / ${total}` : `${current}`;
}

async function checkActiveWhatsApp() {
  setDot("loading");
  statusText.textContent = "Verificando…";
  const res = await chrome.runtime.sendMessage({ action: "checkActiveWhatsApp" });
  if (!res?.success) {
    setDot("bad");
    statusText.textContent = "Abra o WhatsApp Web e recarregue";
    wrongPage.classList.remove("hidden");
    chatCard.classList.add("hidden");
    return { ok: false };
  }
  wrongPage.classList.add("hidden");
  return { ok: true, tabId: res.tabId };
}

async function getStatusFromContent(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: "getStatus" }, (resp) => {
      if (chrome.runtime.lastError) return resolve(null);
      resolve(resp);
    });
  });
}

async function refreshUI() {
  const chk = await checkActiveWhatsApp();
  if (!chk.ok) return;

  const st = await getStatusFromContent(chk.tabId);
  if (!st) {
    setDot("bad");
    statusText.textContent = "Extensão não carregada (recarregue a página)";
    return;
  }

  if (st.connected) {
    setDot("ok");
    statusText.textContent = "Conectado ao WhatsApp Web";
  } else {
    setDot("loading");
    statusText.textContent = st.message || "Aguardando login…";
  }

  chatCard.classList.remove("hidden");
  chatName.textContent = st.currentChat?.name || "Selecione uma conversa";
  chatMeta.textContent = st.currentChat?.isGroup ? "👥 Grupo" : "👤 Conversa";
  
  // Update chat photo if available
  if (st.currentChat?.avatar) {
    chatPhoto.src = st.currentChat.avatar;
    chatPhoto.style.display = "block";
    chatIcon.style.display = "none";
  } else {
    chatPhoto.style.display = "none";
    chatIcon.style.display = "block";
  }
}

// Contact selector functions
function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderContacts(contacts) {
  contactsList.innerHTML = contacts.map(c => `
    <div class="contact-item ${c.id === selectedChatId ? 'selected' : ''}" data-id="${c.id}">
      <span class="icon">${c.isGroup ? '👥' : '👤'}</span>
      <span class="name">${escapeHtml(c.name)}</span>
    </div>
  `).join('');
  
  // Adicionar event listeners
  contactsList.querySelectorAll('.contact-item').forEach(item => {
    item.addEventListener('click', () => selectContact(item.dataset.id));
  });
}

function selectContact(chatId) {
  const contact = allContacts.find(c => c.id === chatId);
  if (!contact) return;
  
  selectedChatId = chatId;
  selectedIcon.textContent = contact.isGroup ? '👥' : '👤';
  selectedName.textContent = contact.name;
  selectedContact.classList.remove("hidden");
  
  // Atualizar visual da lista
  contactsList.querySelectorAll('.contact-item').forEach(item => {
    item.classList.toggle('selected', item.dataset.id === chatId);
  });
  
  // Atualizar chatCard também
  chatCard.classList.remove("hidden");
  chatName.textContent = contact.name;
  chatMeta.textContent = contact.isGroup ? "👥 Grupo" : "👤 Conversa";
  
  // Hide photo if using selector (don't have photo data)
  chatPhoto.style.display = "none";
  chatIcon.style.display = "block";
  chatIcon.textContent = contact.isGroup ? '👥' : '👤';
}

// Carregar contatos
btnLoadContacts.addEventListener("click", async () => {
  btnLoadContacts.disabled = true;
  btnLoadContacts.textContent = "⏳ Carregando...";
  
  try {
    const chk = await checkActiveWhatsApp();
    if (!chk.ok) {
      alert("Abra o WhatsApp Web primeiro!");
      return;
    }
    
    const res = await chrome.runtime.sendMessage({ action: "getContacts" });
    if (res?.success && res.contacts) {
      allContacts = res.contacts;
      renderContacts(allContacts);
      contactsContainer.classList.remove("hidden");
    } else {
      alert("Falha ao carregar contatos: " + (res?.error || "Erro desconhecido"));
    }
  } finally {
    btnLoadContacts.disabled = false;
    btnLoadContacts.textContent = "🔄 Carregar Contatos";
  }
});

// Limpar seleção
btnClearSelection.addEventListener("click", () => {
  selectedChatId = null;
  selectedContact.classList.add("hidden");
  contactsList.querySelectorAll('.contact-item').forEach(item => {
    item.classList.remove('selected');
  });
});

// Busca/Filtro
searchContacts.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allContacts.filter(c => 
    c.name.toLowerCase().includes(query)
  );
  renderContacts(filtered);
});

btnExport.addEventListener("click", async () => {
  if (exporting) return;
  exporting = true;
  btnExport.disabled = true;
  showProgress(true);
  updateProgress({ percent: 0, status: "Iniciando…" });

  const settings = {
    format: format.value,
    messageLimit: parseInt(limit.value, 10),
    includeTimestamps: !!incTs.checked,
    includeSender: !!incSender.checked,
    dateFrom: dateFrom.value || null,
    dateTo: dateTo.value || null,
    chatId: selectedChatId || null
  };

  // Salvar configurações antes de iniciar
  saveSettings();

  const res = await chrome.runtime.sendMessage({ action: "startBackup", settings });
  if (!res?.success) {
    exporting = false;
    btnExport.disabled = false;
    showProgress(false);
    clearExportProgress();
    alert("❌ " + (res?.error || "Falha ao iniciar"));
  }
});

btnCancel.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ action: "cancelBackup" });
  exporting = false;
  btnExport.disabled = false;
  showProgress(false);
  clearExportProgress();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "progress") {
    updateProgress(msg);
    saveExportProgress(msg);
  }
  if (msg.type === "complete") {
    exporting = false;
    btnExport.disabled = false;
    showProgress(false);
    clearExportProgress();
    alert(`✅ Exportação concluída! ${msg.count} mensagens.`);
    refreshUI();
  }
  if (msg.type === "error") {
    exporting = false;
    btnExport.disabled = false;
    showProgress(false);
    clearExportProgress();
    alert("❌ " + msg.error);
    refreshUI();
  }
  if (msg.type === "chatUpdate") {
    chatCard.classList.remove("hidden");
    chatName.textContent = msg.chat?.name || "Conversa";
    chatMeta.textContent = msg.chat?.isGroup ? "👥 Grupo" : "👤 Conversa";
    
    // Update chat photo if available
    if (msg.chat?.avatar) {
      chatPhoto.src = msg.chat.avatar;
      chatPhoto.style.display = "block";
      chatIcon.style.display = "none";
    } else {
      chatPhoto.style.display = "none";
      chatIcon.style.display = "block";
    }
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  // Carregar configurações salvas
  loadSettings();
  
  // Adicionar listeners para salvar automaticamente
  format.addEventListener('change', saveSettings);
  limit.addEventListener('change', saveSettings);
  incTs.addEventListener('change', saveSettings);
  incSender.addEventListener('change', saveSettings);
  if (dateFrom) dateFrom.addEventListener('change', saveSettings);
  if (dateTo) dateTo.addEventListener('change', saveSettings);
  
  // Verificar se há exportação em andamento
  const savedProgress = loadExportProgress();
  if (savedProgress && savedProgress.percent < 100) {
    showProgress(true);
    updateProgress(savedProgress);
  }
  
  await refreshUI();
  setInterval(() => { if (!exporting) refreshUI(); }, 2500);
});
