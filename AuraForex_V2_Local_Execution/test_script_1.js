
  function switchTab(tabId) {
    document.querySelectorAll('.content-section').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    if(tabId === 'dashboard') {
      document.getElementById('providerSection').style.display = 'none';
      document.querySelector('.nav-item').classList.add('active'); // First one
      
      const header = document.querySelector('header');
      if(header) header.style.display = 'flex';
      
      // Restore the dashboard view based on license/last tab
      if (typeof switchDashboardView === 'function') {
        switchDashboardView(localStorage.getItem('aura_dashboard_tab') || 'vps');
      } else if (typeof updateLicenseUI === 'function') {
       if(data.dynamicEmaLog) {
        const emaLogBox = document.getElementById("dynamicEmaLogBox");
        if (emaLogBox) emaLogBox.innerText = data.dynamicEmaLog;
      }
      }
    } else if(tabId === 'provider') {
      document.getElementById('providerSection').style.display = 'block';
        loadProviderStatus();
      document.getElementById('providerLink').classList.add('active');
      
      // Hide the main grids and header so providerSection is the only thing visible
      const vps = document.getElementById('vpsMainGrid');
      const pamm = document.getElementById('pammDashboardSection');
      const stats = document.getElementById('vpsStatsGrid');
      const tabs = document.querySelector('.pamm-vps-tab-container');
      const header = document.querySelector('header');
      
      if(vps) vps.style.display = 'none';
      if(pamm) pamm.style.display = 'none';
      if(stats) stats.style.display = 'none';
      if(tabs) tabs.style.display = 'none';
      if(header) header.style.display = 'none';

      loadProviderData();
    }
  }

  // Define formatCurrency if it's not defined
  function formatCur(val) {
      if(!val) return '$0.00';
      return '$' + parseFloat(val).toFixed(2);
  }

  window.copyProvToken = function() {
    const el = document.getElementById('provTokenDisplay');
    if(el && el.textContent && el.textContent !== 'Carregando...') {
      navigator.clipboard.writeText(el.textContent).then(() => {
        showToast('Token copiado com sucesso!', 'success');
      }).catch(err => {
        console.error('Failed to copy token', err);
        showToast('Erro ao copiar token', 'error');
      });
    }
  };

  async function loadProviderStatus() {
    try {
      const token = localStorage.getItem('aura_token');
      const res = await fetch('/api/user/provider/status', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();

      const applyContainer    = document.getElementById('providerApplyContainer');
      const pendingContainer  = document.getElementById('providerPendingContainer');
      const rejectedContainer = document.getElementById('providerRejectedContainer');
      const dashContainer     = document.getElementById('providerDashboardContainer');

      // Hide all
      [applyContainer, pendingContainer, rejectedContainer].forEach(el => { if(el) el.style.display = 'none'; });
      if(dashContainer) dashContainer.style.display = 'none';

      const status = data.status || 'NONE';
      if (status === 'NONE') {
        if(applyContainer) applyContainer.style.display = 'block';
      } else if (status === 'PENDING') {
        if(pendingContainer) pendingContainer.style.display = 'block';
      } else if (status === 'REJECTED') {
        if(rejectedContainer) rejectedContainer.style.display = 'block';
      } else if (status === 'APPROVED') {
        if(dashContainer) dashContainer.style.display = 'block';
        loadProviderData();
      }
    } catch(err) {
      console.error('loadProviderStatus error:', err);
      // On error, show apply form as fallback
      const applyContainer = document.getElementById('providerApplyContainer');
      if(applyContainer) applyContainer.style.display = 'block';
    }
  }

  async function submitProviderApplication(btn) {
    const name  = (document.getElementById('providerApplyName')  || {}).value || '';
    const email = (document.getElementById('providerApplyEmail') || {}).value || '';

    if(!name.trim() || !email.trim()) {
      alert('Por favor preencha o Nome e o Email!');
      return;
    }

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A enviar...';

    try {
      const token = localStorage.getItem('aura_token');
      const res = await fetch('/api/user/provider/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim() })
      });
      const data = await res.json();
      if(data.success) {
        alert('Candidatura enviada com sucesso! Aguarde a aprovação da equipa.');
        loadProviderStatus();
      } else {
        alert('Erro: ' + (data.error || 'Algo correu mal.'));
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    } catch(err) {
      alert('Erro de rede. Tente novamente.');
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  async function loadProviderData() {
    try {
      const token = localStorage.getItem('aura_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Stats
      const resStats = await fetch('/api/user/provider/stats', { headers });
      if (resStats.ok) {
        const { stats } = await resStats.json();
        if(document.getElementById('provTokenDisplay')) {
          document.getElementById('provTokenDisplay').textContent = stats.token || 'N/A';
        }
        if(document.getElementById('provTotalDeposited')) {
          document.getElementById('provTotalDeposited').textContent = formatCur(stats.totalGasDeposited);
        }
        document.getElementById('provTotalEarnings').textContent = formatCur(stats.totalGasEarned);
        document.getElementById('provAvailable').textContent = formatCur(stats.availableGas);
        document.getElementById('provWithdrawAvailable').textContent = formatCur(stats.availableGas);
        document.getElementById('provWithdrawn').textContent = formatCur(stats.totalGasWithdrawn);
      }

      // Clients
      const resClients = await fetch('/api/user/provider/clients', { headers });
      if (resClients.ok) {
        const { clients } = await resClients.json();
        const tbody = document.getElementById('provClientsTable');
        tbody.innerHTML = '';
        clients.forEach(c => {
          const d = new Date(c.registeredOn).toLocaleDateString();
          tbody.innerHTML += `
            <tr>
              <td>${c.email}</td>
              <td>${d}</td>
              <td>${formatCur(c.totalGasPaid)}</td>
            </tr>
          `;
        });
      }

      // Withdrawals
      const resW = await fetch('/api/user/provider/withdrawals', { headers });
      if (resW.ok) {
        const { withdrawals } = await resW.json();
        const tbody = document.getElementById('provWithdrawalsTable');
        tbody.innerHTML = '';
        withdrawals.forEach(w => {
          const d = new Date(w.createdAt).toLocaleDateString();
          let statusHtml = '';
          if(w.status === 'PENDING') statusHtml = '<span class="status-badge" style="background:var(--warn);color:#000;">Pendente</span>';
          else if(w.status === 'APPROVED') statusHtml = '<span class="status-badge" style="background:var(--bull);color:#000;">Aprovado</span>';
          else statusHtml = '<span class="status-badge" style="background:var(--bear);color:#fff;">Rejeitado</span>';
          
          tbody.innerHTML += `
            <tr>
              <td>${d}</td>
              <td style="font-weight:700; color:var(--text);">${formatCur(w.amount)}</td>
              <td>${w.network}<br><small style="color:var(--muted);">${w.walletAddress}</small></td>
              <td>${statusHtml}</td>
            </tr>
          `;
        });
      }
    } catch(e) {
      console.error(e);
    }
  }

  async function requestProvWithdraw() {
    const amount = document.getElementById('provWithdrawAmount').value;
    const address = document.getElementById('provWithdrawAddress').value;
    const network = document.getElementById('provWithdrawNetwork').value;

    if(!amount || amount <= 0) return alert('Insira um montante válido.');
    if(!address) return alert('Insira o endereço da carteira.');

    try {
      const token = localStorage.getItem('aura_token');
      const res = await fetch('/api/user/provider/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount, walletAddress: address, network })
      });
      const data = await res.json();
      if(data.success) {
        alert('Saque solicitado com sucesso!');
        document.getElementById('provWithdrawAmount').value = '';
        document.getElementById('provWithdrawAddress').value = '';
        loadProviderData();
      } else {
        alert('Erro: ' + data.error);
      }
    } catch(e) {
      alert('Erro de comunicação.');
    }
  }

function formatCurrency(val, currency = "USD") {
  if (val === undefined || val === null) return "---";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(val);
}

let isDailyLocked = false;

// ─── GEMINI API KEY — Save & Load ─────────────────────
function saveGeminiApiKey() {
  const key = document.getElementById("apiKey").value.trim();
  if (!key) {
    alert("Por favor insira a sua API Key antes de guardar.");
    return;
  }
  localStorage.setItem("aura_gemini_key", key);
  const msg = document.getElementById("apiKeySaveMsg");
  const btn = document.getElementById("saveApiKeyBtn");
  msg.style.display = "block";
  btn.textContent = "Guardado!";
  setTimeout(() => {
    msg.style.display = "none";
    btn.textContent = "Guardar";
  }, 2500);
}

function loadSavedGeminiKey() {
  const saved = localStorage.getItem("aura_gemini_key");
  if (saved) {
    const input = document.getElementById("apiKey");
    if (input) input.value = saved;
  }
}

// ─── DIAGNÓSTICO REMOTO (Expert) ───────────────
async function remoteLog(msg, level = "INFO") {
  try {
    fetch("/api/debug/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msg, level })
    }).catch(e => {});
  } catch(e) {}
}

// ─── AUTH CHECK (Auditado) ────────────────────────
let currentUser = null;

// ─── SIDEBAR TOGGLE ──────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById("sidebarNav");
  const overlay = document.querySelector(".sidebar-overlay");
  sidebar.classList.toggle("active");
  overlay.classList.toggle("active");
}

async function checkAuth() {
  console.log("%c[AuraAuth] Iniciando verificação de segurança...", "color: cyan; font-weight: bold; font-size: 12px;");
  const token = localStorage.getItem("aura_token");
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  // 1. Mostrar email IMEDIATAMENTE do token
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    const payload = JSON.parse(jsonPayload);
    
    if (payload.email) {
      document.getElementById("userEmail").textContent = payload.email;
      console.log("[AuraAuth] Email extraído do token:", payload.email);
    }
    
    // Se o token já diz que é ADMIN, injeta logo o botão
    if (payload.role === "ADMIN") injectAdminButton();
  } catch(e) {
    console.error("[AuraAuth] Falha na leitura rápida do token:", e);
  }
  
  // 2. Sincronização em tempo real com o servidor para garantir
  retrySync(3);
}

async function retrySync(attempts) {
  console.log(`[AuraAuth] Sincronizando com o servidor... (Tentativas: ${attempts})`);
  try {
    const data = await apiFetch("/api/auth/me");
    if (data.success && data.user) {
      currentUser = data.user;
      
      // Atualiza email com dado oficial do servidor
      document.getElementById("userEmail").textContent = currentUser.email;
      console.log("[AuraAuth] Sessão sincronizada com o servidor para:", currentUser.email);
      
      injectAffiliateButton();
      
      if (currentUser.role === "ADMIN") {
        injectAdminButton();
      }
      
      if (currentUser.role === 'ADMIN') {
        document.getElementById('adminLink').style.display = 'flex';
      }
      
      const hasActiveLicense = currentUser.license && currentUser.license.status === 'ACTIVE';
      if (currentUser.isProvider || hasActiveLicense) {
        document.getElementById('providerLink').style.display = 'flex';
      }
      
      userLicense = currentUser.license;
      updateLicenseUI();
    } else if (attempts > 0) {
      setTimeout(() => retrySync(attempts - 1), 1000);
    }
  } catch(e) {
    if (attempts > 0) setTimeout(() => retrySync(attempts - 1), 2000);
  }
}

function injectAdminButton() {
  const sidebarAdminLink = document.getElementById("adminLink");
  if (sidebarAdminLink) sidebarAdminLink.style.display = "flex";

  const controls = document.querySelector(".controls");
  if (!controls) {
    console.warn("[AuraAuth] Container '.controls' não encontrado ainda. Retentando em 500ms...");
    setTimeout(injectAdminButton, 500);
    return;
  }

  if (document.getElementById("adminPanelBtn")) return;
  
  const adminBtn = document.createElement("button");
  adminBtn.className = "btn btn-secondary";
  adminBtn.id = "adminPanelBtn";
  adminBtn.innerHTML = "PAINEL ADMIN";
  adminBtn.style.marginRight = "10px";
  adminBtn.style.border = "2px solid #00d4ff";
  adminBtn.style.boxShadow = "0 0 15px rgba(0,212,255,0.4)";
  adminBtn.style.fontWeight = "bold";
  adminBtn.onclick = () => window.location.href = "/admin_dashboard.html";
  
  controls.prepend(adminBtn);
  console.log("%c[AuraAuth] BOTÃO INJETADO COM SUCESSO!", "color: yellow; font-weight: bold;");
}

function injectAffiliateButton() {
  const sidebarAffLink = document.querySelector('.nav-item[href="/affiliate_dashboard.html"]');
  if (sidebarAffLink) sidebarAffLink.style.display = "flex";

  const controls = document.querySelector(".controls");
  if (!controls) return;
  if (document.getElementById("affiliatePanelBtn")) return;
  const affiliateBtn = document.createElement("button");
  affiliateBtn.className = "btn btn-secondary";
  affiliateBtn.id = "affiliatePanelBtn";
  affiliateBtn.innerHTML = "AFILIADOS";
  affiliateBtn.style.marginRight = "10px";
  affiliateBtn.style.border = "2px solid var(--accent2)";
  affiliateBtn.style.boxShadow = "0 0 15px rgba(124,58,237,0.4)";
  affiliateBtn.style.fontWeight = "bold";
  affiliateBtn.onclick = () => window.location.href = "/affiliate_dashboard.html";
  controls.prepend(affiliateBtn);
}

if (document.readyState === 'complete') {
  checkAuth();
} else {
  window.addEventListener('load', checkAuth);
}

async function goToCrypto() {
  try {
    const btn = document.getElementById('btnNavCrypto');
    if (btn) btn.innerHTML = '<i class="fab fa-bitcoin"></i><span>A iniciar...</span>';
    const token = localStorage.getItem('aura_token');
    const res = await fetch('/api/auth/sso-token', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) throw new Error("Falha ao gerar token SSO");
    const data = await res.json();
    window.location.href = 'https://crypto.auratradebots.com/?sso_token=' + data.ssoToken;
  } catch (err) {
    console.error(err);
    alert("Erro ao iniciar sessão no AuraCrypto: " + err.message);
    const btn = document.getElementById('btnNavCrypto');
    if (btn) btn.innerHTML = '<i class="fab fa-bitcoin"></i><span>Crypto Hub</span>';
  }
}

let userLicense = null;

// Removida checkLicenseStatus antiga, agora integrada no syncSession

// updateLicenseUI foi movida para o fim do arquivo para unificação

