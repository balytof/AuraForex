const fs = require('fs');

const filePath = 'c:\\Users\\Lenovo\\Desktop\\Auraforex\\AuraForex_V2_Local_Execution\\smc_bot_dashboard.html';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize to LF for easy index matching
content = content.replace(/\r\n/g, '\n');

// 1. Replace renderPammToastNotification by range match
const toastStart = 'function renderPammToastNotification(trade)';
const toastEnd = 'function updatePammUI(pammAccount';

const idxToastStart = content.indexOf(toastStart);
if (idxToastStart !== -1) {
  const idxToastEnd = content.indexOf(toastEnd, idxToastStart);
  if (idxToastEnd !== -1) {
    const newToastCode = `function renderPammToastNotification(trade) {
  const container = document.getElementById("pammToastContainer");
  if (!container) return;

  const isWin = trade.type === "WIN";
  const toast = document.createElement("div");
  toast.className = \`toast-neon \${isWin ? 'profit' : 'loss'}\`;
  
  toast.innerHTML = \`
    <div class="toast-icon">
      \${isWin ? '<i class="fas fa-arrow-trend-up"></i>' : '<i class="fas fa-arrow-trend-down"></i>'}
    </div>
    <div class="toast-content">
      <div class="toast-title" style="color: \${isWin ? 'var(--bull)' : 'var(--bear)'};">
        \${isWin ? 'LUCRO DE COPILOTO PAMM' : 'PREJUÍZO REGISTRADO'}
      </div>
      <div class="toast-desc">
        Trade fechado em \${trade.pair}: \${isWin ? '+' : ''}$\${trade.amount.toFixed(2)} USD<br>
        \${isWin ? 'Taxa Gás: -$' + trade.fee.toFixed(2) + ' USD' : 'Sem cobrança de taxa'}
      </div>
    </div>
  \`;

  container.appendChild(toast);

  // Trigger browser animation
  setTimeout(() => {
    toast.classList.add("show");
  }, 50);

  // Auto-remove after 6s
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 6000);
}

`;
    content = content.substring(0, idxToastStart) + newToastCode + content.substring(idxToastEnd);
    console.log("✅ renderPammToastNotification replaced successfully!");
  } else {
    console.log("❌ Could not find end of renderPammToastNotification!");
  }
} else {
  console.log("❌ Could not find start of renderPammToastNotification!");
}

// 2. Replace updateLicenseUI by range match
const licenseStart = 'function updateLicenseUI()';
const licenseEnd = '// Atualizar Status do EA (Heartbeat)';

const idxLicenseStart = content.indexOf(licenseStart);
if (idxLicenseStart !== -1) {
  const idxLicenseEnd = content.indexOf(licenseEnd, idxLicenseStart);
  if (idxLicenseEnd !== -1) {
    const newLicenseCode = `function updateLicenseUI() {
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
}

`;
    content = content.substring(0, idxLicenseStart) + newLicenseCode + content.substring(idxLicenseEnd);
    console.log("✅ updateLicenseUI replaced successfully!");
  } else {
    console.log("❌ Could not find end of updateLicenseUI!");
  }
} else {
  console.log("❌ Could not find start of updateLicenseUI!");
}

// 3. Replace switchDashboardView by range match
const switchStart = 'function switchDashboardView(view)';
const switchEnd = 'async function savePammCredentials()';

const idxSwitchStart = content.indexOf(switchStart);
if (idxSwitchStart !== -1) {
  const idxSwitchEnd = content.indexOf(switchEnd, idxSwitchStart);
  if (idxSwitchEnd !== -1) {
    const newSwitchCode = `function switchDashboardView(view) {
  console.log(\`[UI] Mudando visualização do dashboard para: \${view}\`);
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
    if (dailyLockOverlay) dailyLockOverlay.style.display = isDailyLocked ? "block" : "none";
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

`;
    content = content.substring(0, idxSwitchStart) + newSwitchCode + content.substring(idxSwitchEnd);
    console.log("✅ switchDashboardView replaced successfully!");
  } else {
    console.log("❌ Could not find end of switchDashboardView!");
  }
} else {
  console.log("❌ Could not find start of switchDashboardView!");
}

// Convert back to CRLF to respect Windows line endings
const finalContent = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, finalContent, 'utf8');
console.log("✨ All range replacements successfully written to disk!");
