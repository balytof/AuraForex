const fs = require('fs');
const file = 'admin_dashboard.html';
let content = fs.readFileSync(file, 'utf8');

const brokenText = `    function formatUptime(seconds) {
        const tbody = document.getElementById('plansTable');
        tbody.innerHTML = data.plans.map(p => \`
            <tr>
                <td><strong>\${p.name}</strong></td>
                <td>$\${p.price.toFixed(2)}</td>
                <td>\${p.durationDays} dias</td>
                <td><span class="badge \${p.isActive ? 'badge-active' : ''}">\${p.isActive ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                    <button class="btn" style="color: \${p.isActive ? 'var(--warn)' : 'var(--success)'}" onclick="togglePlan('\${p.id}', \${p.isActive})">\${p.isActive ? 'Desativar' : 'Ativar'}</button>
                    <button class="btn" onclick="openPlanModal('\${p.id}', '\${p.name}', \${p.price}, \${p.durationDays})">✏️</button>
                    <button class="btn" style="color:var(--bear)" onclick="deletePlan('\${p.id}')">🗑️</button>
                </td>
            </tr>
        \`).join('') || '<tr><td colspan="5" style="text-align:center;">Nenhum plano criado.</td></tr>';
    }`;

const fixedText = `    function formatUptime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return \`\${h}h \${m}m\`;
    }

    async function loadRequests() {
        const data = await api("/api/admin/requests");
        if (!data.success) return;
        const tbody = document.getElementById('requestsTable');
        tbody.innerHTML = data.requests.map(r => {
            const isPamm = r.licenseType === "PAMM";
            const serviceLabel = isPamm ? "💳 PAMM (Gás)" : "🤖 Robo VPS";
            const serviceBadgeClass = isPamm ? "badge-pamm" : "badge-vps";
            const planLabel = r.plan ? r.plan.name : (isPamm ? "Depósito de Gás" : "Standard VPS");
            
            const approveButtonText = isPamm ? "Aprovar PAMM" : "Aprovar VPS";
            const approveButtonClass = isPamm ? "btn btn-pamm" : "btn btn-vps";

            return \`
                <tr>
                    <td>\${r.user.email}</td>
                    <td><span class="badge \${serviceBadgeClass}">\${serviceLabel}</span></td>
                    <td><strong>\${planLabel}</strong></td>
                    <td>$\${r.amount.toFixed(2)}</td>
                    <td style="font-family:'Space Mono';font-size:0.7rem;color:var(--accent);">
                        \${r.transactionHash ? \`<a href="https://bscscan.com/tx/\${r.transactionHash}" target="_blank" style="color:var(--accent); text-decoration:none;">\${r.transactionHash} 🔗</a>\` : '—'}
                    </td>
                    <td>\${new Date(r.createdAt).toLocaleDateString()}</td>
                    <td style="display:flex; gap:6px;">
                        <button class="\${approveButtonClass}" onclick="openApproveModal('\${r.id}', '\${r.user.email}', '\${isPamm ? 'PAMM' : 'VPS'}', '\${planLabel}', \${r.amount})">\${approveButtonText}</button>
                        <button class="btn" style="background:var(--bear);color:#fff;border:none;padding:8px 12px;" onclick="rejectRequest('\${r.id}', '\${r.user.email}')" title="Rejeitar Solicitação">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            \`;
        }).join('') || '<tr><td colspan="7" style="text-align:center;">Sem pendências.</td></tr>';
    }

    async function rejectRequest(id, email) {
        if (!confirm(\`Tem a certeza que deseja REJEITAR/ELIMINAR a solicitação de \${email}?\`)) return;
        const res = await api(\`/api/admin/requests/\${id}/reject\`, "POST", { });
        if (res.success) {
            loadRequests();
            loadStats();
        } else alert(res.error);
    }

    async function loadPlans() {
        const data = await api("/api/admin/plans");
        if (!data.success) return;
        const tbody = document.getElementById('plansTable');
        tbody.innerHTML = data.plans.map(p => \`
            <tr>
                <td><strong>\${p.name}</strong></td>
                <td>$\${p.price.toFixed(2)}</td>
                <td>\${p.durationDays} dias</td>
                <td><span class="badge \${p.isActive ? 'badge-active' : ''}">\${p.isActive ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                    <button class="btn" style="color: \${p.isActive ? 'var(--warn)' : 'var(--success)'}" onclick="togglePlan('\${p.id}', \${p.isActive})">\${p.isActive ? 'Desativar' : 'Ativar'}</button>
                    <button class="btn" onclick="openPlanModal('\${p.id}', '\${p.name}', \${p.price}, \${p.durationDays})">✏️</button>
                    <button class="btn" style="color:var(--bear)" onclick="deletePlan('\${p.id}')">🗑️</button>
                </td>
            </tr>
        \`).join('') || '<tr><td colspan="5" style="text-align:center;">Nenhum plano criado.</td></tr>';
    }`;

if (content.includes(brokenText)) {
    content = content.replace(brokenText, fixedText);
    fs.writeFileSync(file, content);
    console.log('Patch successfully applied!');
} else {
    console.log('Broken text not found! Please check exact string match.');
}
