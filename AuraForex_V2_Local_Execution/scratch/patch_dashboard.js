const fs = require('fs');

let html = fs.readFileSync('../smc_bot_dashboard.html', 'utf8');

// 1. Rename Provider to Copy Trading and make always visible
html = html.replace(
  '<a href="#" class="nav-item" id="providerLink" style="display: none;" onclick="switchTab(\'provider\')">\n        <i class="fas fa-briefcase"></i>\n        <span>Provedor</span>',
  '<a href="#" class="nav-item" id="providerLink" onclick="switchTab(\'provider\')">\n        <i class="fas fa-copy"></i>\n        <span>Copy Trading</span>'
);

// 2. Add LemonSqueezy Button
html = html.replace(
  '<button onclick="generateCryptoInvoice(this)" class="btn btn-primary" style="width:100%; padding:15px; font-weight:700; background: #f3ba2f; color: #000;">\n          <i class="fab fa-bitcoin"></i> PAGAMENTO AUTOMÁTICO (USDT BSC)\n        </button>',
  '<button onclick="generateCryptoInvoice(this)" class="btn btn-primary" style="width:100%; padding:15px; font-weight:700; background: #f3ba2f; color: #000; margin-bottom: 10px;">\n          <i class="fab fa-bitcoin"></i> PAGAMENTO AUTOMÁTICO (USDT BSC)\n        </button>\n\n        <button onclick="submitLemonSqueezyPayment(this)" class="btn btn-secondary" style="width:100%; padding:15px; font-weight:700; background: #9d50bb; color: white; border-color: #9d50bb;">\n          <i class="fas fa-credit-card"></i> PAGAR COM CARTÃO\n        </button>'
);

// 3. Add LemonSqueezy JS function
html = html.replace(
  'async function generateCryptoInvoice(btn) {',
  `async function submitLemonSqueezyPayment(btn) {
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

  async function generateCryptoInvoice(btn) {`
);

// 4. Update the Provider Section UI to handle Application Form
html = html.replace(
  '<section id="providerSection" class="content-section" style="display: none; padding-top: 10px;">',
  `<section id="providerSection" class="content-section" style="display: none; padding-top: 10px;">
        
        <!-- Application Form Container -->
        <div id="providerApplyContainer" style="display: none; max-width: 600px; margin: 0 auto; text-align: center; padding: 40px 20px;">
          <i class="fas fa-bullhorn" style="font-size: 3rem; color: var(--accent); margin-bottom: 20px;"></i>
          <h2 style="margin-bottom: 15px;">Torne-se um Provedor de Sinais</h2>
          <p style="color: var(--muted); margin-bottom: 30px;">Ganhe até 30% de comissão sobre os lucros dos seus copiadores. Preencha o formulário para submeter a sua candidatura.</p>
          
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border); padding: 25px; border-radius: 15px; text-align: left;">
            <label style="display: block; margin-bottom: 10px; color: var(--muted); font-size: 0.9rem;">Nome ou Apelido de Provedor:</label>
            <input type="text" id="providerApplyName" placeholder="Ex: MasterTraderPro" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border); background: rgba(0,0,0,0.5); color: white; margin-bottom: 20px;">
            
            <button onclick="submitProviderApplication(this)" class="btn btn-primary" style="width: 100%; padding: 15px; font-weight: 800;">SUBMETER CANDIDATURA</button>
          </div>
        </div>

        <!-- Pending State Container -->
        <div id="providerPendingContainer" style="display: none; max-width: 600px; margin: 0 auto; text-align: center; padding: 40px 20px;">
          <i class="fas fa-hourglass-half" style="font-size: 3rem; color: #f3ba2f; margin-bottom: 20px;"></i>
          <h2 style="margin-bottom: 15px;">Candidatura em Análise</h2>
          <p style="color: var(--muted); margin-bottom: 30px;">A sua candidatura está a ser analisada pela nossa equipa. Receberá uma notificação assim que for aprovada.</p>
        </div>

        <!-- Rejected State Container -->
        <div id="providerRejectedContainer" style="display: none; max-width: 600px; margin: 0 auto; text-align: center; padding: 40px 20px;">
          <i class="fas fa-times-circle" style="font-size: 3rem; color: var(--bear); margin-bottom: 20px;"></i>
          <h2 style="margin-bottom: 15px;">Candidatura Rejeitada</h2>
          <p style="color: var(--muted); margin-bottom: 30px;">Infelizmente, a sua candidatura não foi aprovada neste momento.</p>
        </div>

        <!-- Dashboard Container -->
        <div id="providerDashboardContainer">`
);

// Close the Dashboard Container at the end of the section
html = html.replace(
  '    </section>\n\n    <!-- SETTINGS / CONFIG MODAL -->',
  '    </div>\n    </section>\n\n    <!-- SETTINGS / CONFIG MODAL -->'
);

// 5. Update the Provider JS Fetch logic
const oldStatsLogic = `// Stats
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
      }`;

const newStatsLogic = `// Stats
      const resStats = await fetch('/api/user/provider/stats', { headers });
      
      // Reset displays
      document.getElementById('providerApplyContainer').style.display = 'none';
      document.getElementById('providerPendingContainer').style.display = 'none';
      document.getElementById('providerRejectedContainer').style.display = 'none';
      document.getElementById('providerDashboardContainer').style.display = 'none';

      if (resStats.ok) {
        const { stats } = await resStats.json();
        
        if (stats.status === "PENDING") {
          document.getElementById('providerPendingContainer').style.display = 'block';
        } else if (stats.status === "REJECTED") {
          document.getElementById('providerRejectedContainer').style.display = 'block';
        } else {
          document.getElementById('providerDashboardContainer').style.display = 'block';
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
      } else {
        // Assume not a provider yet, show application form
        document.getElementById('providerApplyContainer').style.display = 'block';
      }`;

html = html.replace(oldStatsLogic, newStatsLogic);

// Add the application submit function
html = html.replace(
  'async function loadProviderStats() {',
  `async function submitProviderApplication(btn) {
    const name = document.getElementById("providerApplyName").value;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SUBMETENDO...';

    try {
      const res = await apiFetch("/api/user/provider/apply", "POST", { name });
      if (res.success) {
        alert("Candidatura submetida com sucesso!");
        loadProviderStats();
      } else {
        alert(res.error || "Erro ao submeter.");
      }
    } catch(err) {
      alert("Erro interno.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  async function loadProviderStats() {`
);

fs.writeFileSync('../smc_bot_dashboard.html', html);
console.log("HTML Patched");
