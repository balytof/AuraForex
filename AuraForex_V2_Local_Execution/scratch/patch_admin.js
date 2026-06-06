const fs = require('fs');

let html = fs.readFileSync('../admin_dashboard.html', 'utf8');

// Update Table Headers
html = html.replace(
  '<th>Status</th>',
  '<th>Acesso (Ativo)</th>\n                          <th>Estado (Candidatura)</th>\n                          <th>Ações</th>'
);
html = html.replace(
  '<td colspan="6"',
  '<td colspan="8"'
);

// Update loadProviders JS
const oldLoadProvidersInner = `<td>
                                  <span class="badge \${p.isActive ? 'badge-success' : 'badge-warning'}">\${p.isActive ? 'Ativo' : 'Inativo'}</span>
                                  <button class="btn" style="padding: 2px 5px; font-size: 0.7rem; margin-left: 5px; color: \${p.isActive ? 'var(--bear)' : 'var(--bull)'}" onclick="toggleProvider('\${p.id}', \${p.isActive})">\${p.isActive ? 'Desativar' : 'Ativar'}</button>
                              </td>`;

const newLoadProvidersInner = `<td>
                                  <span class="badge \${p.isActive ? 'badge-success' : 'badge-warning'}">\${p.isActive ? 'Ativo' : 'Inativo'}</span>
                                  <button class="btn" style="padding: 2px 5px; font-size: 0.7rem; margin-left: 5px; color: \${p.isActive ? 'var(--bear)' : 'var(--bull)'}" onclick="toggleProvider('\${p.id}', \${p.isActive})">\${p.isActive ? 'Desativar' : 'Ativar'}</button>
                              </td>
                              <td>
                                  <span class="badge \${p.status === 'APPROVED' ? 'badge-success' : p.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}">\${p.status || 'APPROVED'}</span>
                              </td>
                              <td>
                                  \${p.status === 'PENDING' ? \`
                                      <button class="btn" style="padding: 2px 5px; font-size: 0.7rem; color: var(--bull);" onclick="changeProviderStatus('\${p.id}', 'APPROVED')">Aprovar</button>
                                      <button class="btn" style="padding: 2px 5px; font-size: 0.7rem; color: var(--bear);" onclick="changeProviderStatus('\${p.id}', 'REJECTED')">Rejeitar</button>
                                  \` : ''}
                              </td>`;

html = html.replace(oldLoadProvidersInner, newLoadProvidersInner);

// Add changeProviderStatus function
html = html.replace(
  'async function toggleProvider(id, currentStatus) {',
  `async function changeProviderStatus(id, newStatus) {
          if(!confirm(\`Tem certeza que deseja \${newStatus === 'APPROVED' ? 'APROVAR' : 'REJEITAR'} este provedor?\`)) return;
          try {
              const data = await api(\`/api/admin/providers/\${id}/status\`, "POST", { status: newStatus });
              if (data.success) {
                  alert("Estado atualizado com sucesso.");
                  loadProviders();
              } else {
                  alert(data.error || "Erro ao atualizar.");
              }
          } catch(err) {
              alert("Erro interno.");
          }
      }

      async function toggleProvider(id, currentStatus) {`
);

fs.writeFileSync('../admin_dashboard.html', html);
console.log("Admin Dashboard Patched");
