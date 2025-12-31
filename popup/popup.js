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
  EXPORT_PROGRESS: 'chatbackup_export_progress',
  EXPORT_IMAGES: 'chatbackup_export_images',
  EXPORT_VIDEOS: 'chatbackup_export_videos',
  EXPORT_AUDIOS: 'chatbackup_export_audios',
  EXPORT_DOCS: 'chatbackup_export_docs'
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

const exportImages = el("exportImages");
const exportVideos = el("exportVideos");
const exportAudios = el("exportAudios");
const exportDocs = el("exportDocs");

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
const sortContacts = el("sortContacts");
const contactsCounter = el("contactsCounter");
const groupsSection = el("groupsSection");
const groupsHeader = el("groupsHeader");
const groupsList = el("groupsList");
const groupsCount = el("groupsCount");
const contactsSection = el("contactsSection");
const contactsHeader = el("contactsHeader");
const contactsList = el("contactsList");
const contactsCount = el("contactsCount");
const btnLoadMore = el("btnLoadMore");
const selectedContact = el("selectedContact");
const selectedIcon = el("selectedIcon");
const selectedName = el("selectedName");
const btnClearSelection = el("btnClearSelection");
const btnExportCurrent = el("btnExportCurrent");

let allContacts = [];
let filteredGroups = [];
let filteredContacts = [];
let displayedGroupsCount = 0;
let displayedContactsCount = 0;
const ITEMS_PER_PAGE = 20;
let selectedChatId = null;
let groupsSectionCollapsed = false;
let contactsSectionCollapsed = false;

let exporting = false;

// Toast notification function (não-bloqueante)
function showToast(message, type = 'success', duration = 5000) {
  const toast = el('toast');
  const toastIcon = el('toastIcon');
  const toastMessage = el('toastMessage');
  
  toastIcon.textContent = type === 'success' ? '✅' : '❌';
  toastMessage.textContent = message;
  
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  
  // Auto-hide after duration
  setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}


// Salvar configurações
function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.FORMAT, format.value);
  localStorage.setItem(STORAGE_KEYS.LIMIT, limit.value);
  localStorage.setItem(STORAGE_KEYS.INC_TS, incTs.checked);
  localStorage.setItem(STORAGE_KEYS.INC_SENDER, incSender.checked);
  localStorage.setItem(STORAGE_KEYS.EXPORT_IMAGES, exportImages.checked);
  localStorage.setItem(STORAGE_KEYS.EXPORT_VIDEOS, exportVideos.checked);
  localStorage.setItem(STORAGE_KEYS.EXPORT_AUDIOS, exportAudios.checked);
  localStorage.setItem(STORAGE_KEYS.EXPORT_DOCS, exportDocs.checked);
  
  if (dateFrom) localStorage.setItem(STORAGE_KEYS.DATE_FROM, dateFrom.value);
  if (dateTo) localStorage.setItem(STORAGE_KEYS.DATE_TO, dateTo.value);
}