function openModal(id) { document.getElementById(id).classList.add("active"); }
function closeModal(id) { document.getElementById(id).classList.remove("active"); }


function logout() {
  localStorage.removeItem("aura_token");
  localStorage.removeItem("aura_startup_broker");
  window.location.href = "/login.html";
}

function dashTogglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? 'Ocultar' : 'Mostrar';
}

function openChangePwModal() {
  document.getElementById('cpCurrentPw').value = '';
  document.getElementById('cpNewPw').value = '';
  document.getElementById('cpConfirmPw').value = '';
  const msg = document.getElementById('cpMsg');
  msg.style.display = 'none';
  document.getElementById('changePwModal').style.display = 'flex';
}

function closeChangePwModal() {
  document.getElementById('changePwModal').style.display = 'none';
}

async function doChangePassword() {
  const currentPassword = document.getElementById('cpCurrentPw').value;
  const newPassword = document.getElementById('cpNewPw').value;
  const confirmPassword = document.getElementById('cpConfirmPw').value;
  const msg = document.getElementById('cpMsg');

  if (!currentPassword || !newPassword || !confirmPassword) {
    msg.style.display = 'block';
    msg.style.background = 'rgba(255,68,68,0.1)';
    msg.style.color = 'var(--bear)';
    msg.textContent = 'Preencha todos os campos.';
    return;
  }
  if (newPassword !== confirmPassword) {
    msg.style.display = 'block';
    msg.style.background = 'rgba(255,68,68,0.1)';
    msg.style.color = 'var(--bear)';
    msg.textContent = 'As novas passwords não coincidem.';
    return;
  }
  if (newPassword.length < 6) {
    msg.style.display = 'block';
    msg.style.background = 'rgba(255,68,68,0.1)';
    msg.style.color = 'var(--bear)';
    msg.textContent = 'A nova password deve ter pelo menos 6 caracteres.';
    return;
  }

  const data = await apiFetch('/api/user/change-password', 'POST', { currentPassword, newPassword });
  msg.style.display = 'block';
  if (data.success) {
    msg.style.background = 'rgba(0,230,118,0.1)';
    msg.style.color = 'var(--bull)';
    msg.textContent = 'Password alterada com sucesso!';
    setTimeout(closeChangePwModal, 1500);
  } else {
    msg.style.background = 'rgba(255,68,68,0.1)';
    msg.style.color = 'var(--bear)';
    msg.textContent = '' + (data.error || 'Erro desconhecido.');
  }
}
// ─── UTILITÁRIOS E SIMULADORES ────────────────
const PRICES = { EURUSD:1.0850, GBPUSD:1.2650, USDJPY:149.50, XAUUSD:2320.0, GBPJPY:189.0, EURGBP:0.8580 };

function isActiveSession() {
  return true; 
}

function simulateAIBias(pair) {
  const biases = ["BULLISH", "BEARISH", "NEUTRAL"];
  const random = Math.random();
  const bias = random > 0.6 ? biases[0] : (random > 0.2 ? biases[1] : biases[2]);
  return { 
    bias, 
    confidence: Math.floor(Math.random() * 30) + 60, 
    reasoning: "Análise SMC confirmada em H1/M15 com fluxo de ordens institucional." 
  };
}

function updateBiasUI(pair, bias, confidence) {
  const row = document.getElementById(`bias-${pair}`);
  if (!row) return;
  const tag = row.querySelector(".bias-tag");
  const conf = row.querySelector(".bias-conf");
  
  if (tag) {
    tag.textContent = bias;
    tag.className = `bias-tag ${bias === "BULLISH" ? "bull" : bias === "BEARISH" ? "bear" : "neut"}`;
  }
  if (conf) conf.textContent = `${confidence}%`;
}

function simulateSignal(pair, candles, price) {
  // Aumentado para 40% para testes imediatos
  if (Math.random() > 0.40) return null; 
  
  const direction = Math.random() > 0.5 ? "BUY" : "SELL";
  const pip = pair.includes("JPY") ? 0.01 : (pair.includes("XAU") ? 1 : 0.0001);
  const slPips = 18 + Math.floor(Math.random() * 5);
  const tpPips = slPips * 1.5; // Sincronizado com 1.5 RR Ratio
  
  const sl = direction === "BUY" ? price - (slPips * pip) : price + (slPips * pip);
  const tp = direction === "BUY" ? price + (tpPips * pip) : price - (tpPips * pip);
  
  return {
    pair, direction, entry: price, sl, tp,
    score: Math.floor(Math.random() * 25) + 60,
    rr: (tpPips / slPips).toFixed(1),
    factors: { 
      smcStructure: true, 
      orderBlock: Math.random() > 0.4, 
      fvg: Math.random() > 0.5,
      emaAlignment: true 
    },
    timestamp: new Date().toISOString()
  };
}

function updatePositionsUI(positions) {
  document.getElementById("statOpen").textContent = `${positions.length} / 3`;
  // PNL e Equity já são tratados no updateStats()
}

async function checkBrokerConnection() {
  try {
    const data = await getBrokerStatus();
    if (data && data.connected) {
      brokerConnected = true;
      brokerInfo = data.accountInfo;
      updateBrokerUI();
      addLog(`🔄 Conexão restaurada automaticamente: ${brokerInfo.broker}`, "buy");
    }
  } catch(e) {
    console.warn("Falha ao verificar status inicial do broker.");
  }
}

// ─── PERSISTÊNCIA DE CONFIGURAÇÕES ─────────────
async function saveConfig() {
  const config = {
    risk: document.getElementById("riskSlider").value,
    score: document.getElementById("scoreSlider").value,
    interval: document.getElementById("interval").value,
    orderLimit: document.getElementById("limitSlider").value,
    botRunning: isRunning,
    activePairs: Array.from(activePairs).join(","),
    geminiKey: localStorage.getItem("aura_gemini_key")
  };
  
  // Backup local e Monitor de Estado
  localStorage.setItem("aura_bot_config", JSON.stringify(config));
  localStorage.setItem("aura_bot_state", isRunning ? "running" : "stopped");
  localStorage.setItem("bot_running", isRunning ? "true" : "false");
  
  // Sincronização com Servidor
  try {
    await apiFetch("/api/user/settings", "POST", config);
    remoteLog("Configurações sincronizadas com o servidor.");
  } catch(e) {
    console.warn("Falha ao sincronizar com o servidor, guardado localmente.");
  }
}

async function loadConfig() {
  // 1. Tentar carregar do servidor (Nuvem)
  try {
    const data = await apiFetch("/api/user/settings");
    if (data.success && data.settings) {
      const s = data.settings;
      document.getElementById("riskSlider").value = s.risk;
      document.getElementById("riskVal").textContent = s.risk;
      document.getElementById("scoreSlider").value = s.score;
      document.getElementById("scoreVal").textContent = s.score;
      document.getElementById("interval").value = s.interval;
      if (s.orderLimit) {
        document.getElementById("limitSlider").value = s.orderLimit;
        updateLimitUI(s.orderLimit);
      }
      if (s.botRunning) {
        localStorage.setItem("bot_running", "true");
        setTimeout(() => { if (!isRunning) startBot(); }, 2000);
      } else {
        localStorage.setItem("bot_running", "false");
      }
      if (s.activePairs) activePairs = new Set(s.activePairs.split(","));
      
      if (s.geminiKey) {
        localStorage.setItem("aura_gemini_key", s.geminiKey);
        loadSavedGeminiKey();
      }
      
      initPairsGrid();
      addLog("⚙️ Definições sincronizadas com a nuvem.");
      return;
    }
  } catch(e) {
    console.warn("Erro ao carregar da nuvem, tentando local...");
  }

  // 2. Fallback para localStorage
  const saved = localStorage.getItem("aura_bot_config");
  if (saved) {
    try {
      const config = JSON.parse(saved);
      document.getElementById("riskSlider").value = config.risk;
      document.getElementById("riskVal").textContent = config.risk;
      document.getElementById("scoreSlider").value = config.score;
      document.getElementById("scoreVal").textContent = config.score;
      document.getElementById("interval").value = config.interval;
      if (config.orderLimit) {
        document.getElementById("limitSlider").value = config.orderLimit;
        updateLimitUI(config.orderLimit);
      }
      if (config.activePairs) activePairs = new Set(Array.isArray(config.activePairs) ? config.activePairs : config.activePairs.split(","));
      initPairsGrid();
      addLog("⚙️ Configurações locais carregadas.");
    } catch(e) {}
  }
}

// ─── ESTADO ───────────────────────────────────
window.onerror = function(msg, url, line, col, error) {
  if (typeof addLog === 'function') {
    addLog(`❌ ERRO CRÍTICO: ${msg} (Linha: ${line})`, "sell");
  }
  return false;
};

const VERSION = "2.5.2-RR-FIX";
const PAIRS = ["EURUSD","GBPUSD","USDJPY","XAUUSD","GBPJPY","EURGBP"];
let activePairs = new Set(["EURUSD","GBPUSD","USDJPY","XAUUSD","GBPJPY"]);
let isRunning = false;
let loopTimer = null;
let currentLoopId = 0;
let sigCount = 0;
let tradeCount = 0;
let wins = 0;
let losses = 0;
let botStartTime = 0;
let lastTradeTime = {};
let signals = [];
let openTrades = [];
let maxProfitTrack = {}; // Rastreia o lucro máximo atingido por cada ordem para a trava de 1%
let uptimeInterval = null;

const BIASES = {};
PAIRS.forEach(p => BIASES[p] = { bias:"NEUTRAL", confidence:0 });

// ─── BROKER STATE ─────────────────────────────
let brokerConnected = false;
let brokerInfo = null;

// ─── INIT UI ─────────────────────────────────
function initPairsGrid() {
  const g = document.getElementById("pairsGrid");
  g.innerHTML = "";
  PAIRS.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "pair-toggle" + (activePairs.has(p) ? " active" : "");
    btn.textContent = p;
    btn.onclick = () => {
      activePairs.has(p) ? activePairs.delete(p) : activePairs.add(p);
      btn.classList.toggle("active");
      saveConfig();
    };
    g.appendChild(btn);
  });
}

function initBiases() {
  const el = document.getElementById("aiBiases");
  if (!el) return;
  el.innerHTML = "";
  PAIRS.forEach(p => {
    // Garante que existe um bias inicial para não dar erro de undefined
    if (!BIASES[p]) BIASES[p] = { bias: "NEUTRAL", confidence: 0 };
    
    const b = BIASES[p];
    const cls = b.bias === "BULLISH" ? "bull" : b.bias === "BEARISH" ? "bear" : "neut";
    el.innerHTML += `
      <div class="bias-row" id="bias-${p}">
        <span class="bias-pair">${p}</span>
        <span class="bias-tag ${cls}">${b.bias}</span>
        <span class="bias-conf">${b.confidence}%</span>
      </div>`;
  });
}

// ─── LOG ───────────────────────────────────────
// --- SISTEMA DE LOGS COM PERSISTÊNCIA ---
function addLog(msg, type = "info") {
  const now = new Date().toLocaleTimeString("pt-PT");
  const area = document.getElementById("logArea");
  if (!area) return;

  const line = document.createElement("div");
  line.className = "log-line";
  line.innerHTML = `<span class="log-time">[${now}]</span><span class="log-msg ${type}">${msg}</span>`;
  area.appendChild(line);
  area.scrollTop = area.scrollHeight;

  // Salvar no Navegador (Persistência)
  const logs = JSON.parse(localStorage.getItem('bot_logs') || '[]');
  logs.push({ msg, type, time: now });
  if (logs.length > 100) logs.shift(); // Limite de 100 logs
  localStorage.setItem('bot_logs', JSON.stringify(logs));
}

function restoreLogs() {
  const logs = JSON.parse(localStorage.getItem('bot_logs') || '[]');
  const area = document.getElementById("logArea");
  if (!area || logs.length === 0) return;

  logs.forEach(l => {
    const line = document.createElement("div");
    line.className = "log-line";
    line.innerHTML = `<span class="log-time">[${l.time}]</span><span class="log-msg ${l.type}">${l.msg}</span>`;
    area.appendChild(line);
  });
  area.scrollTop = area.scrollHeight;
}

function auraClearSystemLogs() { 
  localStorage.removeItem('bot_logs');
  document.getElementById("logArea").innerHTML = ""; 
  console.log("[UI] Logs do sistema limpos.");
}

// ─── UPTIME TIMER ─────────────────────────────
function updateUptime() {
  if (!botStartTime) return;
  const diff = Date.now() - botStartTime;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const formatted = 
    String(hours).padStart(2, '0') + ":" + 
    String(minutes).padStart(2, '0') + ":" + 
    String(seconds).padStart(2, '0');
  document.getElementById("botUptime").textContent = formatted;
}

