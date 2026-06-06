const fs = require('fs');

let serverCode = fs.readFileSync('../server.js', 'utf8');

// Update POST /api/admin/plans
serverCode = serverCode.replace(
  'const { name, price, durationDays } = req.body;',
  'const { name, price, durationDays, lemonSqueezyUrl } = req.body;'
);
serverCode = serverCode.replace(
  'data: { name, price: parseFloat(price), durationDays: parseInt(durationDays) }',
  'data: { name, price: parseFloat(price), durationDays: parseInt(durationDays), lemonSqueezyUrl }'
);

// Update PUT /api/admin/plans/:id
serverCode = serverCode.replace(
  'const { name, price, durationDays, isActive } = req.body;',
  'const { name, price, durationDays, isActive, lemonSqueezyUrl } = req.body;'
);
serverCode = serverCode.replace(
  'if (isActive !== undefined) dataToUpdate.isActive = isActive;',
  'if (isActive !== undefined) dataToUpdate.isActive = isActive;\n      if (lemonSqueezyUrl !== undefined) dataToUpdate.lemonSqueezyUrl = lemonSqueezyUrl;'
);

fs.writeFileSync('../server.js', serverCode);
console.log("Server patched.");

let html = fs.readFileSync('../admin_dashboard.html', 'utf8');

// Add the HTML input
html = html.replace(
  '<div class="form-group">\n              <label class="form-label">Validade (em dias)</label>\n              <input type="number" id="planDays" class="form-input">\n          </div>',
  '<div class="form-group">\n              <label class="form-label">Validade (em dias)</label>\n              <input type="number" id="planDays" class="form-input">\n          </div>\n          <div class="form-group">\n              <label class="form-label">LemonSqueezy Checkout URL (Opcional)</label>\n              <input type="url" id="planLemonSqueezyUrl" class="form-input" placeholder="https://store.lemonsqueezy.com/checkout/...">\n          </div>'
);

// Update openPlanModal signature
html = html.replace(
  'function openPlanModal(id = null, name = \'\', price = \'\', days = \'\') {',
  'function openPlanModal(id = null, name = \'\', price = \'\', days = \'\', lsUrl = \'\') {'
);

html = html.replace(
  'document.getElementById(\'planDays\').value = days;',
  'document.getElementById(\'planDays\').value = days;\n          document.getElementById(\'planLemonSqueezyUrl\').value = lsUrl || \'\';'
);

// Update savePlan payload
html = html.replace(
  'durationDays: document.getElementById(\'planDays\').value',
  'durationDays: document.getElementById(\'planDays\').value,\n              lemonSqueezyUrl: document.getElementById(\'planLemonSqueezyUrl\').value'
);

// Update loadPlans call to openPlanModal
html = html.replace(
  'onclick="openPlanModal(\'${p.id}\', \'${p.name}\', ${p.price}, ${p.durationDays})"',
  'onclick="openPlanModal(\'${p.id}\', \'${p.name}\', ${p.price}, ${p.durationDays}, \'${p.lemonSqueezyUrl || \'\'}\')"'
);

fs.writeFileSync('../admin_dashboard.html', html);
console.log("Admin Dashboard HTML patched.");
