const fs = require('fs');
let txt = fs.readFileSync('smc_bot_dashboard.html', 'utf8');

const targetSaveStr = `    if (res.success) {
      alert("Sucesso! Conta PAMM ligada com sucesso.");
      if (res.pammAccount) {
        document.getElementById("pammInvestorPw").value = "••••••••";
      }
      loadPammDashboardData();
    } else {
      alert("Erro: " + (res.error || "Não foi possível ligar a conta PAMM."));
    }`;

const newSaveStr = `    if (res.success) {
      alert("Sucesso! Conta PAMM ligada com sucesso.");
      if (res.pammAccount) {
        document.getElementById("pammInvestorPw").value = "••••••••";
      }
      loadPammDashboardData();
    } else if (res.error === 'DUPLICATE_ACCOUNT') {
      if (confirm("Você já possui uma conta conectada ao PAMM.\\n\\nDesejas trocar de conta agora?")) {
        // Request change
        const reqRes = await apiFetch('/api/user/pamm/request-change', 'POST');
        if (reqRes.success) {
          alert("Solicitação enviada ao suporte. Assim que a conta antiga for removida, será notificado.");
          loadPammDashboardData();
        } else {
          alert("Erro ao enviar solicitação: " + (reqRes.error || "Erro desconhecido."));
        }
      }
    } else {
      alert("Erro: " + (res.error || "Não foi possível ligar a conta PAMM."));
    }`;

if (txt.includes(targetSaveStr)) {
  txt = txt.replace(targetSaveStr, newSaveStr);
}

const targetUpdateUI = `      pammRes.pammPerformanceFeePct || 30,
      txRes.transactions || []
    );`;

const newUpdateUI = `      pammRes.pammPerformanceFeePct || 30,
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
    }`;

if (txt.includes(targetUpdateUI)) {
  txt = txt.replace(targetUpdateUI, newUpdateUI);
}

fs.writeFileSync('smc_bot_dashboard.html', txt, 'utf8');
console.log('Client dashboard updated');