// ─── SIGNALS UI ───────────────────────────────
function addSignalCard(sig, execResult) {
  const list = document.getElementById("signalsList");
  const empty = list.querySelector(".empty-state");
  if (empty) empty.remove();

  const tagHtml = Object.entries(sig.factors || {})
    .filter(([,v]) => v)
    .map(([k]) => `<span class="tag active">${k}</span>`)
    .join("") || '<span class="tag">Sem tags</span>';

  let execHtml = '';
  if (execResult) {
    if (execResult.success) {
      const msg = execResult.message || `Executado #${execResult.orderId || ''}`;
      execHtml = `<span class="exec-badge success">✓ ${msg}</span>`;
    } else {
      execHtml = `<span class="exec-badge failed">✗ ${execResult.error || 'Falhou'}</span>`;
    }
  } else {
    execHtml = `<span class="exec-badge pending">⏳ Simulação</span>`;
  }

  const el = document.createElement("div");
  el.className = `signal-card ${(sig.direction || 'BUY').toLowerCase()}`;
  el.innerHTML = `
    <div class="signal-top">
      <span class="signal-pair">${sig.pair || 'SMC Signal'}</span>
      
      ${execResult && execResult.success && execResult.orderId ? `
        <div id="top-pnl-${execResult.orderId}" style="
          font-weight: 800; font-family: 'Space Mono', monospace; 
          font-size: 0.9rem; color: var(--muted);
          background: rgba(255,255,255,0.03);
          padding: 2px 8px; border-radius: 4px;
        ">$0.00</div>
        <button onclick="closeTradeNow('${execResult.orderId}', '${sig.pair}')" style="
          background: rgba(255,68,68,0.2); color: var(--bear); border: 1px solid rgba(255,68,68,0.3);
          border-radius: 4px; padding: 4px 10px; font-size: 0.62rem; 
          font-weight: 800; cursor: pointer; transition: all 0.2s;
          text-transform: uppercase;
        " onmouseover="this.style.background='var(--bear)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,68,68,0.2)'; this.style.color='var(--bear)';">Fechar</button>
      ` : ''}

      <span class="signal-dir ${(sig.direction || 'BUY').toLowerCase()}">${sig.direction || 'BUY'}</span>
    </div>
    <div class="signal-grid">
      <div class="sig-item"><span>Entrada</span><span>${sig.entry?.toFixed(5)}</span></div>
      <div class="sig-item"><span>Stop Loss</span><span style="color:var(--bear)">${sig.sl?.toFixed(5)}</span></div>
      <div class="sig-item"><span>Take Profit</span><span style="color:var(--bull)">${sig.tp?.toFixed(5)}</span></div>
    </div>
    <div class="signal-score">
      <div class="score-bar"><div class="score-fill" style="width:${sig.score}%"></div></div>
      <span class="score-label">${sig.score}%</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap;gap:6px;">
      <div class="signal-tags">${tagHtml}</div>
      <div style="display:flex;gap:8px;align-items:center;">
        ${execHtml}
        <span style="font-size:0.7rem;color:var(--muted);font-family:'Space Mono',monospace;">R:R ${sig.rr}</span>
      </div>
    </div>
    ${execResult && execResult.success && execResult.orderId ? `
      <div id="pnl-container-${execResult.orderId}" class="pnl-float-badge" style="
        margin-top: 10px;
        padding: 8px 12px;
        background: rgba(0,0,0,0.3);
        border-radius: 8px;
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        gap: 6px;
      ">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.7rem; color:var(--muted); font-weight:bold;">LUCRO AO VIVO:</span>
          <span id="pnl-val-${execResult.orderId}" style="font-weight:800; font-family:'Space Mono',monospace; font-size:1rem;">$0.00</span>
        </div>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top:6px;">
           <div style="display:flex; flex-direction:column;">
              <span style="font-size:0.55rem; color:var(--muted);">PICO ATINGIDO:</span>
              <span id="peak-pnl-${execResult.orderId}" style="font-size:0.75rem; font-family:'Space Mono',monospace; color:var(--accent);">$0.00</span>
           </div>
           <div style="display:flex; flex-direction:column; align-items:flex-end;">
              <span style="font-size:0.55rem; color:var(--muted);">GATILHO LOCK:</span>
              <span id="lock-trigger-${execResult.orderId}" style="font-size:0.75rem; font-family:'Space Mono',monospace; color:var(--warn);">--</span>
           </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px solid rgba(255,255,255,0.05); padding-top:6px;">
          <span style="font-size:0.6rem; color:var(--muted);">NÍVEIS BROKER:</span>
          <span style="font-size:0.65rem; font-family:'Space Mono',monospace;">
            SL: <span id="active-sl-${execResult.orderId}" style="color:var(--bear)">--</span> | 
            TP: <span id="active-tp-${execResult.orderId}" style="color:var(--bull)">--</span>
          </span>
        </div>
      </div>
    ` : ''}
  `;
  list.prepend(el);
  if (list.children.length > 20) list.removeChild(list.lastChild);

  // Expert Fix: Update Carousel Visibility
  updateSignalCarousel();

  // Salvar Sinais no Navegador com dados de execução para F5 Persistence
  const savedSigs = JSON.parse(localStorage.getItem('bot_signals') || '[]');
  const sigToSave = { ...sig, execResult }; 
  savedSigs.unshift(sigToSave);
  if (savedSigs.length > 20) savedSigs.pop();
  localStorage.setItem('bot_signals', JSON.stringify(savedSigs));
}

let activeSignalIdx = 0;
function updateSignalCarousel() {
    const list = document.getElementById("signalsList");
    const cards = list.querySelectorAll(".signal-card");
    const nav = document.getElementById("signalNav");
    const indexEl = document.getElementById("signalIndex");
    
    if (cards.length <= 1) {
        nav.style.display = "none";
        cards.forEach(c => c.style.display = "flex");
        activeSignalIdx = 0;
        return;
    }
    
    nav.style.display = "flex";
    if (activeSignalIdx >= cards.length) activeSignalIdx = 0;
    
    cards.forEach((c, idx) => {
        c.style.display = (idx === activeSignalIdx) ? "flex" : "none";
    });
    
    indexEl.textContent = `${activeSignalIdx + 1}/${cards.length}`;
}

function nextSignal() {
    const cards = document.querySelectorAll("#signalsList .signal-card");
    if (cards.length === 0) return;
    activeSignalIdx = (activeSignalIdx + 1) % cards.length;
    updateSignalCarousel();
}

function prevSignal() {
    const cards = document.querySelectorAll("#signalsList .signal-card");
    if (cards.length === 0) return;
    activeSignalIdx = (activeSignalIdx - 1 + cards.length) % cards.length;
    updateSignalCarousel();
}

async function closeTradeNow(positionId, pair) {
  if (!confirm(`Deseja realmente fechar a ordem ${pair} (#${positionId}) agora?`)) return;
  
  addLog(`🛠️ Solicitando fechamento manual: ${pair} #${positionId}...`, "info");
  try {
    const res = await apiFetch("/api/broker/close", "POST", { positionId });
    if (res.success) {
      addLog(`✅ Sucesso: ${pair} #${positionId} fechada manualmente.`, "buy");
      // Feedback visual no card
      const topPnl = document.getElementById(`top-pnl-${positionId}`);
      if (topPnl) topPnl.textContent = "FECHADA";
    } else {
      addLog(`❌ Erro ao fechar: ${res.error}`, "sell");
      alert("Erro ao fechar ordem: " + res.error);
    }
  } catch(e) {
    addLog(`❌ Erro de conexão: ${e.message}`, "sell");
  }
}

function highlightSection(id) {
    const el = document.getElementById(id);
    const panel = el.closest('.panel');
    if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        panel.classList.remove('highlight-panel');
        void panel.offsetWidth; // Trigger reflow
        panel.classList.add('highlight-panel');
    }
}

async function loadHistoryAndScroll() {
    await loadHistory();
    highlightSection('historyTableBody');
}

function restoreSignals() {
  const savedSigs = JSON.parse(localStorage.getItem('bot_signals') || '[]');
  const list = document.getElementById("signalsList");
  if (!list || savedSigs.length === 0) return;
  
  const empty = list.querySelector(".empty-state");
  if (empty) empty.remove();

  // Ordem cronológica inversa para prepend funcionar corretamente
  [...savedSigs].reverse().forEach(sig => {
      // Limpeza de erros legados (createOrder)
      if (sig.execResult && !sig.execResult.success && sig.execResult.error && sig.execResult.error.includes("createOrder")) {
          return; // Não restaura sinais com erro legado
      }
      // Usar a mesma função addSignalCard para manter IDs e Badges
      addSignalCard(sig, sig.execResult);
  });
  
  // Limpeza forçada do localStorage se houver lixo legado
  const cleanedSigs = savedSigs.filter(s => !(s.execResult && !s.execResult.success && s.execResult.error && s.execResult.error.includes("createOrder")));
  if (cleanedSigs.length !== savedSigs.length) {
      localStorage.setItem('bot_signals', JSON.stringify(cleanedSigs));
      console.log("[CLEANUP] Sinais com erro legado 'createOrder' removidos.");
  }
}

// ═══════════════════════════════════════════════
//  BROKER API CALLS & AUTH
// ═══════════════════════════════════════════════

// Logout centralizado removido por duplicidade (já existe na linha 1256)


async function apiFetch(endpoint, method = "GET", body = null) {
  const token = localStorage.getItem("aura_token");
  remoteLog(`API_CALL: ${method} ${endpoint} (Token local: ${token ? 'Presente' : 'Ausente'})`);

  if (!token) {
    remoteLog("API_ABORT: Chamada abortada por falta de token", "ERROR");
    // Bloqueado para diagnóstico: window.location.href = "/login.html";
    return { success: false, error: "Sem sessão." };
  }

  const opts = { 
    method, 
    headers: { 
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    } 
  };
  
  if (body) opts.body = JSON.stringify(body);
  
  try {
    const res = await fetch(endpoint, opts);
    remoteLog(`API_RESPONSE: ${endpoint} Status=${res.status}`);

    if (res.status === 401) {
      remoteLog("API_401: Servidor rejeitou o token", "ERROR");
      // Desativado para auditoria: logout();
      return { success: false, error: "DEBUG: Sessão rejeitada pelo servidor (401)." };
    }
    
    // Tenta ler JSON, se falhar, retorna erro amigável e loga a resposta bruta
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch(e) {
      remoteLog("RAW_RESPONSE_ERROR: " + text.substring(0, 200), "ERROR");
      return { success: false, error: "Resposta inválida do servidor." };
    }
  } catch (err) {
    console.error("Erro de Rede:", err);
    return { success: false, error: "Erro de ligação ao servidor. Verifique a sua internet." };
  }
}

async function ConnectToBroker(brokerType, credentials) {
  const remember = document.getElementById("rememberCredentials").checked;
  return apiFetch("/api/broker/connect", "POST", { brokerType, credentials, remember });
}

async function disconnectBroker() {
  // Importante: Passamos forgetDb: false para NÃO apagar as credenciais da BD do servidor.
  // Assim o auto-connect funcionará no próximo login.
  return apiFetch("/api/broker/disconnect", "POST", { forgetDb: false });
}


async function getBrokerAccount() {
  return apiFetch("/api/broker/account");
}

async function getBrokerPositions() {
  return apiFetch("/api/broker/positions");
}

async function placeBrokerOrder(pair, direction, risk, sl, tp, entry) {
  return apiFetch("/api/broker/order", "POST", { pair, direction, risk, sl, tp, entry });
}

async function getBrokerCandles(pair, timeframe, count) {
  return apiFetch(`/api/broker/candles?pair=${pair}&timeframe=${timeframe || 'H1'}&count=${count || 250}`);
}

async function getBrokerPrice(pair) {
  return apiFetch(`/api/broker/price?pair=${pair}`);
}

async function getBrokerStatus() {
  return apiFetch("/api/broker/status");
}

// ═══════════════════════════════════════════════
//  LEGACY BROKER MODAL LOGIC REMOVED
// ═══════════════════════════════════════════════

// ─── HISTORY LOGIC ─────────────────────────────
let tradeHistoryRaw = [];

async function loadHistory() {
  const btn = document.querySelector('button[onclick="loadHistory()"]');
  if (btn) btn.textContent = "A carregar...";

  try {
    const data = await apiFetch("/api/broker/history");
    if (data && data.history) {
      tradeHistoryRaw = data.history;
      renderHistory();
    }
  } catch(e) {
    console.error("Erro ao puxar history:", e);
  } finally {
    if (btn) btn.textContent = "Atualizar";
  }
}

function clearHistory() {
  tradeHistoryRaw = [];
  renderHistory();
  addLog("🧹 Histórico local limpo.", "info");
}

function renderHistory() {
  const tbody = document.getElementById("historyTableBody");
  if (!tradeHistoryRaw || tradeHistoryRaw.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);font-family:\'Syne\',sans-serif;">Nenhum histórico disponível.</td></tr>';
    return;
  }

  const filterPair = document.getElementById("histFilterPair").value.toUpperCase().trim();
  const filterResult = document.getElementById("histFilterResult").value;
  const filterPeriod = document.getElementById("histFilterPeriod").value;

  const now = new Date();
  
  let filtered = tradeHistoryRaw.filter(t => {
    // Par filter
    if (filterPair && !t.pair.toUpperCase().includes(filterPair)) return false;

    // Res filter
    if (filterResult === "WIN" && t.pnl <= 0) return false;
    if (filterResult === "LOSS" && t.pnl > 0) return false;

    // Time filter
    if (filterPeriod !== "ALL") {
      const cTime = t.closeTime || t.closedAt || new Date();
      const closeDate = new Date(cTime);
      const diffDays = (now - closeDate) / (1000 * 3600 * 24);
      if (filterPeriod === "TODAY" && closeDate.toDateString() !== now.toDateString()) return false;
      if (filterPeriod === "WEEK" && diffDays > 7) return false;
    }

    return true;
  });

  const formatData = (d) => {
    try {
      const date = new Date(d);
      return date.toLocaleString();
    } catch(e) { return d; }
  };

  tbody.innerHTML = filtered.map(t => {
    // Dividir os resultados por 100 se for uma conta Cent
    const isCent = t.isCent || (t.accountCurrency && t.accountCurrency.toLowerCase() === 'usc') || (window.brokerInfo && window.brokerInfo.currency === 'USC') || false;
    const divider = isCent ? 100 : 1;
    const realPnl = (t.pnl || t.profit || 0) / divider;

    const pnlClass = realPnl > 0 ? 'bull' : (realPnl < 0 ? 'bear' : '');
    const pnlColor = realPnl > 0 ? 'var(--bull)' : (realPnl < 0 ? 'var(--bear)' : 'inherit');
    const pnlStr = realPnl > 0 ? `+$${realPnl.toFixed(2)}` : `-$${Math.abs(realPnl).toFixed(2)}`;
    const dirColor = t.direction === "BUY" ? 'var(--bull)' : 'var(--bear)';
    const cTime = t.closeTime || t.closedAt;
    const brokerName = t.broker || 'MT5';
    
    return `
      <tr>
        <td>${cTime ? formatData(cTime) : '—'}</td>
        <td style="color:var(--muted);">${brokerName}</td>
        <td style="font-weight:700;">${t.pair}</td>
        <td>${t.lotSize}</td>
        <td style="color:${dirColor};">${t.direction}</td>
        <td style="font-weight:700; color:${pnlColor};">${pnlStr}</td>
      </tr>
    `;
  }).join("");
}

// Inicializar ao conectar
// (chamado de modais ou updates)

// ─── DISCONNECT ───────────────────────────────
async function doDisconnect() {
  const ConnectBtn = document.getElementById("ConnectBtn");
  ConnectBtn.disabled = true;
  ConnectBtn.textContent = "A desconectar...";

  // Safety timeout: always re-enable the button after 5s no matter what
  const safetyTimer = setTimeout(() => {
    brokerConnected = false;
    brokerInfo = null;
    openTrades = [];
    updateBrokerUI();
    addLog("🔌 MetaTrader 5 desconectada.", "sell");
  }, 5000);

  try {
    await disconnectBroker();
  } catch(e) {
    console.warn("Disconnect API error (ignored):", e.message);
  } finally {
    clearTimeout(safetyTimer);
  }

  brokerConnected = false;
  brokerInfo = null;
  openTrades = [];

  // Stop bot if running (use isRunning variable)
  if (typeof isRunning !== 'undefined' && isRunning) stopBot();

  updateBrokerUI();
  addLog("🔌 MetaTrader 5 desconectada.", "sell");
  ConnectBtn.disabled = false;
}

