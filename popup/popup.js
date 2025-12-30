const el = (id) => document.getElementById(id);

const dot = el("dot");
const statusText = el("statusText");
const wrongPage = el("wrongPage");

const chatCard = el("chatCard");
const chatName = el("chatName");
const chatMeta = el("chatMeta");

const format = el("format");
const limit = el("limit");
const incTs = el("incTs");
const incSender = el("incSender");
const incMedia = el("incMedia");
const dlMedia = el("dlMedia");

const btnExport = el("btnExport");
const btnCancel = el("btnCancel");

const progressBox = el("progressBox");
const barFill = el("barFill");
const progPct = el("progPct");
const progStatus = el("progStatus");
const progDetail = el("progDetail");

let exporting = false;

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
}

btnExport.addEventListener("click", async () => {
  if (exporting) return;
  exporting = true;
  btnExport.disabled = true;
  showProgress(true);
  updateProgress({ percent: 0, status: "Iniciando…" });

  const settings = {
    format: format.value,
    messageLimit: parseInt(limit.value, 10),
    includeMedia: !!incMedia.checked,
    includeTimestamps: !!incTs.checked,
    includeSender: !!incSender.checked,
    downloadMediaFiles: !!dlMedia.checked
  };

  const res = await chrome.runtime.sendMessage({ action: "startBackup", settings });
  if (!res?.success) {
    exporting = false;
    btnExport.disabled = false;
    showProgress(false);
    alert("❌ " + (res?.error || "Falha ao iniciar"));
  }
});

btnCancel.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ action: "cancelBackup" });
  exporting = false;
  btnExport.disabled = false;
  showProgress(false);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "progress") updateProgress(msg);
  if (msg.type === "complete") {
    exporting = false;
    btnExport.disabled = false;
    showProgress(false);
    alert(`✅ Exportação concluída! ${msg.count} mensagens.`);
    refreshUI();
  }
  if (msg.type === "error") {
    exporting = false;
    btnExport.disabled = false;
    showProgress(false);
    alert("❌ " + msg.error);
    refreshUI();
  }
  if (msg.type === "chatUpdate") {
    chatCard.classList.remove("hidden");
    chatName.textContent = msg.chat?.name || "Conversa";
    chatMeta.textContent = msg.chat?.isGroup ? "👥 Grupo" : "👤 Conversa";
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  await refreshUI();
  setInterval(() => { if (!exporting) refreshUI(); }, 2500);
});
