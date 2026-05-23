const fs = require('fs');
let txt = fs.readFileSync('admin_dashboard.html', 'utf8');

const targetStr = `                tr.innerHTML = \`
                    <td>\${acc.user?.email || 'N/A'}</td>
                    <td style="font-family: monospace;">\${acc.accountNumber}</td>
                    <td>\${acc.server}</td>
                    <td style="color: var(--text);">$\${acc.balance.toFixed(2)} / $\${acc.equity.toFixed(2)}</td>
                    <td style="color: \${acc.totalProfit >= 0 ? 'var(--bull)' : 'var(--bear)'}; font-weight: bold;">
                        \${acc.totalProfit >= 0 ? '+' : ''}$\${acc.totalProfit.toFixed(2)}
                    </td>
                    <td>\${statusBadge}</td>
                \`;`;

const newStr = `                
                let changeReqBadge = acc.changeRequested 
                    ? \`<div style="margin-top: 4px;"><span class="badge" style="background: rgba(255, 171, 0, 0.2); color: #ffab00; font-size: 0.65rem;">🚨 Pedido de Troca</span></div>\` 
                    : '';

                tr.innerHTML = \`
                    <td>
                      \${acc.user?.email || 'N/A'}
                      \${changeReqBadge}
                    </td>
                    <td style="font-family: monospace;">\${acc.accountNumber}</td>
                    <td>\${acc.server}</td>
                    <td style="color: var(--text);">$\${acc.balance.toFixed(2)} / $\${acc.equity.toFixed(2)}</td>
                    <td style="color: \${acc.totalProfit >= 0 ? 'var(--bull)' : 'var(--bear)'}; font-weight: bold;">
                        \${acc.totalProfit >= 0 ? '+' : ''}$\${acc.totalProfit.toFixed(2)}
                    </td>
                    <td>
                      \${statusBadge}
                      <button onclick="removePammAccount('\${acc.userId}')" style="margin-left: 8px; padding: 4px 8px; background: rgba(255, 68, 68, 0.15); color: var(--bear); border: 1px solid var(--bear); border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: bold;">Remover</button>
                    </td>
                \`;`;

if (txt.includes(targetStr)) {
  txt = txt.replace(targetStr, newStr);
  console.log("Admin table logic replaced successfully.");
} else {
  console.log("Admin table logic NOT found.");
}

const functionTarget = `    loadStats();
    loadSystemSettings();`;

const functionNew = `    async function removePammAccount(userId) {
        if (!confirm("Aviso: Esta ação irá eliminar a conta da MetaApi e limpar os dados da base de dados. O utilizador será notificado para ligar uma nova conta.\\n\\nDeseja prosseguir?")) return;
        try {
            const res = await fetch("/api/admin/pamm/remove", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + localStorage.getItem("aura_admin_token") },
                body: JSON.stringify({ targetUserId: userId })
            });
            const data = await res.json();
            if (data.success) {
                alert("Conta PAMM removida com sucesso!");
                loadAdminPammData();
            } else {
                alert("Erro ao remover: " + data.error);
            }
        } catch (err) {
            console.error(err);
            alert("Erro de rede.");
        }
    }

    loadStats();
    loadSystemSettings();`;

if (txt.includes(functionTarget)) {
  txt = txt.replace(functionTarget, functionNew);
  console.log("Admin function replaced successfully.");
}

fs.writeFileSync('admin_dashboard.html', txt, 'utf8');