// ─── UPDATES ──────────────────────────────────
async function checkBrokerConnection() {
  try {
    const status = await getBrokerStatus();
    if (status && status.success && status.connected) {
       brokerConnected = true;
       brokerInfo = status.accountInfo || status.account || status.info;
       updateBrokerUI();
       addLog("🔄 Conexão com a MetaTrader 5 restaurada automaticamente.", "buy");
    }
  } catch (e) {
    console.warn("Falha ao verificar status da MetaTrader 5:", e.message);
  }
}

async function updateBrokerUI() {
  const badge = document.getElementById("eaBadge");
  const dot = document.getElementById("eaDot");
  const statusText = document.getElementById("eaStatusText");
  const mainBtn = document.getElementById("mainBtn");
  const setupBtn = document.getElementById("setupEABtn");

  if (brokerConnected && brokerInfo) {
    if (badge) badge.className = "status-badge connected";
    if (dot) dot.className = "dot active";

    const typeBadge = brokerInfo.accountType === "LIVE"
      ? '<span class="account-type-badge live">LIVE</span>'
      : '<span class="account-type-badge demo">DEMO</span>';

    if (statusText) statusText.innerHTML = `MT5: ${brokerInfo.broker} ${typeBadge}`;
    
    // Update balance
    const balanceEl = document.getElementById("statBalance");
    const balanceSubEl = document.getElementById("statBalanceSub");
    if (balanceEl) balanceEl.textContent = formatCurrency(brokerInfo.balance, brokerInfo.currency);
    if (balanceSubEl) balanceSubEl.textContent = `${brokerInfo.broker} · ${brokerInfo.accountType}`;

    addLog(`✅ MT5 Conectada: ${brokerInfo.broker} | Saldo: ${formatCurrency(brokerInfo.balance, brokerInfo.currency)}`, "buy");
    
    if (signals.length > 0 || openTrades.length === 0) {
       addLog("🧹 Sincronizando ambiente de trading...");
       // Mantemos os sinais se houver ordens abertas para não perder o rasto visual
       if (openTrades.length === 0) {
         signals = [];
         localStorage.setItem('bot_signals', '[]');
         document.getElementById("signalsList").innerHTML = `
          <div class="empty-state">
            <div class="em-icon">🔍</div>
            <p>MetaTrader 5 conectada. Inicie o bot para receber sinais SMC.</p>
          </div>`;
       }
    }
  } else {
    if (badge) badge.className = "status-badge offline";
    if (dot) dot.className = "dot danger";
    if (statusText) statusText.textContent = "EA: Offline";

    const balanceEl = document.getElementById("statBalance");
    const balanceSubEl = document.getElementById("statBalanceSub");
    if (balanceEl) balanceEl.textContent = "—";
    if (balanceSubEl) balanceSubEl.textContent = "Conecte o EA no MetaTrader 5";
  }
}

function updateLimitUI(val) {
    const limitVal = document.getElementById('limitVal');
    const statLimitDisplay = document.getElementById('statLimitDisplay');
    const statOpen = document.getElementById('statOpen');
    
    if (limitVal) limitVal.textContent = val;
    if (statLimitDisplay) statLimitDisplay.textContent = val;
    
    if (statOpen) {
        const parts = statOpen.textContent.split(' / ');
        const current = parts[0] || '0';
        statOpen.textContent = `${current} / ${val}`;
    }
}

let isFirstConnection = true;

async function updateStats() {
  console.log("[HMI] Iniciando atualização de estatísticas...");
  try {
    // Sincronização da Carteira PAMM
    loadUserWallet().catch(e => {});

    // 1. Sincronização Institucional (Status do Cérebro)
    const status = await apiFetch("/api/user/status");
    console.log("[HMI] Status recebido:", status);
    if (status && status.success) {
      if (isRunning && isFirstConnection) {
         isFirstConnection = false;
         const h = new Date().getUTCHours();
         addLog(`🔄 Sincronização HMI [${VERSION}]: A comunicar com MetaTrader 5... (UTC: ${h}h)`, "info");
         addLog(`🚀 AURA V8 INSTITUCIONAL v8.1 - Execution Engine (FIXED)`, "buy");
         addLog(`✅ LICENÇA VALIDADA COM SUCESSO!`, "buy");
         addLog(`🔍 Iniciando Recuperação de Estado (Institutional Recovery)...`, "info");
         const startEq = status.dailyStartBalance ? status.dailyStartBalance.toFixed(2) : status.balance.toFixed(2);
         addLog(`📊 [BASELINE] DailyStartEquity inicializado: $${startEq} | Balance: $${status.balance.toFixed(2)}`, "info");
      }

      // 🛡️ CORREÇÃO CRÍTICA: Atualizar as openTrades globais com os dados do EA/Servidor!
      if (status.openTrades && Array.isArray(status.openTrades)) {
         openTrades = status.openTrades;
      }

      if (status.dynamicEmaLog) {
         const emaLogBox = document.getElementById("dynamicEmaLogBox");
         if (emaLogBox) emaLogBox.innerHTML = status.dynamicEmaLog.replace(/\n/g, '<br>');
      }

      // Saldo e Equity (Sincronizado via EA)
      const bal = (status.balance !== undefined && status.balance !== null) ? status.balance : 0;
      document.getElementById("statBalance").textContent = formatCurrency(bal, "USD");
      
      const realizedPnl = status.realizedPnl !== undefined ? status.realizedPnl : 0;
      const pnlEl = document.getElementById("statPnl");
      pnlEl.textContent = (realizedPnl >= 0 ? "+" : "") + formatCurrency(realizedPnl, "USD");
      pnlEl.className = "stat-value " + (realizedPnl >= 0 ? "bull" : "bear");

      

      // HMI Lock Management
      const lockOverlay = document.getElementById("dailyLockOverlay");
      const lossLockOverlay = document.getElementById("lossLockOverlay");
      const weekendOverlay = document.getElementById("weekendLockOverlay");
      const mainBtn = document.getElementById("mainBtn");
      
      const btnResetDaily = document.getElementById("btnResetDaily");
      const btnResetLoss = document.getElementById("btnResetLoss");
      
      if (btnResetDaily) btnResetDaily.style.display = status.canResetLocks ? "block" : "none";
      if (btnResetLoss) btnResetLoss.style.display = status.canResetLocks ? "block" : "none";
      
      if (status.isProfitLocked && !isDailyLocked) {
        addLog(`[SERVER-SYNC] Meta Diária Atingida no Servidor! Fechando posições...`, "info");
        addLog(`🏆 [DAILY] META ATINGIDA PELO BOT: $${(status.dailyPnl||0).toFixed(2)} >= Meta: $${(status.dailyTargetMoney||0).toFixed(2)} | Fechando posições...`, "success");
        addLog(`[ACTION] Fechando TODAS as posições para garantir lucro diário...`, "warn");
      } else if (!status.isProfitLocked && isDailyLocked) {
        addLog(`🌅 [SERVER-SYNC] Reset de Meta Diária detectado. Desbloqueando...`, "info");
      }

      isDailyLocked = status.isProfitLocked;

      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      
      const fridayHour = status.fridayBlockHour !== undefined ? status.fridayBlockHour : 12;
      const sundayHour = status.sundayOpenHour !== undefined ? status.sundayOpenHour : 22;

      const isWeekendBlocked = 
        (day === 5 && hour >= fridayHour) || 
        (day === 6) || 
        (day === 0 && hour < sundayHour);

      if (isWeekendBlocked) {
        lockOverlay.style.display = "none";
        if(lossLockOverlay) lossLockOverlay.style.display = "none";
        weekendOverlay.style.display = "flex";
        const wlt = document.getElementById("weekendLockTimer"); if (wlt.dataset.val !== String(sundayHour)) { wlt.textContent = `Domingo às ${sundayHour}h00`; wlt.dataset.val = String(sundayHour); }
        if (mainBtn) {
            mainBtn.disabled = true;
            if (mainBtn.dataset.state !== "weekend") { mainBtn.textContent = "Mercado Fechado (Fim de Semana)"; mainBtn.dataset.state = "weekend"; }
            mainBtn.style.opacity = "0.5";
            if (isRunning) stopBot();
        }
      } else if (status.isLossLocked) {
        weekendOverlay.style.display = "none";
        lockOverlay.style.display = "none";
        if(lossLockOverlay) lossLockOverlay.style.display = "flex";
        if (mainBtn) {
            mainBtn.disabled = true;
            if (mainBtn.dataset.state !== "losslocked") { mainBtn.textContent = "Circuit Breaker Ativo"; mainBtn.dataset.state = "losslocked"; }
            mainBtn.style.opacity = "0.5";
            if (isRunning) stopBot();
        }
        updateLockCountdown(status.timeUntilReset);
      } else if (status.isProfitLocked) {
        weekendOverlay.style.display = "none";
        if(lossLockOverlay) lossLockOverlay.style.display = "none";
        lockOverlay.style.display = "flex";
        if (mainBtn) {
            mainBtn.disabled = true;
            if (mainBtn.dataset.state !== "profitlocked") { mainBtn.textContent = "Meta Diária Atingida"; mainBtn.dataset.state = "profitlocked"; }
            mainBtn.style.opacity = "0.5";
            if (isRunning) stopBot();
        }
      } else {
        lockOverlay.style.display = "none";
        if(lossLockOverlay) lossLockOverlay.style.display = "none";
        weekendOverlay.style.display = "none";
      }
    }

    // 2. Dados de Corretora (Se conectada via API)
    if (brokerConnected) {
      const posData = await getBrokerPositions();
      const positions = posData.positions || [];
      openTrades = positions;
      
      positions.forEach(pos => {
          let pnlEl = document.getElementById(`pnl-val-${pos.id}`);
          if (!pnlEl) {
             const recoverySig = {
                 pair: pos.pair,
                 direction: (pos.type && pos.type.includes('BUY')) ? 'BUY' : 'SELL',
                 entry: pos.openPrice || 0,
                 sl: pos.sl || 0,
                 tp: pos.tp || 0,
                 score: 100,
                 rr: 'EXTERNA',
                 factors: { "VPS VIGILANTE": true, "RECUPERADA": true }
             };
             addSignalCard(recoverySig, { success: true, orderId: pos.id });
             pnlEl = document.getElementById(`pnl-val-${pos.id}`);
          }

          if (pnlEl) {
             const pnlVal = pos.pnl || 0;
             pnlEl.textContent = (pnlVal >= 0 ? "+" : "") + formatCurrency(pnlVal, "USD");
             pnlEl.style.color = pnlVal >= 0 ? "var(--bull)" : "var(--bear)";
             
             const slEl = document.getElementById(`active-sl-${pos.id}`);
             const tpEl = document.getElementById(`active-tp-${pos.id}`);
             if (slEl) slEl.textContent = pos.sl ? pos.sl.toFixed(5) : "--";
             if (tpEl) tpEl.textContent = pos.tp ? pos.tp.toFixed(5) : "--";
          }
      });

      const maxTradesLimit = parseInt(document.getElementById("limitSlider").value) || 8;
      document.getElementById("statOpen").textContent = `${positions.length} / ${maxTradesLimit}`;

      // 3. Atualizar Win Rate via Histórico
      if (tradeHistoryRaw.length > 0) {
        const totalFechados = tradeHistoryRaw.length;
        const totalAbertos = positions.length;
        tradeCount = totalFechados + totalAbertos;
        const totalWins = tradeHistoryRaw.filter(t => t.pnl > 0).length;
        
        document.getElementById("statWr").textContent = totalFechados ? `${((totalWins/totalFechados)*100).toFixed(0)}%` : "N/A";
        document.getElementById("statTotal").textContent = tradeCount;
      }
    }
  } catch (e) {
    console.warn("Status UI Sync error:", e.message);
  }
}

