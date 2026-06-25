const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const target1 = `    const risk = getRiskManager(license ? license.id : req.user.id);
    if (risk) {
      risk.circuitBreaker = false;
      risk.dailyProfitLocked = false;
      risk._saveState();
      console.log(\`[USER-RESET-LOCKS] Locks reset by client \${req.user.id}\`);
    }`;

const replace1 = `    const risk = getRiskManager(license ? license.id : req.user.id);
    if (risk) {
      risk.circuitBreaker = false;
      risk.dailyProfitLocked = false;
      risk.manualUnlockDate = new Date().toISOString().split('T')[0];
      risk._saveState();
      console.log(\`[USER-RESET-LOCKS] Locks reset by client \${req.user.id}\`);
    }`;

code = code.replace(target1, replace1);

const target2 = `    const risk = getRiskManager(license ? license.id : id);
    if (risk) {
      risk.circuitBreaker = false;
      risk.dailyProfitLocked = false;
      risk._saveState();
      console.log(\`[ADMIN-RESET-LOCKS] Locks reset for user \${id}\`);
    }`;

const replace2 = `    const risk = getRiskManager(license ? license.id : id);
    if (risk) {
      risk.circuitBreaker = false;
      risk.dailyProfitLocked = false;
      risk.manualUnlockDate = new Date().toISOString().split('T')[0];
      risk._saveState();
      console.log(\`[ADMIN-RESET-LOCKS] Locks reset for user \${id}\`);
    }`;

code = code.replace(target2, replace2);

fs.writeFileSync('server.js', code);
console.log('Successfully patched server.js with manualUnlockDate');
