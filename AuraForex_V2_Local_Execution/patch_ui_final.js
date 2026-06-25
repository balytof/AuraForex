const fs = require('fs');
let code = fs.readFileSync('smc_bot_dashboard.html', 'utf8');

// Replace accent with bull
code = code.replace(/color: var\(--accent\); border: 2px solid var\(--accent\);/g, 'color: var(--bull); border: 2px solid var(--bull);');

// Replace status endpoint call
const t = `const status = await apiFetch("/api/user/status");`;
const r = `const status = await apiFetch("/api/user/status?t=" + new Date().getTime());`;
code = code.replace(t, r);

fs.writeFileSync('smc_bot_dashboard.html', code);
console.log('UI Patched successfully');