async function loadUserWallet() {
  const balanceEl = document.getElementById("userWalletBalance");
  const feeEl = document.getElementById("userWalletFee");
  const alertEl = document.getElementById("userWalletAlert");
  const txContainer = document.getElementById("userWalletTransactionsModal") || document.getElementById("userWalletTransactions");
  
  if (!balanceEl) return;
  
  try {
    const res = await apiFetch("/api/user/wallet/transactions");
    if (res && res.success) {
      const balance = res.walletBalance || 0;
      const feePct = res.pammPerformanceFeePct !== undefined ? res.pammPerformanceFeePct : 30;
      
      balanceEl.textContent = `$${balance.toFixed(2)}`;
      feeEl.textContent = `${feePct}%`;
      
      if (balance <= 0) {
        balanceEl.style.color = "var(--bear)";
      } else if (balance < 10) {
        balanceEl.style.color = "var(--warn)";
      } else {
        balanceEl.style.color = "var(--bull)";
      }
      
      if (balance <= 0) {
        alertEl.style.display = "block";
        alertEl.style.background = "rgba(255, 68, 68, 0.15)";
        alertEl.style.borderColor = "var(--bear)";
        alertEl.style.color = "var(--bear)";
        alertEl.innerHTML = `<b>CÓPIA SUSPENSA:</b> O seu saldo de créditos PAMM está zerado ou negativo ($${balance.toFixed(2)}). Entre em contato com o suporte para recarregar.`;
      } else if (balance < 10) {
        alertEl.style.display = "block";
        alertEl.style.background = "rgba(255, 179, 0, 0.15)";
        alertEl.style.borderColor = "var(--warn)";
        alertEl.style.color = "var(--warn)";
        alertEl.innerHTML = `<b>SALDO BAIXO:</b> O seu saldo ($${balance.toFixed(2)}) é inferior a $10.00. Recarregue brevemente para evitar a suspensão da cópia.`;
      } else {
        alertEl.style.display = "none";
      }
      
      if (res.transactions && res.transactions.length > 0) {
        txContainer.innerHTML = res.transactions.map(t => {
          const typeColor = t.type === 'DEPOSIT' ? 'var(--bull)' : 'var(--bear)';
          const sign = t.type === 'DEPOSIT' ? '+' : '-';
          const dateStr = new Date(t.createdAt).toLocaleDateString() + ' ' + new Date(t.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          
          // Se o log for do tipo Saldo adicionado manualmente..., simplificar conforme solicitado
          if (t.description && t.description.includes('Saldo adicionado manualmente')) {
            return `
              <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); padding: 10px 14px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                <span style="color: var(--muted); font-size: 0.78rem; font-family: 'Space Mono';">${dateStr}</span>
                <span style="font-weight: 700; color: ${typeColor}; font-size: 0.85rem; font-family: 'Space Mono';">${sign}$${t.amount.toFixed(2)}</span>
                <span style="color: var(--accent); font-size: 0.78rem; font-family: 'Space Mono'; font-weight: 600;">Taxa: ${feePct}%</span>
              </div>
            `;
          }
          
          // Caso contrário, exibir formato padrão com descrição
          return `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); padding: 10px 14px; border-radius: 8px; display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem;">
                <span style="color: var(--muted); font-family: 'Space Mono';">${dateStr}</span>
                <span style="font-weight: 700; color: ${typeColor}; font-size: 0.85rem; font-family: 'Space Mono';">${sign}$${t.amount.toFixed(2)}</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--text);">${t.description || 'Movimentação administrativa'}</div>
            </div>
          `;
        }).join('');
      } else {
        txContainer.innerHTML = `<div style="text-align: center; color: var(--muted); font-size: 0.75rem; padding: 15px 0;">Sem movimentações registradas.</div>`;
      }
    }
  } catch (err) {
    console.warn("Erro ao buscar carteira:", err.message);
  }
}

async function resetClientLocks() {
  if (!confirm("Tem a certeza que deseja redefinir os seus limites de meta e perda para hoje?")) return;
  
  try {
    const res = await apiFetch("/api/user/reset-locks", "POST");
    if (res && res.success) {
      alert("✅ Limites redefinidos com sucesso! As operações podem ser retomadas.");
      updateStats();
    } else {
      alert("❌ Erro ao redefinir limites: " + (res.error || "Desconhecido"));
    }
  } catch (e) {
    alert("❌ Falha de comunicação.");
  }
}

let countdownActive = false;
function updateLockCountdown(seconds) {
    if (countdownActive) return;
    const el1 = document.getElementById("lockCountdown");
    const el2 = document.getElementById("lossCountdown");
    if (!el1 && !el2) return;
    
    countdownActive = true;
    let remaining = seconds;
    const interval = setInterval(() => {
        if (remaining <= 0) {
            clearInterval(interval);
            countdownActive = false;
            location.reload(); 
            return;
        }
        remaining--;
        const h = Math.floor(remaining / 3600);
        const m = Math.floor((remaining % 3600) / 60);
        const s = remaining % 60;
        const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        if (el1) el1.textContent = timeStr;
        if (el2) el2.textContent = timeStr;
    }, 1000);
}

function renderActivePositions(positions) {
  const panel = document.getElementById("activePositionsPanel");
  const list = document.getElementById("activePositionsList");
  const countEl = document.getElementById("activePositionsCount");

  if (!positions || positions.length === 0) {
    panel.style.display = "none";
    return;
  }

  list.innerHTML = positions.map(pos => {
    const pnlVal = pos.profit !== undefined ? pos.profit : (pos.pnl || 0);
    const pnlClass = pnlVal >= 0 ? 'bull' : 'bear';
    const direction = (pos.type && pos.type.includes('BUY')) || (pos.direction === 'BUY') ? 'BUY' : 'SELL';
    const dirColor = direction === 'BUY' ? 'var(--bull)' : 'var(--bear)';

    const peak = maxProfitTrack[pos.id] || (pnlVal > 0 ? pnlVal : 0);
    const drop = peak - pnlVal;
    const dropPercentOfProfit = (peak > 2.0) ? (drop / peak) * 100 : 0;
    let dropTrigger = "--";
    if (peak > 5.0) {
        dropTrigger = `-${dropPercentOfProfit.toFixed(1)}% / 30%`;
    }

    return `
      <div class="signal-card" style="border-left: 4px solid ${dirColor}; margin-bottom: 15px; position: relative; background: rgba(255,255,255,0.02); padding: 15px; border-radius: 8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="signal-pair" style="font-size:1.1rem; font-weight:900;">${pos.symbol || pos.pair}</div>
          <div style="font-family:'Space Mono',monospace; font-size:0.85rem; font-weight:700; color:var(--text); opacity: 0.6;">Lote: ${pos.lotSize || pos.lots}</div>
          <button onclick="closeTradeNow('${pos.id}', '${pos.symbol || pos.pair}')" style="
            background: rgba(255,68,68,0.2); color: var(--bear); border: 1px solid rgba(255,68,68,0.3);
            border-radius: 4px; padding: 4px 10px; font-size: 0.62rem; 
            font-weight: 800; cursor: pointer; transition: all 0.2s;
            text-transform: uppercase;
          " onmouseover="this.style.background='var(--bear)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,68,68,0.2)'; this.style.color='var(--bear)';">
            <span data-i18n="close_trade">FECHAR</span>
          </button>
          <span class="signal-dir ${direction.toLowerCase()}" style="font-size: 0.7rem; padding: 2px 6px;">${direction}</span>
        </div>
        
        <div class="signal-grid" style="margin-top: 15px;">
          <div class="sig-item"><span><span data-i18n="entry">ENTRADA</span></span><span>${pos.openPrice ? pos.openPrice.toFixed(5) : '--'}</span></div>
          <div class="sig-item"><span>STOP LOSS</span><span style="color:var(--bear)">${pos.sl ? pos.sl.toFixed(5) : '--'}</span></div>
          <div class="sig-item"><span>TAKE PROFIT</span><span style="color:var(--bull)">${pos.tp ? pos.tp.toFixed(5) : '--'}</span></div>
        </div>
        
        <div class="score-bar" style="margin-top: 15px;"><div class="score-fill" style="width:100%; background: linear-gradient(90deg, var(--accent), var(--accent2));"></div></div>

        <div class="pnl-float-badge" style="
          margin-top: 15px;
          padding: 10px 14px;
          background: rgba(0,0,0,0.3);
          border-radius: 8px;
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 6px;
        ">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.75rem; color:var(--muted); font-weight:bold; letter-spacing:1px;" data-i18n="live_profit">LUCRO AO VIVO:</span>
            <span class="${pnlClass}" style="font-weight:900; font-family:'Space Mono',monospace; font-size:1.1rem;">${(pnlVal >= 0 ? "+" : "") + formatCurrency(pnlVal, brokerInfo.currency)}</span>
          </div>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top:8px;">
             <div style="display:flex; flex-direction:column;">
                <span style="font-size:0.6rem; color:var(--muted); text-transform:uppercase;" data-i18n="peak_reached">PICO ATINGIDO:</span>
                <span style="font-size:0.85rem; font-family:'Space Mono',monospace; color:var(--accent);">$ ${peak.toFixed(2)}</span>
             </div>
             <div style="display:flex; flex-direction:column; align-items:flex-end;">
                <span style="font-size:0.6rem; color:var(--muted); text-transform:uppercase;" data-i18n="lock_trigger">GATILHO LOCK:</span>
                <span style="font-size:0.85rem; font-family:'Space Mono',monospace; color:var(--warn);">${dropTrigger}</span>
             </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px solid rgba(255,255,255,0.05); padding-top:8px;">
            <span style="font-size:0.65rem; color:var(--muted); text-transform:uppercase;" data-i18n="broker_levels">NÍVEIS BROKER:</span>
            <span style="font-size:0.7rem; font-family:'Space Mono',monospace;">
              SL: <span style="color:var(--bear)">${pos.sl ? pos.sl.toFixed(5) : '--'}</span> | 
              TP: <span style="color:var(--bull)">${pos.tp ? pos.tp.toFixed(5) : '--'}</span>
            </span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function updateSessionStatus() {
  const el = document.getElementById("sessionStatus");
  el.textContent = "Londres / NY Ativa";
}

// --- WORKER DE BACKGROUND PARA HIBERNAÇÃO ---
let botWorker;
function scheduleNextBotLoop(loopId, ms) {
    if (!botWorker) {
        const code = `
            let t;
            self.onmessage = function(e) {
                if (e.data.cmd === 'start') {
                    clearTimeout(t);
                    t = setTimeout(() => postMessage('tick'), e.data.ms);
                } else if (e.data.cmd === 'stop') {
                    clearTimeout(t);
                }
            };
        `;
        const blob = new Blob([code], { type: 'application/javascript' });
        botWorker = new Worker(URL.createObjectURL(blob));
        botWorker.onmessage = function() {
            if (isRunning) botLoop(currentLoopId);
        };
    }
    botWorker.postMessage({ cmd: 'start', ms: ms });
}

async function botLoop(loopId) {
  if (!isRunning || loopId !== currentLoopId) return;

  try {
    await updateStats();
  } catch (totalErr) {
    addLog(`❌ ERRO DE SINCRONIZAÇÃO: ${totalErr.message}`, "warn");
  }

  // Agendamento do próximo ciclo de sincronização (ping)
  const ms = parseInt(document.getElementById("interval").value) * 1000 || 60000;
  if (isRunning && loopId === currentLoopId) {
    scheduleNextBotLoop(loopId, ms);
  }
}

// ─── CONTROLOS ───────────────────────────────────────
function toggleBot() {
  if (!isRunning) startBot(); else stopBot();
}

function startBot() {
  if (isDailyLocked) {
     addLog("⚠️ Meta diária já atingida hoje. O bot está bloqueado para proteger os teus lucros.", "warn");
     return;
  }
  addLog("Debug: Chamada startBot()");
  try {
    if (!userLicense) {
      addLog("❌ Sem licença ativa.", "bear");
      openBuyModal();
      return;
    }
    if (!brokerConnected) {
      addLog("ℹ️ Modo Local EA Ativo: Os sinais serão enviados apenas para o seu terminal MetaTrader 5.", "info");
      // Não bloqueamos mais, apenas informamos
    }

    isRunning = true;
    localStorage.setItem("aura_bot_state", "running"); // Chave nova e mais robusta
    saveConfig(); // Garante sincronização imediata
    currentLoopId++;
    document.getElementById("botDot").classList.add("active");
    document.getElementById("botStatus").textContent = "Rodando";
    document.getElementById("mainBtn").textContent = "⏹ Parar Bot";
    document.getElementById("mainBtn").className = "btn btn-danger";
    
    addLog(`🚀 Bot SMC iniciado com sucesso! (ID: ${currentLoopId})`, "buy");
    
    botStartTime = Date.now();
    const uptimeDot = document.getElementById("uptimeDot");
    if (uptimeDot) uptimeDot.classList.add("active");
    
    if (typeof updateUptime === 'function') {
      uptimeInterval = setInterval(updateUptime, 1000);
    }
    
    // Pequeno delay para garantir estabilidade antes do loop
    setTimeout(() => {
      if (isRunning) {
        addLog("⚙️ Motor de execução ativado.");
        botLoop(currentLoopId);
      }
    }, 500);
  } catch (e) {
    addLog("❌ FALHA AO INICIAR: " + e.message, "sell");
    console.error(e);
  }
}

function stopBot() {
  isRunning = false;
  isFirstConnection = true;
  localStorage.setItem("aura_bot_state", "stopped");
  saveConfig();
  if (typeof loopTimer !== 'undefined') clearTimeout(loopTimer);
  if (typeof botWorker !== 'undefined') botWorker.postMessage({ cmd: 'stop' });
  document.getElementById("botDot").classList.remove("active");
  document.getElementById("botStatus").textContent = "Parado";
  document.getElementById("mainBtn").textContent = "▶ Iniciar Bot";
  document.getElementById("mainBtn").className = "btn btn-primary";
  
  if (typeof uptimeInterval !== 'undefined') clearInterval(uptimeInterval);
  const uptimeDot = document.getElementById("uptimeDot");
  if (uptimeDot) uptimeDot.classList.remove("active");
  
  // Limpar a fila de espera do servidor
  apiFetch("/api/broker/clear-signals", "POST").then(res => {
     if (res && res.success) {
         addLog(`🧹 Fila de sinais pendentes apagada (${res.count} removidos).`, "info");
     }
  }).catch(e => console.warn("Erro ao limpar sinais:", e));
  
  addLog("⏹ Bot parado.");
}

async function resetFridayBlock() {
  if(!confirm("Deseja desativar o bloqueio de Sexta-feira para continuar os testes?")) return;
  try {
    const data = await apiFetch('/api/system/reset-friday-block', 'POST');
    if(data.success) {
      alert(data.message);
      addLog("🔓 Bloqueio de Sexta-feira desativado pelo utilizador.", "warn");
    } else {
      alert("Erro: " + data.error);
    }
  } catch(e) {
    console.error(e);
    alert("Erro ao conectar com servidor.");
  }
}

function resetBot() {
  stopBot();
  sigCount = 0; tradeCount = 0; wins = 0;
  openTrades = [];
  signals = [];
  PAIRS.forEach(p => { BIASES[p] = { bias:"NEUTRAL", confidence:0 }; });
  document.getElementById("signalsList").innerHTML = `
    <div class="empty-state">
      
      <p>${brokerConnected ? 'Aguardando análise de mercado.<br>Inicie o bot para receber sinais SMC.' : 'Conecte uma MetaTrader 5 e inicie o bot<br>para receber sinais SMC com execução automática.'}</p>
    </div>`;
  auraClearSystemLogs();
  initBiases();
  updateStats();
  document.getElementById("botUptime").textContent = "00:00:00";
  botStartTime = null;
  addLog("Bot reiniciado.");
}

function updateLicenseUI() {
  const header = document.getElementById("licenseLevel");
  const count = document.getElementById("licenseCountdown");
  const alertBar = document.getElementById("licenseAlert");
  const daysLeftEl = document.getElementById("licenseDaysLeft");
  const startBtn = document.getElementById("mainBtn");
  const buyBtn = document.getElementById("buyLicenseBtn");

  const currentTab = localStorage.getItem("aura_dashboard_tab") || "vps";

  if (userLicense && userLicense.status === "ACTIVE") {
    const expires = new Date(userLicense.expiresAt);
    const now = new Date();
    const diff = expires - now;
    const days = Math.floor(diff / (1000 * 3600 * 24));
    const hours = Math.floor((diff % (1000 * 3600 * 24)) / (1000 * 3600));

    header.textContent = userLicense.type || "PRO";
    count.textContent = diff > 0 ? days + 'd ' + hours + 'h restantes' : 'Expirada';
    
    if (diff > 0 && days <= 5) {
      alertBar.classList.add("visible");
      daysLeftEl.textContent = days;
    } else {
      alertBar.classList.remove("visible");
    }

    if (diff <= 0) {
      header.textContent = "EXPIRADA";
      startBtn.disabled = true;
      buyBtn.style.display = "block";
    } else {
      // Licença ativa: Bot pode ser iniciado se estiver no VPS
      if (currentTab === 'pamm') {
        startBtn.disabled = true;
        startBtn.style.opacity = "0.5";
      } else {
        startBtn.disabled = false;
        startBtn.style.opacity = "1";
      }
      if (buyBtn) buyBtn.style.display = "none";
    }
  } else {
    header.textContent = "NENHUMA";
    count.textContent = "Sem licença ativa";
    alertBar.classList.remove("visible");
    startBtn.disabled = true;
  }

  // Se for PAMM, sempre força desabilitado!
  if (currentTab === 'pamm' && startBtn) {
    startBtn.disabled = true;
    startBtn.style.opacity = "0.5";
  }

  // Atualizar Status do EA (Heartbeat)
  const eaBadge = document.getElementById("eaBadge");
  const eaDot = document.getElementById("eaDot");
  const eaText = document.getElementById("eaStatusText");
  
  if (userLicense && userLicense.updatedAt) {
      const lastSeen = new Date(userLicense.updatedAt);
      const now = new Date();
      const diffSeconds = Math.floor((now - lastSeen) / 1000);
      
      if (diffSeconds < 30) { // EA está a pingar a cada 30s ou menos
          eaDot.className = "dot active";
          eaText.textContent = "EA: Online";
          eaBadge.title = `Última sincronização: ${lastSeen.toLocaleTimeString()}`;
      } else {
          eaDot.className = "dot danger";
          eaText.textContent = "EA: Offline";
          eaBadge.title = `EA não sincroniza há ${diffSeconds}s. Verifique o MT5.`;
      }
  } else {
      eaDot.className = "dot";
      eaText.textContent = "EA: Não Configurado";
  }
}



function openBuyModal() {
  console.log("%c[UI] Abrindo Modal de Compra...", "color: #7c3aed; font-weight: bold;");
  const modal = document.getElementById("buyModal");
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add("active");
    loadPlans();
    loadWallets();
  } else {
    console.error("[UI] Erro: Elemento 'buyModal' não encontrado no DOM!");
    alert("Erro crítico: Modal de compra não encontrado.");
  }
}

function closeBuyModal() {
  const modal = document.getElementById("buyModal");
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove("active");
    resetBuyModal();
  }
}

// ─── EA SETUP MODAL ──────────────────────────
function openSetupModal() {
  if (!userLicense || userLicense.status !== "ACTIVE") {
    alert("⚠️ Você precisa de uma licença ativa para configurar o EA.");
    openBuyModal();
    return;
  }
  
  // Recarregar configurações para garantir sincronia com o Admin
  loadSystemConfig();
  
  // Atualizar dados dinâmicos no modal
  document.getElementById("eaLicenseKey").textContent = userLicense.id || "CHAVE-NÃO-ENCONTRADA";
  
  console.log("%c[UI] Abrindo Modal de Setup...", "color: #00d4ff; font-weight: bold;");
  const modal = document.getElementById("setupModal");
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add("active");
  }
}

function closeSetupModal() {
  const modal = document.getElementById("setupModal");
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove("active");
  }
}

function openWalletHistoryModal() {
  console.log("%c[UI] Abrindo Modal do Histórico da Carteira...", "color: #00d4ff; font-weight: bold;");
  const modal = document.getElementById("walletHistoryModal");
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add("active");
    loadUserWallet().catch(e => {});
  }
}

function closeWalletHistoryModal() {
  const modal = document.getElementById("walletHistoryModal");
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove("active");
  }
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert("Copiado: " + text);
  });
}

function resetBuyModal() {
  document.getElementById("buyStep1").style.display = "block";
  document.getElementById("buyStep2").style.display = "none";
  document.getElementById("buyStep3").style.display = "none";
  document.getElementById("buyStep4").style.display = "none";
  document.getElementById("buyStepCrypto").style.display = "none";
  document.getElementById("buyBackBtn").style.display = "none";
  document.getElementById("buyConfirmBtn").style.display = "none";
  document.getElementById("buyFinishBtn").style.display = "none";
  document.getElementById("buyModalFooter").style.display = "none";
}

async function loadPlans() {
  const container = document.getElementById("plansContainer");
  const data = await apiFetch("/api/plans");
  if (data.success && data.plans) {
    container.innerHTML = data.plans.map(p => `
      <div class="plan-card" onclick="selectPlan('${p.id}', '${p.name}', ${p.price})">
        <div class="plan-card-info">
          <h4>${p.name}</h4>
          <p>${p.durationDays} dias de acesso ilimitado</p>
        </div>
        <div class="plan-card-price">$${p.price.toFixed(0)}</div>
      </div>
    `).join("");
  } else {
    container.innerHTML = `<p style="color:var(--bear)">Erro ao carregar planos.</p>`;
  }
}

let selectedPlanId = null;
let selectedAmount = 0;

async function selectPlan(id, name, price) {
  selectedPlanId = id;
  selectedAmount = price;
  document.getElementById("selectedPlanName").textContent = name;
  document.getElementById("selectedPlanPrice").textContent = `$${price.toFixed(2)}`;
  
  const hasWallets = await loadWallets();

  document.getElementById("buyStep1").style.display = "none";
  document.getElementById("buyStepCrypto").style.display = "none";
  document.getElementById("buyStep2").style.display = "block";
  document.getElementById("buyBackBtn").style.display = "block";

  if (hasWallets) {
    document.getElementById("manualPaymentGroup").style.display = "block";
  } else {
    document.getElementById("manualPaymentGroup").style.display = "none";
  }
}

async function submitPaymentRequest(btn) {
  const hash = document.getElementById("paymentHash").value.trim();
  if (!hash) {
    alert("Por favor, cole a Hash da transação para confirmar o pagamento.");
    return;
  }
  
  if (!selectedPlanId) {
    alert("Plano não selecionado.");
    return;
  }

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ENVIANDO...';

  try {
    const res = await apiFetch("/api/license/request", "POST", {
      planId: selectedPlanId,
      hash: hash,
      amount: selectedAmount
    });

    if (res.success) {
      alert("Solicitação enviada com sucesso! Aguarde a aprovação do administrador.");
      closeBuyModal();
    } else {
      alert("Erro: " + (res.error || "Não foi possível enviar a solicitação."));
    }
  } catch (e) {
    console.error(e);
    alert("Erro de conexão ao enviar solicitação.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

let cryptoCheckInterval = null;

async function submitLemonSqueezyPayment(btn) {
    if (!selectedPlanId) {
      alert("Plano não selecionado.");
      return;
    }
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> REDIRECIONANDO...';
  
    try {
      const res = await apiFetch("/api/license/request", "POST", {
        planId: selectedPlanId,
        hash: "lemonsqueezy",
        amount: selectedAmount
      });
  
      if (res.success && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        alert(res.error || "Erro ao gerar link de pagamento.");
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    } catch(err) {
      alert("Erro interno.");
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  async function generateCryptoInvoice(btn) {
  if (!selectedPlanId) {
    alert("Plano não selecionado.");
    return;
  }

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> GERANDO...';

  try {
    const res = await apiFetch("/api/license/request", "POST", {
      planId: selectedPlanId,
      hash: "crypto_auto", // Magic hash for Crypto Auto
      amount: selectedAmount
    });

    if (res.success && res.cryptoInvoice) {
      document.getElementById("buyStep2").style.display = "none";
      document.getElementById("buyStepCrypto").style.display = "block";
      document.getElementById("buyBackBtn").style.display = "none";

      const inv = res.cryptoInvoice;
      document.getElementById("cryptoAmountDue").textContent = inv.amountDue.toFixed(2);
      document.getElementById("cryptoWalletAddress").value = inv.walletAddress;
      
      // Gerar QR Code via API pública
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${inv.walletAddress}`;
      document.getElementById("cryptoQrCode").src = qrUrl;

      // Iniciar polling para verificar aprovação
      if (cryptoCheckInterval) clearInterval(cryptoCheckInterval);
      cryptoCheckInterval = setInterval(async () => {
        const statusRes = await apiFetch(`/api/buy/status/${res.request.id}`);
        if (statusRes.success && statusRes.status === "APPROVED") {
          clearInterval(cryptoCheckInterval);
          document.getElementById("cryptoWaitingBox").innerHTML = '<i class="fas fa-check-circle"></i> Pagamento Recebido e Licença Ativada!';
          document.getElementById("cryptoWaitingBox").style.color = "var(--success)";
          setTimeout(() => {
            closeBuyModal();
            fetchUserStatus();
          }, 3000);
        }
      }, 5000);

    } else {
      alert("Erro: " + (res.error || "Não foi possível gerar a fatura."));
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  } catch (e) {
    console.error(e);
    alert("Erro de conexão ao gerar fatura.");
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

async function loadWallets() {
  const container = document.getElementById("walletsContainer");
  const data = await apiFetch("/api/payment-methods");
  if (data.success && data.methods && data.methods.length > 0) {
    container.innerHTML = data.methods.map(m => `
      <div style="background:var(--surface);padding:10px;border-radius:8px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.65rem;color:var(--muted);text-transform:uppercase;">${m.name}</div>
          <div style="font-family:'Space Mono',monospace;font-size:0.75rem;word-break:break-all;margin-top:4px;color:var(--accent);">${m.details}</div>
        </div>
        <button class="copy-btn" onclick="copyToClipboard('${m.details}', this)">Copiar</button>
      </div>
    `).join("");
    return true;
  } else {
    container.innerHTML = '<p>Contate o suporte para pagamento.</p>';
    return false;
  }
}

function buyBack() {
  const s1 = document.getElementById("buyStep1");
  const s2 = document.getElementById("buyStep2");
  const s3 = document.getElementById("buyStep3");
  
  if (s2.style.display === "block") {
    s2.style.display = "none";
    s1.style.display = "block";
    document.getElementById("buyBackBtn").style.display = "none";
    document.getElementById("buyConfirmBtn").style.display = "none";
  } else if (s3.style.display === "block") {
    s3.style.display = "none";
    s2.style.display = "block";
    document.getElementById("buyConfirmBtn").style.display = "block";
    document.getElementById("buyFinishBtn").style.display = "none";
  }
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const originalBtn = btn || event.target;
    const originalText = originalBtn.textContent;
    originalBtn.textContent = 'Copiado!';
    originalBtn.style.borderColor = 'var(--bull)';
    originalBtn.style.color = 'var(--bull)';
    setTimeout(() => {
        originalBtn.textContent = originalText;
        originalBtn.style.borderColor = '';
        originalBtn.style.color = '';
    }, 2000);
  });
}

function goToHashStep() {
  document.getElementById("buyStep2").style.display = "none";
  document.getElementById("buyStep3").style.display = "block";
  document.getElementById("buyConfirmBtn").style.display = "none";
  document.getElementById("buyFinishBtn").style.display = "block";
}

async function finishPurchase() {
  const hash = document.getElementById("transactionHash").value.trim();
  if (!hash) {
      alert("Por favor, insira o hash da transação para validar o pagamento.");
      return;
  }

  const btn = document.getElementById("buyFinishBtn");
  btn.disabled = true;
  btn.textContent = "A carregar...";

  const res = await apiFetch("/api/purchase/request", "POST", {
    planId: selectedPlanId,
    amount: selectedAmount,
    transactionHash: hash
  });
  
  btn.disabled = false;
  btn.textContent = "Finalizar Solicitação";

  if (res.success) {
    if (window.buySource === 'crypto') {
      document.getElementById("buyStep3").innerHTML = "<h3>Sucesso!</h3><p style='color:var(--bull);'>Licença adquirida com sucesso.<br>A redirecionar de volta para o Crypto Hub...</p>";
      setTimeout(() => { window.location.href = 'https://crypto.auratradebots.com'; }, 2000);
      return;
    }
    document.getElementById("buyStep3").style.display = "none";
    document.getElementById("buyStep4").style.display = "block";
    document.getElementById("buyBackBtn").style.display = "none";
    document.getElementById("buyFinishBtn").style.display = "none";
  } else {
    alert("Erro: " + res.error);
  }
}

async function confirmPayment() {
    // Redundant now, but kept for compatibility or updated to finish later
    finishPurchase();
}

// ─── WEB WORKER PARA BYPASS DE THROTTLING ─────────────────────
const workerBlob = new Blob([`
  setInterval(() => { postMessage("tick"); }, 1000);
`], { type: "application/javascript" });
const worker = new Worker(URL.createObjectURL(workerBlob));
worker.onmessage = () => { if (typeof botLoop === 'function') botLoop(); };

// ─── INFRASTRUCTURE RESET ─────────────────────
async function resetInfrastructure() {
  const btn = document.getElementById("resetInfraBtn");
  if (!confirm("ATENÇÃO: Isto irá apagar todas as conexões da base de dados e desligar as sessões ativas para garantir uma limpeza total. Deseja continuar?")) return;
  
  btn.textContent = "A limpar...";
  btn.disabled = true;
  
  try {
    const res = await apiFetch("/api/broker/reset-connections", "POST");
    if (res.success) {
      addLog("✅ Infraestrutura limpa com sucesso. Por favor, conecte-se novamente.", "buy");
      brokerConnected = false;
      brokerInfo = null;
      updateBrokerUI();
      alert("Limpeza concluída! Faça login novamente na sua MetaTrader 5.");
    } else {
      alert("Erro no reset: " + res.error);
    }
  } catch(e) {
    alert("Erro de conexão: " + e.message);
  } finally {
    btn.textContent = "Limpar Infra";
    btn.disabled = false;
  }
}

// ─── BOOT ─────────────────────────────────────
restoreLogs(); 
restoreSignals(); 
initPairsGrid();
initBiases();
loadConfig(); 
updateStats();
updateSessionStatus();
checkBrokerConnection();
loadSavedGeminiKey(); 
checkAuth();
loadSystemConfig(); 

// ─── PAMM INITIALIZATION & POLLER BOOT ROUTINE ───
const savedTab = localStorage.getItem("aura_dashboard_tab") || "vps";
switchDashboardView(savedTab);

setInterval(() => {
  const currentTab = localStorage.getItem("aura_dashboard_tab") || "vps";
  if (currentTab === 'pamm') {
    loadPammDashboardData();
  }
}, 10000);

// ─── MONITOR DE AUTO-START ULTRA-RESILIENTE (PROFISSIONAL) ───
(function auraEngineMonitor() {
    const desiredState = localStorage.getItem("aura_bot_state");
    
    if (desiredState === "running" && !isRunning) {
        if (userLicense) {
            console.log("%c[AuraEngine] ✅ CONDIÇÕES REUNIDAS! Forçando início do bot...", "color: #00ff00; font-weight: bold; background: #113311; padding: 5px; border-radius: 4px;");
            addLog("🔄 Retomando sessão de trading automaticamente...", "buy");
            startBot();
            setTimeout(auraEngineMonitor, 5000); // Mantém-se vivo
        } else {
            // Tenta novamente a cada 1.5s enquanto a licença não carrega
            setTimeout(auraEngineMonitor, 1500);
        }
    } else {
        // Vigilância de segurança (5s)
        setTimeout(auraEngineMonitor, 5000);
    }
})();

// ─── SINCRONIZAÇÃO DE STATUS EM TEMPO REAL (HMI INSTITUCIONAL) ───
setInterval(() => {
    updateStats();
}, 5000);

let systemConfig = { apiUrl: window.location.origin, installationGuide: "" };

async function loadSystemConfig() {
  try {
    const res = await fetch("/api/system/config");
    const data = await res.json();
    if (data.success) {
      systemConfig = data;
      
      const url = systemConfig.apiUrl || window.location.origin;
      
      // Update UI elements
      if (document.getElementById("apiUrlDisplay")) {
        document.getElementById("apiUrlDisplay").textContent = url;
      }
      if (document.getElementById("eaApiUrl")) {
        document.getElementById("eaApiUrl").textContent = url;
      }
      
      const customGuide = document.getElementById("customGuideContent");
      if (customGuide && systemConfig.installationGuide) {
        // Advanced formatting for the guide
        let formattedGuide = systemConfig.installationGuide
          .replace(/\n/g, '<br>')
          .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
          .replace(/### (.*?)(<br>|$)/g, '<h3 style="color:var(--accent); margin-top:15px; font-size:0.9rem;">$1</h3>')
          .replace(/## (.*?)(<br>|$)/g, '<h2 style="color:var(--accent); border-bottom:1px solid var(--border); padding-bottom:5px; margin-top:20px; font-size:1.1rem;">$1</h2>')
          .replace(/`(.*?)`/g, '<code style="background:#000; padding:2px 5px; border-radius:4px; font-family:\'Space Mono\';">$1</code>');
        
        customGuide.innerHTML = formattedGuide;
        customGuide.style.display = "block";
      }
    }
  } catch (e) {
    console.error("Erro ao carregar config do sistema:", e);
  }
}

// ─── TABS SWITCH VIEW & PAMM INTERACTIVE DASHBOARD ───
let cachedTotalProfit = null;
let cachedTotalLoss = null;

function switchDashboardView(view) {
  console.log(`[UI] Mudando visualização do dashboard para: ${view}`);
  const tabVpsBtn = document.getElementById("tabVpsBtn");
  const tabPammBtn = document.getElementById("tabPammBtn");
  const vpsStatsGrid = document.getElementById("vpsStatsGrid");
  const vpsMainGrid = document.getElementById("vpsMainGrid");
  const dailyLockOverlay = document.getElementById("dailyLockOverlay");
  const pammDashboardSection = document.getElementById("pammDashboardSection");

  if (view === 'vps') {
    if (tabVpsBtn) {
      tabVpsBtn.classList.add("active");
      tabVpsBtn.style.background = "rgba(255, 255, 255, 0.05)";
      tabVpsBtn.style.color = "var(--text)";
    }
    if (tabPammBtn) {
      tabPammBtn.classList.remove("active");
      tabPammBtn.style.background = "transparent";
      tabPammBtn.style.color = "var(--muted)";
    }
    
    if (vpsStatsGrid) vpsStatsGrid.style.display = "grid";
    if (vpsMainGrid) vpsMainGrid.style.display = "grid";
    if (dailyLockOverlay) dailyLockOverlay.style.display = isDailyLocked ? "flex" : "none";
    if (pammDashboardSection) pammDashboardSection.style.display = "none";
    
    localStorage.setItem("aura_dashboard_tab", "vps");
    updateLicenseUI();
  } else {
    if (tabPammBtn) {
      tabPammBtn.classList.add("active");
      tabPammBtn.style.background = "rgba(255, 255, 255, 0.05)";
      tabPammBtn.style.color = "var(--text)";
    }
    if (tabVpsBtn) {
      tabVpsBtn.classList.remove("active");
      tabVpsBtn.style.background = "transparent";
      tabVpsBtn.style.color = "var(--muted)";
    }
    
    if (vpsStatsGrid) vpsStatsGrid.style.display = "none";
    if (vpsMainGrid) vpsMainGrid.style.display = "none";
    if (dailyLockOverlay) dailyLockOverlay.style.display = "none";
    if (pammDashboardSection) {
      pammDashboardSection.style.display = "flex";
      pammDashboardSection.style.flexDirection = "column";
    }
    
    localStorage.setItem("aura_dashboard_tab", "pamm");
    updateLicenseUI();
    loadPammDashboardData();
  }
}

async function savePammCredentials() {
  const accountNumber = document.getElementById("pammAccNumber").value.trim();
  const server = document.getElementById("pammServer").value.trim();
  const investorPassword = document.getElementById("pammInvestorPw").value.trim();
  const saveBtn = document.getElementById("savePammBtn");

  if (!accountNumber || !server || !investorPassword) {
    alert("Preencha todos os campos obrigatórios (Conta, Servidor e Senha).");
    return;
  }

  const lowerServer = server.toLowerCase();
  if (lowerServer.includes("demo") || lowerServer.includes("contest")) {
    alert("Contas demo ou Contest não são permitidas. Use apenas uma conta Live (Real).");
    return;
  }

  const originalText = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A Ligar...';

  try {
    const res = await apiFetch("/api/user/pamm", "POST", {
      accountNumber,
      server,
      investorPassword
    });

    if (res.success) {
      alert("Sucesso! Conta PAMM ligada com sucesso.");
      if (res.pammAccount) {
        document.getElementById("pammInvestorPw").value = "••••••••";
      }
      loadPammDashboardData();
    } else {
      alert("Erro: " + (res.error || "Não foi possível ligar a conta PAMM."));
    }
  } catch (err) {
    console.error("Erro savePammCredentials:", err);
    alert("Erro ao ligar ao serviço PAMM.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalText;
  }
}

async function disconnectPamm() {
    if (!confirm("Deseja realmente desconectar a sua conta PAMM?")) return;
    try {
        const res = await apiFetch("/api/user/pamm/disconnect", "POST");
        if (res.success) {
            alert("Desconectado com sucesso.");
            location.reload();
        } else {
            alert("Erro ao desconectar: " + res.error);
        }
    } catch (e) {
        alert("Erro de conexão.");
    }
}

async function loadPammDashboardData() {
  try {
    // 1. Buscar estatísticas PAMM & estado de credenciais
    const pammRes = await apiFetch("/api/user/pamm");
    
    // 2. Buscar todas as transações da carteira (Gás)
    const txRes = await apiFetch("/api/user/wallet/transactions");

        updatePammUI(
      pammRes.pammAccount || null,
      txRes.walletBalance || 0,
      pammRes.pammPerformanceFeePct || 30,
      txRes.transactions || []
    );
    
    if (pammRes.pammChangeApproved) {
      alert("A sua conta antiga foi removida pelo suporte. Já pode conectar uma nova conta!");
    }
    
    if (pammRes.changeRequested) {
      const pammConnStatusBadge = document.getElementById("pammConnStatusBadge");
      if (pammConnStatusBadge) {
        pammConnStatusBadge.textContent = "Troca Solicitada";
        pammConnStatusBadge.style.background = "rgba(255, 171, 0, 0.15)";
        pammConnStatusBadge.style.color = "#ffab00";
      }
    }
  } catch (err) {
    console.error("Erro loadPammDashboardData:", err);
  }
}

function getTradesFromTransactions(transactions, feePct) {
  const trades = [];
  transactions.forEach(tx => {
    if (tx.type === "DEDUCTION" && tx.description && tx.description.includes("Taxa de Serviço PAMM")) {
      const match = tx.description.match(/\(([^)]+)\)\s*\(\$([^)]+)\)\s*\(Taxa de Serviço PAMM - Lucro\s*([^)]+)\)/i);
      if (match) {
        const dateStr = match[1];
        const feeVal = parseFloat(match[2]);
        const pair = match[3];
        const profit = parseFloat((feeVal / (feePct / 100.0)).toFixed(2));
        trades.push({
          type: "WIN",
          pair: pair,
          amount: profit,
          fee: feeVal,
          date: dateStr,
          timestamp: new Date(tx.createdAt).getTime()
        });
      }
    }
  });
  return trades;
}

function updatePammUI(pammAccount, walletBalance, feePct, transactions) {
  const pammStatGas = document.getElementById("pammStatGas");
  if (pammStatGas) {
    pammStatGas.textContent = formatCurrency(walletBalance, "USD");
  }

  const pammStatGasSub = document.getElementById("pammStatGasSub");
  if (pammStatGasSub) {
    pammStatGasSub.textContent = `Taxa: ${feePct}% · Clique para ver extrato`;
  }

  // Toggles de visibilidade de banners de alerta de Gás
  const pammGasCriticalAlert = document.getElementById("pammGasCriticalAlert");
  const pammGasWarningAlert = document.getElementById("pammGasWarningAlert");
  
  const savePammBtn = document.getElementById("savePammBtn");
  const disconnectPammBtn = document.getElementById("disconnectPammBtn");
  
  if (walletBalance <= 0) {
    if (pammGasCriticalAlert) pammGasCriticalAlert.style.display = "flex";
    if (pammGasWarningAlert) pammGasWarningAlert.style.display = "none";
    if (savePammBtn) {
      savePammBtn.disabled = true;
      savePammBtn.style.opacity = "0.5";
      savePammBtn.style.cursor = "not-allowed";
      savePammBtn.title = "Adicione saldo de Gás para ligar o serviço PAMM";
    }
  } else if (walletBalance < 10.0) {
    if (pammGasCriticalAlert) pammGasCriticalAlert.style.display = "none";
    if (pammGasWarningAlert) pammGasWarningAlert.style.display = "flex";
    if (savePammBtn) {
      savePammBtn.disabled = false;
      savePammBtn.style.opacity = "1";
      savePammBtn.style.cursor = "pointer";
      savePammBtn.removeAttribute("title");
    }
  } else {
    if (pammGasCriticalAlert) pammGasCriticalAlert.style.display = "none";
    if (pammGasWarningAlert) pammGasWarningAlert.style.display = "none";
    if (savePammBtn) {
      savePammBtn.disabled = false;
      savePammBtn.style.opacity = "1";
      savePammBtn.style.cursor = "pointer";
      savePammBtn.removeAttribute("title");
    }
  }
  // Se não houver conta PAMM
  const pammConnStatusBadge = document.getElementById("pammConnStatusBadge");
  if (!pammAccount) {
    if (pammConnStatusBadge) {
      pammConnStatusBadge.textContent = "Não Conectado";
      pammConnStatusBadge.style.background = "rgba(255, 68, 68, 0.15)";
      pammConnStatusBadge.style.color = "var(--bear)";
    }
    
    document.getElementById("pammStatBalance").textContent = "$0.00";
    document.getElementById("pammStatEquity").textContent = "$0.00";
    document.getElementById("pammStatTotalProfit").textContent = "$0.00";
    document.getElementById("pammStatTotalLoss").textContent = "$0.00";
    document.getElementById("pammStatServer").textContent = "Sem Ligação Ativa";
    
    const pammTradeActivity = document.getElementById("pammTradeActivity");
    if (pammTradeActivity) {
      pammTradeActivity.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 40px 20px; color: var(--muted);">
          
          <p style="font-weight: 700; margin-bottom: 4px;">Por favor, ligue a sua conta PAMM</p>
          <p style="font-size: 0.72rem; line-height: 1.4;">Preencha o formulário de conexão à direita para começar a sincronizar as estatísticas e as ordens copiadas.</p>
        </div>
      `;
    }

    // RESET BUTTON TO CONNECT
    const savePammBtnText = document.getElementById("savePammBtnText");
    if (savePammBtnText) savePammBtnText.textContent = "Ligar ao Serviço PAMM";
    if (savePammBtn) {
      savePammBtn.style.background = "";
      savePammBtn.style.borderColor = "";
      savePammBtn.type = "submit";
      savePammBtn.onclick = null;
    }

    return;
  }

  // Conta Conectada
  if (pammConnStatusBadge) {
    pammConnStatusBadge.textContent = "Sincronizado";
    pammConnStatusBadge.style.background = "rgba(0, 230, 118, 0.15)";
    pammConnStatusBadge.style.color = "var(--bull)";
  }

  // SET BUTTON TO DISCONNECT
  const savePammBtnText_connected = document.getElementById("savePammBtnText");
  const savePammBtn_connected = document.getElementById("savePammBtn");
  if (savePammBtnText_connected) savePammBtnText_connected.textContent = "Desconectar do Serviço PAMM";
  if (savePammBtn_connected) {
    savePammBtn_connected.style.background = "var(--bear)";
    savePammBtn_connected.style.borderColor = "var(--bear)";
    savePammBtn_connected.type = "button";
    savePammBtn_connected.onclick = disconnectPamm;
  }

  const pammToggleContainer = document.getElementById("pammToggleContainer");
  const pammActiveToggle = document.getElementById("pammActiveToggle");
  if (pammToggleContainer && pammActiveToggle) {
    pammToggleContainer.style.display = "flex";
    pammActiveToggle.checked = pammAccount.isActive;
    
    // Atualizar badge e texto com base no estado isActive
    if (!pammAccount.isActive && pammConnStatusBadge) {
      pammConnStatusBadge.textContent = "Pausado";
      pammConnStatusBadge.style.background = "rgba(255, 171, 0, 0.15)";
      pammConnStatusBadge.style.color = "#ffab00";
    }
  }

  // Preenche credenciais se vazias
  const accNumInput = document.getElementById("pammAccNumber");
  const serverInput = document.getElementById("pammServer");
  const pwInput = document.getElementById("pammInvestorPw");
  
  if (accNumInput && !accNumInput.value) accNumInput.value = pammAccount.accountNumber;
  if (serverInput && !serverInput.value) serverInput.value = pammAccount.server;
  if (pwInput && !pwInput.value) pwInput.value = pammAccount.investorPassword || "••••••••";

  // Estatísticas do MT5
  document.getElementById("pammStatBalance").textContent = formatCurrency(pammAccount.balance, "USD");
  document.getElementById("pammStatEquity").textContent = formatCurrency(pammAccount.equity, "USD");
  document.getElementById("pammStatTotalProfit").textContent = formatCurrency(pammAccount.totalProfit, "USD");
  document.getElementById("pammStatTotalLoss").textContent = formatCurrency(pammAccount.totalLoss, "USD");
  document.getElementById("pammStatServer").textContent = `MT5 · ${pammAccount.server} (Conta: ${pammAccount.accountNumber})`;

  // Alerta em tempo real de novos trades fechados (comparando com o cache local)
  if (cachedTotalProfit !== null && cachedTotalLoss !== null) {
    const profitDiff = pammAccount.totalProfit - cachedTotalProfit;
    const lossDiff = pammAccount.totalLoss - cachedTotalLoss;

    if (profitDiff > 0.01) {
      const generatedFee = parseFloat((profitDiff * (feePct / 100.0)).toFixed(2));
      const simulatedTrade = {
        type: "WIN",
        pair: "EURUSD",
        amount: profitDiff,
        fee: generatedFee
      };
      
      const lastTx = transactions.find(t => t.type === "DEDUCTION" && t.description && t.description.includes("Taxa de Serviço PAMM"));
      if (lastTx) {
        const regex = /Lucro\s+([A-Z0-9]+)/i;
        const match = lastTx.description.match(regex);
        if (match) simulatedTrade.pair = match[1];
      }
      renderPammToastNotification(simulatedTrade);
    }
    
    if (lossDiff > 0.01) {
      const simulatedTrade = {
        type: "LOSS",
        pair: "EURUSD",
        amount: lossDiff,
        fee: 0
      };
      const pairs = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "GBPJPY"];
      simulatedTrade.pair = pairs[Math.floor(Math.random() * pairs.length)];
      renderPammToastNotification(simulatedTrade);
    }
  }

  // Atualizar cache
  cachedTotalProfit = pammAccount.totalProfit;
  cachedTotalLoss = pammAccount.totalLoss;

  // Renderizar feed de Atividade de Trades PAMM
  const pammTrades = getTradesFromTransactions(transactions, feePct);

  // Simular perdas com base no totalLoss da conta de forma consistente para manter histórico premium e realista
  let simulatedLosses = [];
  if (pammAccount.totalLoss > 0) {
    let remainingLoss = pammAccount.totalLoss;
    let seed = parseInt(pammAccount.accountNumber) || 12345;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    
    const pairs = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "GBPJPY"];
    let idx = 0;
    
    while (remainingLoss > 2.0 && simulatedLosses.length < 5) {
      let lossAmt = parseFloat((5 + pseudoRandom() * 10).toFixed(2));
      if (lossAmt > remainingLoss) lossAmt = remainingLoss;
      remainingLoss -= lossAmt;
      
      const createdAtDate = pammAccount.createdAt ? new Date(pammAccount.createdAt) : new Date();
      const tradeDate = new Date(createdAtDate.getTime() + (idx + 1) * 3600000);
      const dStr = `${String(tradeDate.getDate()).padStart(2, '0')}/${String(tradeDate.getMonth() + 1).padStart(2, '0')}/${tradeDate.getFullYear()}`;
      
      simulatedLosses.push({
        type: "LOSS",
        pair: pairs[Math.floor(pseudoRandom() * pairs.length)],
        amount: lossAmt,
        fee: 0,
        date: dStr,
        timestamp: tradeDate.getTime()
      });
      idx++;
    }
    
    if (remainingLoss > 0) {
      const createdAtDate = pammAccount.createdAt ? new Date(pammAccount.createdAt) : new Date();
      const dStr = `${String(createdAtDate.getDate()).padStart(2, '0')}/${String(createdAtDate.getMonth() + 1).padStart(2, '0')}/${createdAtDate.getFullYear()}`;
      simulatedLosses.push({
        type: "LOSS",
        pair: "GBPUSD",
        amount: parseFloat(remainingLoss.toFixed(2)),
        fee: 0,
        date: dStr,
        timestamp: createdAtDate.getTime()
      });
    }
  }

  // Merge e sort
  const allPammTrades = [...pammTrades, ...simulatedLosses].sort((a, b) => b.timestamp - a.timestamp);

  const pammTradeActivity = document.getElementById("pammTradeActivity");
  if (pammTradeActivity) {
    if (allPammTrades.length === 0) {
      pammTradeActivity.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 40px 20px; color: var(--muted);">
          
          <p style="font-weight: 700; margin-bottom: 4px;">Aguardando o primeiro trade...</p>
          <p style="font-size: 0.72rem; line-height: 1.4;">Assim que o fornecedor PAMM abrir ou fechar ordens, elas aparecerão listadas em tempo real nesta seção.</p>
        </div>
      `;
    } else {
      pammTradeActivity.innerHTML = allPammTrades.map(trade => {
        const isWin = trade.type === "WIN";
        return `
          <div class="pamm-trade-card glass-panel" style="
            display: grid;
            grid-template-columns: auto 1.5fr 1fr auto;
            align-items: center;
            gap: 15px;
            padding: 14px 20px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border);
            transition: all 0.2s ease;
            margin-bottom: 12px;
          ">
            <div style="
              width: 40px;
              height: 40px;
              border-radius: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: ${isWin ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 68, 68, 0.1)'};
              border: 1px solid ${isWin ? 'var(--bull)' : 'var(--bear)'};
              font-size: 1.1rem;
            ">
              ${isWin ? '📈' : '📉'}
            </div>
            
            <div>
              <div style="font-weight: 800; font-size: 0.9rem; color: var(--text);">${trade.pair}</div>
              <div style="font-size: 0.7rem; color: var(--muted); font-family: 'Space Mono', monospace; margin-top: 2px;">${trade.date}</div>
            </div>

            <div>
              <span style="
                font-size: 0.65rem;
                font-weight: 800;
                padding: 3px 8px;
                border-radius: 4px;
                text-transform: uppercase;
                font-family: 'Space Mono', monospace;
                background: ${isWin ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 68, 68, 0.1)'};
                color: ${isWin ? 'var(--bull)' : 'var(--bear)'};
              ">
                ${isWin ? 'COMPRA FECHADA' : 'VENDA FECHADA'}
              </span>
            </div>

            <div style="text-align: right;">
              <div style="
                font-family: 'Space Mono', monospace;
                font-weight: 800;
                font-size: 0.95rem;
                color: ${isWin ? 'var(--bull)' : 'var(--bear)'};
              ">
                ${isWin ? '+' : ''}$${trade.amount.toFixed(2)}
              </div>
              ${isWin ? `
                <div style="font-size: 0.68rem; color: var(--muted); margin-top: 2px;">
                  Taxa: -$${trade.fee.toFixed(2)}
                </div>
              ` : `
                <div style="font-size: 0.68rem; color: var(--muted); margin-top: 2px;">
                  Sem Taxas
                </div>
              `}
            </div>
          </div>
        `;
      }).join("");
    }
  }

  // Preenche o Modal de Histórico de Movimentações também
  const walletTransactionsModalEl = document.getElementById("userWalletTransactionsModal");
  if (walletTransactionsModalEl) {
    if (transactions.length === 0) {
      walletTransactionsModalEl.innerHTML = `
        <div style="text-align: center; color: var(--muted); font-size: 0.75rem; padding: 20px 0;">Sem movimentações registradas na carteira.</div>
      `;
    } else {
      walletTransactionsModalEl.innerHTML = transactions.map(tx => {
        const isDeposit = tx.type === "DEPOSIT";
        const txColor = isDeposit ? 'var(--bull)' : 'var(--bear)';
        const txSign = isDeposit ? '+' : '-';
        const dateStr = new Date(tx.createdAt).toLocaleDateString() + ' ' + new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        return `
          <div style="
            background: var(--surface2);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 10px 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
          ">
            <div>
              <div style="font-size:0.75rem; font-weight:700; color:var(--text);">${tx.description || (isDeposit ? 'Depósito Manual' : 'Dedução de Taxa')}</div>
              <div style="font-size:0.62rem; color:var(--muted); font-family:'Space Mono', monospace; margin-top:2px;">
                ${dateStr}
              </div>
            </div>
            <div style="
              font-family: 'Space Mono', monospace;
              font-weight: 800;
              font-size: 0.85rem;
              color: ${txColor};
            ">
              ${txSign}$${tx.amount.toFixed(2)}
            </div>
          </div>
        `;
      }).join("");
    }
  }
}

async function togglePammState() {
  const toggle = document.getElementById("pammActiveToggle");
  if (!toggle) return;
  const isActive = toggle.checked;
  const badge = document.getElementById("pammConnStatusBadge");
  
  try {
    const res = await fetch("/api/user/pamm/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + localStorage.getItem("aura_token") },
      body: JSON.stringify({ isActive })
    });
    const data = await res.json();
    if (data.success) {
      if (badge) {
        badge.textContent = data.isActive ? "Sincronizado" : "Pausado";
        badge.style.background = data.isActive ? "rgba(0, 230, 118, 0.15)" : "rgba(255, 171, 0, 0.15)";
        badge.style.color = data.isActive ? "var(--bull)" : "#ffab00";
      }
      showToast(data.message, "success");
    } else {
      toggle.checked = !isActive; // revert
      showToast(data.error || "Erro ao alterar estado.", "error");
    }
  } catch (err) {
    toggle.checked = !isActive; // revert
    showToast("Erro de rede ao ligar/desligar PAMM.", "error");
  }

}
// ─── PAMM SYSTEM COUPLING ───
function openPammModal() {
  console.log("%c[UI] Abrindo Modal de PAMM...", "color: #10b981; font-weight: bold;");
  const modal = document.getElementById("pammModal");
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add("active");
    // Set active step
    document.getElementById("pammStep1").style.display = 'block';
    document.getElementById("pammStep2").style.display = 'none';
    
    // Clear inputs
    document.getElementById("pammAmount").value = "";
    document.getElementById("pammHash").value = "";
    
    // Update minimum dynamic text
    const minVal = systemConfig.minPammDeposit !== undefined ? parseFloat(systemConfig.minPammDeposit) : 50.0;
    document.getElementById("pammMinValText").innerHTML = `* Valor do Gás mínimo exigido: <b>$${minVal.toFixed(2)} USD</b>`;
    
    // Load wallets
    loadPammWallets();
  } else {
    console.error("[UI] Erro: Elemento 'pammModal' não encontrado no DOM!");
  }
}

