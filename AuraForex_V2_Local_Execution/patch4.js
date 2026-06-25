const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const t1 = `    const license = await prisma.license.findFirst({
      where: { userId: req.user.id },
      orderBy: { expiresAt: 'desc' }
    });
    const risk = getRiskManager(license ? license.id : req.user.id);
    if (risk) {
      risk.circuitBreaker = false;
      risk.dailyProfitLocked = false;
      risk.manualUnlockDate = new Date().toISOString().split('T')[0];
      risk._saveState();
      console.log(\`[USER-RESET-LOCKS] Locks reset by client \${req.user.id}\`);
    }`;

const r1 = `    const licenses = await prisma.license.findMany({ where: { userId: req.user.id } });
    for (const lic of licenses) {
      const risk = getRiskManager(lic.id);
      if (risk) {
        risk.circuitBreaker = false;
        risk.dailyProfitLocked = false;
        risk.manualUnlockDate = new Date().toISOString().split('T')[0];
        risk._saveState();
      }
    }
    const fallbackRisk = getRiskManager(req.user.id);
    if (fallbackRisk) {
      fallbackRisk.circuitBreaker = false;
      fallbackRisk.dailyProfitLocked = false;
      fallbackRisk.manualUnlockDate = new Date().toISOString().split('T')[0];
      fallbackRisk._saveState();
    }
    console.log(\`[USER-RESET-LOCKS] Locks reset for user \${req.user.id}\`);`;

code = code.replace(t1, r1);

// Also do it for admin endpoint
const t2 = `      const license = await prisma.license.findFirst({
        where: { userId: id },
        orderBy: { expiresAt: 'desc' }
      });
      const risk = getRiskManager(license ? license.id : id);
      if (risk) {
        risk.circuitBreaker = false;
        risk.dailyProfitLocked = false;
        risk.manualUnlockDate = new Date().toISOString().split('T')[0];
        risk._saveState();`;

const r2 = `      const licenses = await prisma.license.findMany({ where: { userId: id } });
      for (const lic of licenses) {
        const risk = getRiskManager(lic.id);
        if (risk) {
          risk.circuitBreaker = false;
          risk.dailyProfitLocked = false;
          risk.manualUnlockDate = new Date().toISOString().split('T')[0];
          risk._saveState();
        }
      }
      const fallbackRisk = getRiskManager(id);
      if (fallbackRisk) {
        fallbackRisk.circuitBreaker = false;
        fallbackRisk.dailyProfitLocked = false;
        fallbackRisk.manualUnlockDate = new Date().toISOString().split('T')[0];
        fallbackRisk._saveState();`;

code = code.replace(t2, r2);

// And we must also fix GET /api/user/status so it uses the SAME logic to read the manualUnlockDate
// Wait, GET /api/user/status fetches a specific license:
// const risk = getRiskManager(license ? license.id : req.user.id);
// So it will read the correct one if we unlocked ALL of them!

fs.writeFileSync('server.js', code);
console.log('Success reset locks to all licenses');
