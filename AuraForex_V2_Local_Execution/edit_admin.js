const fs = require('fs');
let content = fs.readFileSync('admin_dashboard.html', 'utf8');
content = content.replace(
    '<button class="btn" onclick="openPlanModal(\'${p.id}\', \'${p.name}\', ${p.price}, ${p.durationDays})">✏️</button>',
    `<button class="btn" style="color: \${p.isActive ? 'var(--warn)' : 'var(--success)'}" onclick="togglePlan('\${p.id}', \${p.isActive})">\${p.isActive ? 'Desativar' : 'Ativar'}</button>\n                    <button class="btn" onclick="openPlanModal('\${p.id}', '\${p.name}', \${p.price}, \${p.durationDays})">✏️</button>`
);
content = content.replace(
    'async function deletePlan(id) {',
    `async function togglePlan(id, isActive) {\n        if (!confirm(\`Tem certeza que deseja \${isActive ? 'desativar' : 'ativar'} este plano?\`)) return;\n        const res = await api(\`/api/admin/plans/\${id}\`, "PUT", { isActive: !isActive });\n        if (res.success) loadPlans();\n        else alert(res.error);\n    }\n\n    async function deletePlan(id) {`
);
fs.writeFileSync('admin_dashboard.html', content);