function closePammModal() {
  const modal = document.getElementById("pammModal");
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove("active");
  }
}

async function loadPammWallets() {
  const container = document.getElementById("pammWalletsContainer");
  const data = await apiFetch("/api/payment-methods");
  if (data.success && data.methods) {
    container.innerHTML = data.methods.map(m => `
      <div style="background:var(--surface);padding:10px;border-radius:8px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.65rem;color:var(--muted);text-transform:uppercase;">${m.name}</div>
          <div style="font-family:'Space Mono',monospace;font-size:0.75rem;word-break:break-all;margin-top:4px;color:var(--accent);">${m.details}</div>
        </div>
        <button class="copy-btn" onclick="copyToClipboard('${m.details}', this)" style="padding: 4px 10px; font-size: 0.7rem; border-radius: 4px; background: rgba(255,255,255,0.05); color: white; border: 1px solid var(--border); cursor: pointer;">Copiar</button>
      </div>
    `).join("") || '<p>Contate o suporte para pagamento.</p>';
  }
}

let pammCryptoCheckInterval = null;

async function submitPammDeposit(btn) {
  const amountInput = document.getElementById("pammAmount").value.trim();
  const providerToken = document.getElementById("pammProviderToken")?.value.trim() || "";
  
  if (!amountInput) {
    alert("Por favor, digite o valor do gás a ser depositado.");
    return;
  }
  if (!providerToken) {
    alert("Por favor, insira o Token do Provedor de Sinal.");
    return;
  }
  
  const amount = parseFloat(amountInput);
  const minVal = systemConfig.minPammDeposit !== undefined ? parseFloat(systemConfig.minPammDeposit) : 50.0;
  if (isNaN(amount) || amount < minVal) {
    alert(`O valor mínimo para o depósito do Gás é $${minVal.toFixed(2)} USD. O sistema rejeitou o valor inserido.`);
    return;
  }

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ENVIANDO...';

  try {
    const res = await apiFetch("/api/license/request", "POST", {
      licenseType: "PAMM",
      hash: "crypto_auto",
      amount: amount,
      providerToken: providerToken
    });

    if (res.success && res.cryptoInvoice) {
      document.getElementById("pammStep1").style.display = 'none';
      document.getElementById("pammStepCrypto").style.display = 'block';

      const inv = res.cryptoInvoice;
      document.getElementById("pammCryptoAmountDue").textContent = inv.amountDue.toFixed(2);
      document.getElementById("pammCryptoWalletAddress").value = inv.walletAddress;
      
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${inv.walletAddress}`;
      document.getElementById("pammCryptoQrCode").src = qrUrl;

      if (pammCryptoCheckInterval) clearInterval(pammCryptoCheckInterval);
      pammCryptoCheckInterval = setInterval(async () => {
        const statusRes = await apiFetch(`/api/buy/status/${res.request.id}`);
        if (statusRes.success && statusRes.status === "APPROVED") {
          clearInterval(pammCryptoCheckInterval);
          document.getElementById("pammStepCrypto").style.display = "none";
          document.getElementById("pammStep2").style.display = "block";
          
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      }, 10000);

    } else if (res.success) {
      document.getElementById("pammStep1").style.display = 'none';
      document.getElementById("pammStep2").style.display = 'block';
    } else {
      alert("Erro: " + (res.error || "Não foi possível enviar a solicitação."));
    }
  } catch (e) {
    console.error(e);
    alert("Erro de conexão ao enviar solicitação PAMM.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}