// Carregar configurações
function loadSettings() {
  const savedFormat = localStorage.getItem(STORAGE_KEYS.FORMAT);
  const savedLimit = localStorage.getItem(STORAGE_KEYS.LIMIT);
  const savedIncTs = localStorage.getItem(STORAGE_KEYS.INC_TS);
  const savedIncSender = localStorage.getItem(STORAGE_KEYS.INC_SENDER);
  const savedExportImages = localStorage.getItem(STORAGE_KEYS.EXPORT_IMAGES);
  const savedExportVideos = localStorage.getItem(STORAGE_KEYS.EXPORT_VIDEOS);
  const savedExportAudios = localStorage.getItem(STORAGE_KEYS.EXPORT_AUDIOS);
  const savedExportDocs = localStorage.getItem(STORAGE_KEYS.EXPORT_DOCS);
  const savedDateFrom = localStorage.getItem(STORAGE_KEYS.DATE_FROM);
  const savedDateTo = localStorage.getItem(STORAGE_KEYS.DATE_TO);
  
  if (savedFormat) format.value = savedFormat;
  if (savedLimit) limit.value = savedLimit;
  if (savedIncTs !== null) incTs.checked = savedIncTs === 'true';
  if (savedIncSender !== null) incSender.checked = savedIncSender === 'true';
  if (savedExportImages !== null) exportImages.checked = savedExportImages === 'true';
  if (savedExportVideos !== null) exportVideos.checked = savedExportVideos === 'true';
  if (savedExportAudios !== null) exportAudios.checked = savedExportAudios === 'true';
  if (savedExportDocs !== null) exportDocs.checked = savedExportDocs === 'true';
  
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

function updateMediaProgress(data) {
  const container = el('mediaProgressContainer');
  container.style.display = 'block';
  
  // Atualizar cada tipo
  if (data.images) {
    updateProgressRow('image', data.images);
  }
  if (data.videos) {
    updateProgressRow('video', data.videos);
  }
  if (data.audios) {
    updateProgressRow('audio', data.audios);
  }
  if (data.docs) {
    updateProgressRow('doc', data.docs);
  }
}

function updateProgressRow(type, info) {
  const row = el(`${type}Progress`);
  const bar = el(`${type}Bar`);
  const count = el(`${type}Count`);
  
  if (info.total > 0) {
    row.style.display = 'flex';
    const percent = Math.round((info.current / info.total) * 100);
    bar.style.width = `${percent}%`;
    
    if (info.failed > 0) {
      bar.classList.add('has-failed');
      count.innerHTML = `${info.current - info.failed}/${info.total} <span class="failed">(${info.failed}❌)</span>`;
    } else {
      bar.classList.remove('has-failed');
      count.textContent = `${info.current}/${info.total}`;
    }
  }
}

function hideMediaProgress() {
  const container = el('mediaProgressContainer');
  container.style.display = 'none';
  // Reset all rows
  ['image', 'video', 'audio', 'doc'].forEach(type => {
    const row = el(`${type}Progress`);
    row.style.display = 'none';
  });
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

function sortContacts(contacts, sortBy) {
  const sorted = [...contacts];
  if (sortBy === 'name-asc') {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'name-desc') {
    sorted.sort((a, b) => b.name.localeCompare(a.name));
  }
  // 'recent' keeps original order (most recent by last message)
  return sorted;
}

function updateContactsCounter() {
  const totalGroups = filteredGroups.length;
  const totalContacts = filteredContacts.length;
  const displayedTotal = displayedGroupsCount + displayedContactsCount;
  const actualTotal = totalGroups + totalContacts;
  
  if (actualTotal > 0) {
    contactsCounter.textContent = `Exibindo ${displayedTotal} de ${actualTotal} contatos`;
    contactsCounter.classList.remove('hidden');
  } else {
    contactsCounter.classList.add('hidden');
  }
  
  // Update section counts
  groupsCount.textContent = totalGroups;
  contactsCount.textContent = totalContacts;
  
  // Show/hide load more button
  if (displayedTotal < actualTotal) {
    btnLoadMore.classList.remove('hidden');
  } else {
    btnLoadMore.classList.add('hidden');
  }
  
  // Show/hide sections based on content
  groupsSection.style.display = totalGroups > 0 ? 'block' : 'none';
  contactsSection.style.display = totalContacts > 0 ? 'block' : 'none';
}

function renderContactItems(contacts, isGroup) {
  return contacts.map(c => `
    <div class="contact-item ${c.id === selectedChatId ? 'selected' : ''}" data-id="${c.id}" data-isgroup="${isGroup}">
      <span class="icon">${isGroup ? '👥' : '👤'}</span>
      <span class="name">${escapeHtml(c.name)}</span>
    </div>
  `).join('');
}

function renderContacts() {
  // Apply sorting
  const sortBy = sortContacts.value;
  const sortedGroups = sortContacts(filteredGroups, sortBy);
  const sortedContacts = sortContacts(filteredContacts, sortBy);
  
  // Render groups (up to displayedGroupsCount)
  const groupsToShow = sortedGroups.slice(0, displayedGroupsCount);
  groupsList.innerHTML = renderContactItems(groupsToShow, true);
  
  // Render contacts (up to displayedContactsCount)
  const contactsToShow = sortedContacts.slice(0, displayedContactsCount);
  contactsList.innerHTML = renderContactItems(contactsToShow, false);
  
  // Add event listeners
  document.querySelectorAll('.contact-item').forEach(item => {
    item.addEventListener('click', () => selectContact(item.dataset.id));
  });
  
  // Update collapsible state
  groupsList.style.display = groupsSectionCollapsed ? 'none' : 'block';
  contactsList.style.display = contactsSectionCollapsed ? 'none' : 'block';
  
  updateContactsCounter();
}

function filterAndRenderContacts(query = '') {
  const lowerQuery = query.toLowerCase();
  
  // Separate into groups and contacts
  if (lowerQuery) {
    filteredGroups = allContacts.filter(c => c.isGroup && c.name.toLowerCase().includes(lowerQuery));
    filteredContacts = allContacts.filter(c => !c.isGroup && c.name.toLowerCase().includes(lowerQuery));
  } else {
    filteredGroups = allContacts.filter(c => c.isGroup);
    filteredContacts = allContacts.filter(c => !c.isGroup);
  }
  
  // Reset to initial page
  displayedGroupsCount = Math.min(ITEMS_PER_PAGE, filteredGroups.length);
  displayedContactsCount = Math.min(Math.max(0, ITEMS_PER_PAGE - displayedGroupsCount), filteredContacts.length);
  
  renderContacts();
}

function loadMoreContacts() {
  // Calculate remaining items
  const remainingGroups = filteredGroups.length - displayedGroupsCount;
  const remainingContacts = filteredContacts.length - displayedContactsCount;
  const totalRemaining = remainingGroups + remainingContacts;
  
  if (totalRemaining === 0) return;
  
  // Load up to ITEMS_PER_PAGE more items, prioritizing groups first
  let toLoad = Math.min(ITEMS_PER_PAGE, totalRemaining);
  
  // Load groups first
  if (remainingGroups > 0) {
    const groupsToAdd = Math.min(toLoad, remainingGroups);
    displayedGroupsCount += groupsToAdd;
    toLoad -= groupsToAdd;
  }
  
  // Then load contacts with remaining quota
  if (toLoad > 0 && remainingContacts > 0) {
    const contactsToAdd = Math.min(toLoad, remainingContacts);
    displayedContactsCount += contactsToAdd;
  }
  
  renderContacts();
}

function toggleSection(isGroupsSection) {
  if (isGroupsSection) {
    groupsSectionCollapsed = !groupsSectionCollapsed;
    groupsList.style.display = groupsSectionCollapsed ? 'none' : 'block';
    groupsHeader.querySelector('.section-icon').textContent = groupsSectionCollapsed ? '▶' : '▼';
  } else {
    contactsSectionCollapsed = !contactsSectionCollapsed;
    contactsList.style.display = contactsSectionCollapsed ? 'none' : 'block';
    contactsHeader.querySelector('.section-icon').textContent = contactsSectionCollapsed ? '▶' : '▼';
  }
}

function selectContact(chatId) {
  const contact = allContacts.find(c => c.id === chatId);
  if (!contact) return;
  
  selectedChatId = chatId;
  selectedIcon.textContent = contact.isGroup ? '👥' : '👤';
  selectedName.textContent = contact.name;
  selectedContact.classList.remove("hidden");
  
  // Atualizar visual da lista
  document.querySelectorAll('.contact-item').forEach(item => {
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
  
  // Enable export current button
  btnExportCurrent.disabled = false;
  btnExportCurrent.classList.remove('disabled');
}

// Carregar contatos
btnLoadContacts.addEventListener("click", async () => {
  btnLoadContacts.disabled = true;
  btnLoadContacts.textContent = "⏳ Carregando...";
  
  try {
    const chk = await checkActiveWhatsApp();
    if (!chk.ok) {
      showToast("Abra o WhatsApp Web primeiro!", 'error');
      return;
    }
    
    const res = await chrome.runtime.sendMessage({ action: "getContacts" });
    if (res?.success && res.contacts) {
      allContacts = res.contacts;
      filterAndRenderContacts();
      contactsContainer.classList.remove("hidden");
    } else {
      showToast("Falha ao carregar contatos: " + (res?.error || "Erro desconhecido"), 'error');
    }
  } finally {
    btnLoadContacts.disabled = false;
    btnLoadContacts.textContent = "🔄 Carregar Contatos";
  }
});

// Load more button
btnLoadMore.addEventListener("click", () => {
  loadMoreContacts();
});

// Collapsible sections
groupsHeader.addEventListener("click", () => {
  toggleSection(true);
});

contactsHeader.addEventListener("click", () => {
  toggleSection(false);
});

// Limpar seleção
btnClearSelection.addEventListener("click", () => {
  selectedChatId = null;
  selectedContact.classList.add("hidden");
  document.querySelectorAll('.contact-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  // Disable export current button
  btnExportCurrent.disabled = true;
  btnExportCurrent.classList.add('disabled');
});

// Busca/Filtro
searchContacts.addEventListener("input", (e) => {
  const query = e.target.value;
  filterAndRenderContacts(query);
});

// Sorting
sortContacts.addEventListener("change", () => {
  renderContacts();
});

btnExportCurrent.addEventListener("click", async () => {
  if (exporting) return;
  
  // Export the currently open chat (ignore selectedChatId)
  exporting = true;
  btnExportCurrent.disabled = true;
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
    chatId: null, // null means use currently open chat
    exportImages: !!exportImages.checked,
    exportVideos: !!exportVideos.checked,
    exportAudios: !!exportAudios.checked,
    exportDocs: !!exportDocs.checked
  };

  // Salvar configurações antes de iniciar
  saveSettings();

  const res = await chrome.runtime.sendMessage({ action: "startBackup", settings });
  if (!res?.success) {
    exporting = false;
    btnExportCurrent.disabled = false;
    btnExport.disabled = false;
    showProgress(false);
    clearExportProgress();
    showToast(res?.error || "Falha ao iniciar", 'error');
  }
});

btnExport.addEventListener("click", async () => {
  if (exporting) return;
  exporting = true;
  btnExport.disabled = true;
  btnExportCurrent.disabled = true;
  showProgress(true);
  updateProgress({ percent: 0, status: "Iniciando…" });

  const settings = {
    format: format.value,
    messageLimit: parseInt(limit.value, 10),
    includeTimestamps: !!incTs.checked,
    includeSender: !!incSender.checked,
    dateFrom: dateFrom.value || null,
    dateTo: dateTo.value || null,
    chatId: selectedChatId || null,
    exportImages: !!exportImages.checked,
    exportVideos: !!exportVideos.checked,
    exportAudios: !!exportAudios.checked,
    exportDocs: !!exportDocs.checked
  };

  // Salvar configurações antes de iniciar
  saveSettings();

  const res = await chrome.runtime.sendMessage({ action: "startBackup", settings });
  if (!res?.success) {
    exporting = false;
    btnExport.disabled = false;
    btnExportCurrent.disabled = false;
    showProgress(false);
    clearExportProgress();
    showToast(res?.error || "Falha ao iniciar", 'error');
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
    
    // Mostrar aviso discreto de que exportação continua mesmo fechando popup
    if (msg.percent > 0 && msg.percent < 100) {
      const hint = el('exportHint');
      if (hint) hint.style.display = 'block';
    }
  }
  if (msg.type === "mediaProgressDetailed") {
    updateMediaProgress(msg.data);
  }
  if (msg.type === "complete") {
    exporting = false;
    btnExport.disabled = false;
    btnExportCurrent.disabled = false;
    showProgress(false);
    hideMediaProgress();
    clearExportProgress();
    const hint = el('exportHint');
    if (hint) hint.style.display = 'none';
    showToast(`Exportação concluída! ${msg.count} mensagens.`, 'success');
    refreshUI();
  }
  if (msg.type === "error") {
    exporting = false;
    btnExport.disabled = false;
    btnExportCurrent.disabled = false;
    showProgress(false);
    hideMediaProgress();
    clearExportProgress();
    const hint = el('exportHint');
    if (hint) hint.style.display = 'none';
    showToast(msg.error, 'error');
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
  exportImages.addEventListener('change', saveSettings);
  exportVideos.addEventListener('change', saveSettings);
  exportAudios.addEventListener('change', saveSettings);
  exportDocs.addEventListener('change', saveSettings);
  if (dateFrom) dateFrom.addEventListener('change', saveSettings);
  if (dateTo) dateTo.addEventListener('change', saveSettings);
  
  // Initially disable export current button
  btnExportCurrent.disabled = true;
  btnExportCurrent.classList.add('disabled');
  
  // Verificar se há exportação em andamento
  const savedProgress = loadExportProgress();
  if (savedProgress && savedProgress.percent < 100) {
    showProgress(true);
    updateProgress(savedProgress);
  }
  
  await refreshUI();
  setInterval(() => { if (!exporting) refreshUI(); }, 2500);
});
