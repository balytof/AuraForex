
function openTradingHistoryModal() {
  document.getElementById('tradingHistoryModal').style.display = 'flex';
  loadHistory();
  loadPerformanceHistory();
}

function closeTradingHistoryModal() {
  document.getElementById('tradingHistoryModal').style.display = 'none';
}

function switchHistoryTab(tab) {
  const btnNeg = document.getElementById('tabHistNegociacoes');
  const btnPerf = document.getElementById('tabHistPerformance');
  const contentNeg = document.getElementById('contentHistNegociacoes');
  const contentPerf = document.getElementById('contentHistPerformance');
  
  if(tab === 'negociacoes') {
    btnNeg.style.color = 'var(--text)';
    btnNeg.style.borderBottom = '2px solid var(--accent)';
    btnPerf.style.color = 'var(--muted)';
    btnPerf.style.borderBottom = '2px solid transparent';
    contentNeg.style.display = 'block';
    contentPerf.style.display = 'none';
  } else {
    btnPerf.style.color = 'var(--text)';
    btnPerf.style.borderBottom = '2px solid var(--accent)';
    btnNeg.style.color = 'var(--muted)';
    btnNeg.style.borderBottom = '2px solid transparent';
    contentPerf.style.display = 'block';
    contentNeg.style.display = 'none';
  }
}

async function loadPerformanceHistory() {
  try {
    const response = await fetch('/api/user/performance', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('aura_token')}` }
    });
    const result = await response.json();
    const container = document.getElementById('performanceCardsContainer');
    if (!result.success || !result.performance || result.performance.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted);width:100%;">Nenhum histórico de performance disponível.</div>`;
      return;
    }
    
    container.innerHTML = '';
    result.performance.forEach(perf => {
      const isProfit = perf.realizedProfit >= 0;
      const profitColor = isProfit ? 'var(--bull)' : 'var(--bear)';
      const targetBg = perf.targetReached ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 255, 255, 0.05)';
      const targetColor = perf.targetReached ? 'var(--bull)' : 'var(--muted)';
      const targetIcon = perf.targetReached ? '<i class="fas fa-trophy"></i> Meta Batida' : '<i class="fas fa-tasks"></i> Meta Pendente';
      
      const card = document.createElement('div');
      card.style.background = 'var(--surface2)';
      card.style.border = '1px solid var(--border)';
      card.style.borderRadius = '12px';
      card.style.padding = '15px';
      card.style.position = 'relative';
      card.style.overflow = 'hidden';
      
      // Efeito premium no topo do card se bater meta
      const glow = perf.targetReached ? `<div style="position:absolute; top:0; left:0; right:0; height:3px; background:var(--bull); box-shadow:0 0 10px var(--bull);"></div>` : '';

      card.innerHTML = `
        ${glow}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-size:0.8rem; color:var(--muted); font-weight:600;"><i class="far fa-calendar-alt"></i> ${perf.date}</span>
          <span style="font-size:0.7rem; font-weight:bold; padding:4px 8px; border-radius:4px; background:${targetBg}; color:${targetColor};">${targetIcon}</span>
        </div>
        <div style="margin-bottom:10px;">
          <div style="font-size:0.7rem; color:var(--muted); text-transform:uppercase;">Capital Inicial</div>
          <div style="font-size:1.1rem; font-weight:bold; color:var(--text);">$${Number(perf.startBalance).toFixed(2)}</div>
        </div>
        <div>
          <div style="font-size:0.7rem; color:var(--muted); text-transform:uppercase;">Lucro Líquido</div>
          <div style="font-size:1.3rem; font-weight:900; color:${profitColor};">${isProfit ? '+' : ''}$${Number(perf.realizedProfit).toFixed(2)}</div>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    console.error('Falha ao carregar performance', e);
  }
}

setInterval(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('source')) window.buySource = params.get('source');

  if ((window.location.hash.includes('buy_license') || window.location.search.includes('buy_license=true')) && !window.buyModalTriggered) {
    if (typeof openBuyModal === 'function' && document.getElementById('buyModal')) {
      window.buyModalTriggered = true;
      openBuyModal();
      
      const newUrl = window.location.pathname;
      window.history.replaceState(null, null, newUrl);
    }
  }
}, 500);

// Funções para Configurações Avançadas
function saveAdvancedConfig() {
  const emaModeRadios = document.getElementsByName("emaMode");
  let emaMode = "auto";
  for(const r of emaModeRadios) { if(r.checked) emaMode = r.value; }
  
  const dailyTarget = document.getElementById("advDailyTarget").value;
  const dailyLoss = document.getElementById("advDailyLoss").value;
  
  // Guardamos estes valores na localStorage temporalmente (ou podíamos passar directo)
  // Mas como a saveConfig() principal já sincroniza tudo, vamos chamar uma função dedicada ou adaptar a saveConfig
  
  // Vamos enviar para o Backend imediatamente:
  const advConfig = {
    emaMode: emaMode,
    dailyProfitTarget: dailyTarget,
    dailyLossLimit: dailyLoss,
    runnerMode: document.getElementById("advRunnerMode").value,
    profitLockMin: document.getElementById("advProfitLockMin").value,
    profitLockDrop: document.getElementById("advProfitLockDrop").value,
    exitMode: document.getElementById("advExitMode").value,
    holdSeconds: document.getElementById("advHoldSeconds").value,
    negativeHoldSeconds: document.getElementById("advNegativeHoldSeconds").value
  };
  
  apiFetch("/api/user/advanced-settings", "POST", advConfig)
    .then(res => {
      alert("Configurações Avançadas Guardadas com Sucesso!");
      document.getElementById('advancedSettingsOverlay').style.display='none';
    })
    .catch(e => {
      alert("Erro ao guardar definições: " + e.message);
    });
}

function loadAdvancedConfig() {
  // Vamos carregar ao iniciar a página
  apiFetch("/api/user/advanced-settings", "GET")
    .then(res => {
      // O GET devolve res = { emaMode, advDailyProfitPct, advDailyLossPct, runnerMode, profitLockMin, profitLockDrop }
      document.getElementById("advDailyTarget").value = res.advDailyProfitPct || "";
      document.getElementById("advDailyLoss").value = res.advDailyLossPct || "";
      const mode = res.emaMode || "auto";
      const radios = document.getElementsByName("emaMode");
      for(const r of radios) {
        if(r.value === mode) r.checked = true;
      }
      
      const rMode = res.runnerMode || "none";
      document.getElementById("advRunnerMode").value = rMode;
      document.getElementById("advProfitLockMin").value = res.profitLockMin !== undefined ? res.profitLockMin : 10;
      document.getElementById("advProfitLockDrop").value = res.profitLockDrop !== undefined ? res.profitLockDrop : 30;
      
      const eMode = res.exitMode || "take_profit";
      document.getElementById("advExitMode").value = eMode;
      document.getElementById("advHoldSeconds").value = res.holdSeconds !== undefined ? res.holdSeconds : 180;
      document.getElementById("advNegativeHoldSeconds").value = res.negativeHoldSeconds !== undefined ? res.negativeHoldSeconds : 120;
      
      toggleProfitLockFields();
      toggleExitStrategyFields();
    })
    .catch(e => console.warn("Failed to load advanced settings"));
}
// Chamar ao iniciar
setTimeout(loadAdvancedConfig, 1500);
