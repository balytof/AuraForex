const fs = require('fs');
let txt = fs.readFileSync('smc_bot_dashboard.html', 'utf8');

if (txt.includes('if (pammRes.success && txRes.success) {')) {
  // Do a manual string replace on that block
  txt = txt.replace('if (pammRes.success && txRes.success) {\n      updatePammUI(pammRes.pammAccount, txRes.walletBalance, pammRes.pammPerformanceFeePct, txRes.transactions);\n    }', 'updatePammUI(\n      pammRes.pammAccount || null,\n      txRes.walletBalance || 0,\n      pammRes.pammPerformanceFeePct || 30,\n      txRes.transactions || []\n    );');
  
  // also add || { success: false } to the fetches
  txt = txt.replace('const pammRes = await apiFetch("/api/user/pamm");', 'const pammRes = await apiFetch("/api/user/pamm") || { success: false };');
  txt = txt.replace('const txRes = await apiFetch("/api/user/wallet/transactions");', 'const txRes = await apiFetch("/api/user/wallet/transactions") || { success: false };');
  
  fs.writeFileSync('smc_bot_dashboard.html', txt, 'utf8');
  console.log('Fixed UI update logic.');
} else {
  console.log('Could not find target');
}
