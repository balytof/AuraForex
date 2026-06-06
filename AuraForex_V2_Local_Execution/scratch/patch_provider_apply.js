const fs = require('fs');

// 1. Update deploy_all.js
let deployJS = fs.readFileSync('../deploy_all.js', 'utf8');
deployJS = deployJS.replace(
    "conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && pm2 restart server'",
    "conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && npx prisma generate && npx prisma db push && pm2 restart server'"
);
fs.writeFileSync('../deploy_all.js', deployJS);

// 2. Update server.js
let serverJS = fs.readFileSync('../server.js', 'utf8');
// Add GET /api/user/provider/status
if (!serverJS.includes('/api/user/provider/status')) {
    const statusRoute = `
app.get("/api/user/provider/status", requireAuth, async (req, res) => {
    try {
      const provider = await prisma.provider.findFirst({ where: { userId: req.user.id } });
      if (!provider) return res.json({ status: "NONE" });
      res.json({ status: provider.status });
    } catch (e) {
      res.status(500).json({ error: "Erro interno" });
    }
});
`;
    serverJS = serverJS.replace(
        'app.get("/api/user/provider/stats"',
        statusRoute + '\napp.get("/api/user/provider/stats"'
    );
}

// Update apply route
serverJS = serverJS.replace(
    'const providerName = req.body.name || req.user.email.split(\'@\')[0];',
    'const providerName = req.body.name || req.user.email.split(\'@\')[0];\n      const providerEmail = req.body.email;'
);
serverJS = serverJS.replace(
    'name: providerName, \n          token',
    'name: providerName, \n          email: providerEmail, \n          token'
);
fs.writeFileSync('../server.js', serverJS);

// 3. Update smc_bot_dashboard.html
let dash = fs.readFileSync('../smc_bot_dashboard.html', 'utf8');

if (!dash.includes('id="providerApplyEmail"')) {
    dash = dash.replace(
        '<input type="text" id="providerApplyName" placeholder="Ex: MasterTraderPro"',
        '<label style="display: block; margin-bottom: 10px; color: var(--muted); font-size: 0.9rem;">Email:</label>\n              <input type="email" id="providerApplyEmail" placeholder="Ex: seuemail@gmail.com" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border); background: rgba(0,0,0,0.5); color: white; margin-bottom: 20px;">\n\n              <label style="display: block; margin-bottom: 10px; color: var(--muted); font-size: 0.9rem;">Nome ou Apelido de Provedor:</label>\n              <input type="text" id="providerApplyName" placeholder="Ex: MasterTraderPro"'
    );
}

if (!dash.includes('async function loadProviderStatus')) {
    const statusFunc = `
  async function loadProviderStatus() {
      try {
        const token = localStorage.getItem('aura_token');
        const res = await fetch('/api/user/provider/status', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        
        document.getElementById('providerApplyContainer').style.display = 'none';
        document.getElementById('providerPendingContainer').style.display = 'none';
        document.getElementById('providerRejectedContainer').style.display = 'none';
        
        if (data.status === 'NONE') {
            document.getElementById('providerApplyContainer').style.display = 'block';
        } else if (data.status === 'PENDING') {
            document.getElementById('providerPendingContainer').style.display = 'block';
        } else if (data.status === 'REJECTED') {
            document.getElementById('providerRejectedContainer').style.display = 'block';
        } else if (data.status === 'APPROVED') {
            // For approved providers, redirect them to the affiliate/provider dashboard
            window.location.href = '/affiliate_dashboard.html';
        }
      } catch(err) {
        console.error(err);
      }
  }
`;
    dash = dash.replace(
        'async function submitProviderApplication(btn) {',
        statusFunc + '\n  async function submitProviderApplication(btn) {'
    );
    
    // Call loadProviderStatus when clicking the provider tab
    dash = dash.replace(
        "document.getElementById('providerSection').style.display = 'block';",
        "document.getElementById('providerSection').style.display = 'block';\n        loadProviderStatus();"
    );
    
    // update submitProviderApplication to send email
    dash = dash.replace(
        "const name = document.getElementById('providerApplyName').value.trim();",
        "const name = document.getElementById('providerApplyName').value.trim();\n    const email = document.getElementById('providerApplyEmail').value.trim();"
    );
    dash = dash.replace(
        "if(!name) { alert('Digite um nome!'); return; }",
        "if(!name || !email) { alert('Digite o nome e o email!'); return; }"
    );
    dash = dash.replace(
        "body: JSON.stringify({ name })",
        "body: JSON.stringify({ name, email })"
    );
    dash = dash.replace(
        "alert(data.message);\n        // could reload state",
        "alert(data.message);\n        loadProviderStatus();"
    );
}

fs.writeFileSync('../smc_bot_dashboard.html', dash);
console.log("Patches applied.");
