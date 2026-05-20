
    // ─── API HELPER (RESTORED) ───────────────────
    async function api(path, method = "GET", body = null) {
        const token = localStorage.getItem("aura_token");
        const opts = {
            method,
            headers: { 
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token 
            }
        };
        if (body) opts.body = JSON.stringify(body);
        try {
            const res = await fetch(path, opts);
            if (res.status === 401) {
                localStorage.removeItem("aura_token");
                window.location.href = "/login.html";
                return { success: false, error: "Sessão expirada." };
            }
            return await res.json();
        } catch (e) {
            console.error("API Error:", e);
            return { success: false, error: "Erro de ligação ao servidor." };
        }
    }

    // ─── SIDEBAR TOGGLE ──────────────────────────
    function toggleSidebar() {
        const sidebar = document.getElementById("sidebarNav");
        const overlay = document.querySelector(".sidebar-overlay");
        sidebar.classList.toggle("active");
        overlay.classList.toggle("active");
    }

    // Update active state in sidebar
    function showPanel(id) {
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-' + id)?.classList.add('active');
        
        // Update sidebar active state
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('onclick')?.includes(`showPanel('${id}')`)) {
                item.classList.add('active');
            }
        });

        // Close sidebar on mobile after selection
        if (window.innerWidth <= 992) {
            toggleSidebar();
        }

        if (id === 'stats') loadStats();
        if (id === 'requests') loadRequests();
        if (id === 'plans') loadPlans();
        if (id === 'users') loadUsers();
        if (id === 'finance') loadFinance();
        if (id === 'settings') {
            loadPaymentMethods();
            loadSystemSettings();
        }
    }

    async function loadStats() {
        const data = await api("/api/admin/stats");
        if (data.success) {
            document.getElementById('statUsers').textContent = data.stats.totalUsers;
            document.getElementById('statLicenses').textContent = data.stats.activeLicenses;
            document.getElementById('statRequests').textContent = data.stats.pendingRequests;
            document.getElementById('statUptime').textContent = formatUptime(data.stats.uptime);
        }
    }

    function formatUptime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    }

    async function loadRequests() {
        const data = await api("/api/admin/requests");
        if (!data.success) return;
        const tbody = document.getElementById('requestsTable');
        tbody.innerHTML = data.requests.map(r => `
            <tr>
                <td>${r.user.email}</td>
                <td><span class="badge badge-pro">${r.plan ? r.plan.name : (r.licenseType || 'N/A')}</span></td>
                <td>$${r.amount}</td>
                <td style="font-family:'Space Mono';font-size:0.7rem;color:var(--accent);">
                    ${r.transactionHash ? `<a href="https://bscscan.com/tx/${r.transactionHash}" target="_blank" style="color:var(--accent); text-decoration:none;">${r.transactionHash} 🔗</a>` : '—'}
                </td>
                <td>${new Date(r.createdAt).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-success" onclick="openApproveModal('${r.id}', '${r.user.email}', '${r.plan ? r.plan.name : r.licenseType}')">Aprovar Pagamento</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center;">Sem pendências.</td></tr>';
    }

    async function loadPlans() {
        const data = await api("/api/admin/plans");
        if (!data.success) return;
        const tbody = document.getElementById('plansTable');
        tbody.innerHTML = data.plans.map(p => `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td>$${p.price.toFixed(2)}</td>
                <td>${p.durationDays} dias</td>
                <td><span class="badge ${p.isActive ? 'badge-active' : ''}">${p.isActive ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                    <button class="btn" onclick="openPlanModal('${p.id}', '${p.name}', ${p.price}, ${p.durationDays})">✏️</button>
                    <button class="btn" style="color:var(--bear)" onclick="deletePlan('${p.id}')">🗑️</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center;">Nenhum plano criado.</td></tr>';
    }

    let currentPlanId = null;
    function openPlanModal(id = null, name = '', price = '', days = '') {
        currentPlanId = id;
        document.getElementById('planModalTitle').textContent = id ? 'Editar Plano' : 'Novo Plano de Licença';
        document.getElementById('planName').value = name;
        document.getElementById('planPrice').value = price;
        document.getElementById('planDays').value = days;
        document.getElementById('savePlanBtn').onclick = savePlan;
        document.getElementById('planModal').classList.add('active');
    }

    async function savePlan() {
        const payload = {
            name: document.getElementById('planName').value,
            price: document.getElementById('planPrice').value,
            durationDays: document.getElementById('planDays').value
        };
        const method = currentPlanId ? "PUT" : "POST";
        const url = "/api/admin/plans" + (currentPlanId ? "/" + currentPlanId : "");
        const res = await api(url, method, payload);
        if (res.success) {
            closeModal('planModal');
            loadPlans();
        } else alert(res.error);
    }

    async function deletePlan(id) {
        if (!confirm("Tem certeza que deseja excluir este plano?")) return;
        const res = await api(`/api/admin/plans/${id}`, "DELETE");
        if (res.success) loadPlans();
        else alert(res.error);
    }

    let allUsers = [];
    async function loadUsers() {
        const data = await api("/api/admin/users");
        if (!data.success) return;
        allUsers = data.users;
        renderUsers(allUsers);
    }

    function filterUsers() {
        const email = document.getElementById('searchUserEmail').value.toLowerCase();
        const ref = document.getElementById('searchUserRef').value.toLowerCase();
        const period = document.getElementById('userReportPeriod').value; // YYYY-MM
        
        const filtered = allUsers.filter(u => {
            const matchesEmail = u.email.toLowerCase().includes(email);
            const matchesRef = (u.referralCode?.toLowerCase().includes(ref) || u.id.toLowerCase().includes(ref));
            
            let matchesPeriod = true;
            if (period) {
                const [year, month] = period.split("-");
                const d = new Date(u.createdAt);
                matchesPeriod = (d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month));
            }
            
            return matchesEmail && matchesRef && matchesPeriod;
        });
        renderUsers(filtered);
    }

    function renderUsers(users) {
        const tbody = document.getElementById('usersTable');
        tbody.innerHTML = users.map(u => {
            const lic = u.licenses?.[0];
            const regDate = new Date(u.createdAt).toLocaleDateString();
            const balance = (u.walletBalance !== null && u.walletBalance !== undefined) ? Number(u.walletBalance) : 0.0;
            const customFee = u.settings?.pammPerformanceFeePct;
            const feeStr = (customFee !== null && customFee !== undefined) ? `${customFee}%` : 'Padrão';
            
            // wallet display with low balance alert styling
            const balanceStyle = balance <= 0 ? 'color: var(--bear); font-weight: bold;' : balance < 10 ? 'color: var(--warn); font-weight: bold;' : 'color: var(--bull); font-weight: bold;';
            
            return `
                <tr>
                    <td>
                        <div style="font-weight:700;">${u.email}</div>
                        <div style="font-size:0.65rem; color:var(--muted);">ID: ${u.id.substring(0,8)}... | Ref: ${u.referralCode || '—'}</div>
                    </td>
                    <td>${u.role}</td>
                    <td>
                        <div style="font-size:0.85rem;">${regDate}</div>
                    </td>
                    <td>${lic ? `<span class="badge badge-active">${lic.plan ? lic.plan.name : (lic.type || 'Standard')}</span>` : '<span style="color:var(--muted)">Sem licença</span>'}</td>
                    <td>
                        <div style="${balanceStyle}">$${balance.toFixed(2)}</div>
                        <div style="font-size:0.65rem; color:var(--muted);">Taxa: ${feeStr}</div>
                    </td>
                    <td>${lic ? new Date(lic.expiresAt).toLocaleDateString() : '—'}</td>
                    <td style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button class="btn" style="background:var(--accent);color:#000;border:none;font-size:0.75rem;padding:5px 10px;font-weight:700;" onclick="openWalletModal('${u.id}', '${u.email}', ${balance}, ${customFee !== null && customFee !== undefined ? customFee : 'null'})">💳 PAMM</button>
                        <button class="btn" style="background:var(--accent2);color:#fff;border:none;font-size:0.75rem;padding:5px 10px;" onclick="openResetPwModal('${u.id}', '${u.email}')">🔑 Reset PW</button>
                        <button class="btn" style="background:var(--bear);color:#fff;border:none;font-size:0.75rem;padding:5px 10px;" onclick="deleteUser('${u.id}', '${u.email}')">🗑️ Eliminar</button>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="7" style="text-align:center;">Nenhum usuário encontrado.</td></tr>';
    }

    // Período padrão para usuários
    document.getElementById('userReportPeriod').value = new Date().toISOString().substring(0, 7);

    async function generateUsersReport() {
        if (!allUsers || allUsers.length === 0) return alert("Nenhum usuário carregado.");
        
        const period = document.getElementById('userReportPeriod').value;
        if (!period) return alert("Selecione um período (Mês/Ano)");
        const [year, month] = period.split("-");

        const btn = document.querySelector('[onclick="generateUsersReport()"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = "Gerando...";
        btn.disabled = true;

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Filtrar usuários pelo período selecionado (Expert logic)
            const filteredUsers = allUsers.filter(u => {
                const d = new Date(u.createdAt);
                return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
            });

            // Header do PDF [EXPERT]
            doc.setFillColor(6, 8, 16);
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(0, 212, 255);
            doc.setFontSize(22);
            doc.text("AURAFOREX", 105, 20, { align: "center" });
            doc.setFontSize(10);
            doc.setTextColor(255, 255, 255);
            doc.text(`CRESCIMENTO DE REDE - ${month}/${year}`, 105, 30, { align: "center" });

            // Resumo de Registros
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.text(`Novos Registros no Período: ${filteredUsers.length}`, 14, 50);

            const tableData = filteredUsers.map(u => {
                const lic = u.licenses?.[0];
                return [
                    u.email,
                    u.referralCode || '—',
                    lic ? (lic.plan ? lic.plan.name : lic.type) : 'Sem Licença',
                    new Date(u.createdAt).toLocaleDateString()
                ];
            });

            doc.autoTable({
                startY: 55,
                head: [['Email', 'Ref', 'Licença Atual', 'Data Registro']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillStyle: [0, 212, 255] },
                styles: { fontSize: 8 }
            });

            // Rodapé
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Gerado em: ${new Date().toLocaleString()} | Total de registros no mês: ${filteredUsers.length}`, 14, doc.internal.pageSize.height - 10);

            doc.save(`AuraForex_Novos_Usuarios_${period}.pdf`);
            alert(`✅ Relatório gerado! ${filteredUsers.length} novos usuários no período.`);
        } catch (e) {
            alert("❌ Erro: " + e.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    function openResetPwModal(userId, email) {
        const pw = prompt(`Definir nova password para:\n${email}\n\n(mín. 6 caracteres)`);
        if (!pw) return;
        if (pw.length < 6) { alert('A password deve ter pelo menos 6 caracteres.'); return; }
        api(`/api/admin/users/${userId}/reset-password`, 'POST', { newPassword: pw })
            .then(r => { if(r.success) alert('✅ Password redefinida com sucesso!'); else alert('❌ ' + r.error); })
            .catch(() => alert('Erro de ligação.'));
    }

    async function deleteUser(userId, email) {
        if (!confirm(`⚠️ Tem a certeza que deseja ELIMINAR a conta de:\n${email}\n\nEsta ação é IRREVERSíVEL!`)) return;
        const r = await api(`/api/admin/users/${userId}`, 'DELETE');
        if (r.success) { alert('✅ Conta eliminada.'); loadUsers(); }
        else alert('❌ ' + r.error);
    }

    let currentRequestId = null;
    function openApproveModal(id, email, type) {
        currentRequestId = id;
        document.getElementById('approveText').textContent = `Aprovar plano ${type} para ${email}`;
        document.getElementById('confirmApproveBtn').onclick = confirmApprove;
        document.getElementById('approveModal').classList.add('active');
    }

    async function confirmApprove() {
        const res = await api(`/api/admin/requests/${currentRequestId}/approve`, "POST", { });
        if (res.success) {
            closeModal('approveModal');
            loadRequests();
            loadStats();
        } else alert(res.error);
    }

    function closeModal(id) { document.getElementById(id).classList.remove('active'); }

    async function addPaymentMethod() {
        const name = document.getElementById('pmName').value;
        const details = document.getElementById('pmDetails').value;
        const res = await api("/api/admin/payment-methods", "POST", { name, details });
        if (res.success) {
            alert("Método adicionado!");
            loadPaymentMethods();
            document.getElementById('pmName').value = '';
            document.getElementById('pmDetails').value = '';
        }
    }

    async function loadSystemSettings() {
        const res = await api("/api/admin/settings");
        if (res.success && res.settings) {
            const s = res.settings;
            document.getElementById('sysGeminiKey').value = s.geminiApiKey || '';
            document.getElementById('sysGeminiUrl').value = s.geminiApiUrl || '';
            document.getElementById('sysMetaToken').value = s.metaApiToken || '';
            document.getElementById('sysMetaAccountId').value = s.metaApiAccountId || '';
            document.getElementById('sysApiUrl').value = s.apiUrl || '';
            document.getElementById('sysDefaultPammFee').value = s.defaultPammPerformanceFee !== undefined ? s.defaultPammPerformanceFee : 30;
            document.getElementById('sysInstallGuide').value = s.installationGuide || '';
            // Social
            document.getElementById('sysTelegram').value = s.telegramUrl || '';
            document.getElementById('sysWhatsapp').value = s.whatsappNumber || '';
            document.getElementById('sysYoutube').value = s.youtubeUrl || '';
            document.getElementById('sysFacebook').value = s.facebookUrl || '';
            document.getElementById('sysInstagram').value = s.instagramUrl || '';
            // Crypto Bot
            document.getElementById('sysCryptoEnabled').checked = s.cryptoBotEnabled !== false;
            document.getElementById('sysCryptoUrl').value = s.cryptoBotUrl || '';
        }
    }

    async function saveSystemSettings() {
        const payload = {
            geminiApiKey: document.getElementById('sysGeminiKey').value,
            geminiApiUrl: document.getElementById('sysGeminiUrl').value,
            metaApiToken: document.getElementById('sysMetaToken').value,
            metaApiAccountId: document.getElementById('sysMetaAccountId').value,
            apiUrl: document.getElementById('sysApiUrl').value,
            defaultPammPerformanceFee: document.getElementById('sysDefaultPammFee').value ? parseFloat(document.getElementById('sysDefaultPammFee').value) : 30.0,
            installationGuide: document.getElementById('sysInstallGuide').value,
            telegramUrl: document.getElementById('sysTelegram').value,
            whatsappNumber: document.getElementById('sysWhatsapp').value,
            youtubeUrl: document.getElementById('sysYoutube').value,
            facebookUrl: document.getElementById('sysFacebook').value,
            instagramUrl: document.getElementById('sysInstagram').value,
            cryptoBotEnabled: document.getElementById('sysCryptoEnabled').checked,
            cryptoBotUrl: document.getElementById('sysCryptoUrl').value
        };
        const res = await api("/api/admin/settings", "POST", payload);
        if (res.success) {
            alert("✅ Parâmetros do sistema guardados com sucesso!");
        } else {
            alert("❌ Erro ao guardar: " + res.error);
        }
    }

    async function loadPaymentMethods() {
        const data = await api("/api/payment-methods"); // Using user endpoint is fine or create admin one
        const tbody = document.getElementById('pmsTable');
        tbody.innerHTML = data.methods.map(m => `
            <tr>
                <td><strong>${m.name}</strong></td>
                <td style="font-family:'Space Mono';font-size:0.75rem;">${m.details}</td>
                <td><span class="badge ${m.isActive ? 'badge-active' : ''}">${m.isActive ? 'Ativo' : 'Inativo'}</span></td>
                <td style="display:flex; gap:8px;">
                    <button class="btn" onclick="editPaymentMethod('${m.id}', '${m.name}', '${m.details}', ${m.isActive})">✏️</button>
                    <button class="btn" style="color:var(--bear)" onclick="deletePaymentMethod('${m.id}')">🗑️</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="4" style="text-align:center;">Nenhum método configurado.</td></tr>';
    }

    async function editPaymentMethod(id, name, details, isActive) {
        const newName = prompt("Nome do Método:", name);
        const newDetails = prompt("Detalhes/Carteira:", details);
        if (newName === null || newDetails === null) return;
        
        const res = await api(`/api/admin/payment-methods/${id}`, "PUT", { 
            name: newName, 
            details: newDetails,
            isActive: true 
        });
        if (res.success) loadPaymentMethods();
        else alert(res.error);
    }

    async function deletePaymentMethod(id) {
        if (!confirm("Tem certeza que deseja excluir este método de pagamento?")) return;
        const res = await api(`/api/admin/payment-methods/${id}`, "DELETE");
        if (res.success) loadPaymentMethods();
        else alert(res.error);
    }

    async function loadFinance() {
        const fRes = await api("/api/admin/finance");
        if(fRes.success) {
            document.getElementById("finRevenue").textContent = "$" + fRes.finance.totalRevenue.toFixed(2);
            document.getElementById("finPaid").textContent = "$" + fRes.finance.totalPaid.toFixed(2);
            document.getElementById("finBalance").textContent = "$" + fRes.finance.balance.toFixed(2);
        }
        
        const wRes = await api("/api/admin/withdrawals");
        if(wRes.success) {
            const tbody = document.getElementById("withdrawalsTable");
            tbody.innerHTML = wRes.withdrawals.map(w => `
                <tr>
                    <td>${w.user.email}</td>
                    <td>${new Date(w.createdAt).toLocaleDateString()}</td>
                    <td style="font-weight:bold; color:var(--accent);">$${w.amount.toFixed(2)}</td>
                    <td style="font-family:'Space Mono'; font-size:0.75rem;">${w.network}<br>${w.walletAddress}</td>
                    <td style="display:flex; gap:8px;">
                        <button class="btn btn-success" onclick="approveWithdraw('${w.id}')">Aprovar</button>
                        <button class="btn" style="background:var(--bear);color:#fff;border:none;" onclick="rejectWithdraw('${w.id}')">Rejeitar</button>
                    </td>
                </tr>
            `).join("") || '<tr><td colspan="5" style="text-align:center; color:var(--muted);">Nenhum pedido de saque pendente.</td></tr>';
        }
        
        const pammTxRes = await api("/api/admin/wallet/transactions");
        if (pammTxRes.success) {
            const tbody = document.getElementById("pammTransactionsTable");
            tbody.innerHTML = pammTxRes.transactions.map(t => {
                const typeBadge = t.type === 'DEPOSIT' ? '<span class="badge badge-active">DEPOSIT</span>' : '<span class="badge badge-pending" style="background:rgba(255,68,68,0.2); color:var(--bear);">DEDUCTION</span>';
                const amtColor = t.type === 'DEPOSIT' ? 'var(--bull)' : 'var(--bear)';
                const sign = t.type === 'DEPOSIT' ? '+' : '-';
                return `
                    <tr>
                        <td>${t.user?.email || 'N/A'}</td>
                        <td>${new Date(t.createdAt).toLocaleString()}</td>
                        <td>${typeBadge}</td>
                        <td style="font-weight:bold; color:${amtColor};">${sign}$${t.amount.toFixed(2)}</td>
                        <td style="color:var(--muted);">${t.description || '—'}</td>
                    </tr>
                `;
            }).join("") || '<tr><td colspan="5" style="text-align:center; color:var(--muted);">Nenhuma transação PAMM registrada.</td></tr>';
        }
    }
    
    async function approveWithdraw(id) {
        if(!confirm("Aprovar saque? Certifique-se de que o pagamento já foi enviado para a carteira do usuário.")) return;
        const res = await api("/api/admin/withdrawals/" + id + "/approve", "POST");
        if(res.success) {
            alert("Saque aprovado com sucesso!");
            loadFinance();
        } else alert(res.error);
    }
    
    async function rejectWithdraw(id) {
        if(!confirm("Rejeitar saque? O valor será devolvido ao saldo disponível do usuário.")) return;
        const res = await api("/api/admin/withdrawals/" + id + "/reject", "POST");
        if(res.success) {
            alert("Saque rejeitado com sucesso!");
            loadFinance();
        } else alert(res.error);
    }

    // Inicializar período padrão (mês atual)
    document.getElementById('reportPeriod').value = new Date().toISOString().substring(0, 7);

    async function generateFinancialReport() {
        const period = document.getElementById('reportPeriod').value; // YYYY-MM
        if (!period) return alert("Selecione um período (Mês/Ano)");

        const [year, month] = period.split("-");
        
        const btn = document.querySelector('[onclick="generateFinancialReport()"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = "Gerando...";
        btn.disabled = true;

        try {
            const data = await api(`/api/admin/finance/report?year=${year}&month=${month}`);
            if (!data.success) throw new Error(data.error);

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Header do PDF [EXPERT]
            doc.setFillColor(6, 8, 16);
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(0, 212, 255);
            doc.setFontSize(22);
            doc.text("AURAFOREX", 105, 20, { align: "center" });
            doc.setFontSize(10);
            doc.setTextColor(255, 255, 255);
            doc.text(`RELATÓRIO FINANCEIRO - ${month}/${year}`, 105, 30, { align: "center" });

            // Resumo
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(14);
            doc.text("Resumo do Período", 14, 55);
            
            const summaryData = [
                ["Receita de Licenças", `$${data.revenue.toFixed(2)}`],
                ["Saques Pagos", `$${data.withdrawals.toFixed(2)}`],
                ["Bónus de Indicação", `$${data.bonuses.toFixed(2)}`],
                ["Balanço Líquido", `$${data.balance.toFixed(2)}`]
            ];

            doc.autoTable({
                startY: 60,
                head: [['Descrição', 'Valor (USD)']],
                body: summaryData,
                theme: 'striped',
                headStyles: { fillStyle: [0, 212, 255] }
            });

            // Rodapé
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, doc.internal.pageSize.height - 10);

            doc.save(`AuraForex_Relatorio_${period}.pdf`);
            alert("✅ Relatório gerado com sucesso!");
        } catch (e) {
            alert("❌ Erro: " + e.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    let currentWalletUserId = null;
    function openWalletModal(userId, email, balance, customFee) {
        currentWalletUserId = userId;
        document.getElementById('walletModalTitle').textContent = 'Gestão PAMM & Carteira';
        document.getElementById('walletUserEmail').textContent = email;
        document.getElementById('walletCurrentBalance').textContent = `$${balance.toFixed(2)}`;
        document.getElementById('walletCurrentFee').textContent = customFee !== null ? `${customFee}%` : 'Global';
        
        document.getElementById('walletAmount').value = '';
        document.getElementById('walletDescription').value = '';
        document.getElementById('walletCustomFee').value = customFee !== null ? customFee : '';
        
        document.getElementById('walletModal').classList.add('active');
    }

    document.getElementById('saveWalletBtn').onclick = async () => {
        if (!currentWalletUserId) return;
        
        const amountVal = document.getElementById('walletAmount').value;
        const descriptionVal = document.getElementById('walletDescription').value;
        const customFeeVal = document.getElementById('walletCustomFee').value;
        
        let hasChanges = false;
        
        // 1. Process balance change if provided
        if (amountVal !== '') {
            const amt = parseFloat(amountVal);
            if (amt !== 0) {
                const res = await api('/api/admin/wallet/credit-user', 'POST', {
                    userId: currentWalletUserId,
                    amount: amt,
                    description: descriptionVal
                });
                if (!res.success) {
                    alert('Erro ao atualizar saldo: ' + res.error);
                    return;
                }
                hasChanges = true;
            }
        }
        
        // 2. Process custom performance fee change
        const resFee = await api(`/api/admin/user/${currentWalletUserId}/pamm-settings`, 'POST', {
            pammPerformanceFeePct: customFeeVal !== '' ? parseFloat(customFeeVal) : ''
        });
        if (!resFee.success) {
            alert('Erro ao atualizar taxa PAMM: ' + resFee.error);
            return;
        }
        hasChanges = true;
        
        if (hasChanges) {
            alert('Alterações salvas com sucesso!');
            closeModal('walletModal');
            loadUsers();
        }
    };

    loadStats();
    loadSystemSettings();
    loadPaymentMethods();
    loadFinance();
