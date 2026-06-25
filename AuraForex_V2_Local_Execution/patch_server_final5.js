const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// Patch back /api/user/reset-locks
const userResetTarget = `      const licenses = await prisma.license.findMany({ where: { userId: req.user.id } });
      for (const lic of licenses) {
        const risk = getRiskManager(lic.id);
        if (risk) {
          risk.circuitBreaker = false;
          risk.dailyProfitLocked = false;
          risk.manualUnlockDate = new Date().toISOString().split('T')[0];
          risk._saveState();
        }
      }
      console.log(\`[USER-RESET-LOCKS] Locks reset by client \${req.user.id}\`);`;

const userResetReplace = `      const license = await prisma.license.findFirst({
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

code = code.replace(userResetTarget, userResetReplace);

// Patch back /api/admin/users/:id/reset-locks
const adminResetTarget = `      const licenses = await prisma.license.findMany({ where: { userId: id } });
      for (const lic of licenses) {
        const risk = getRiskManager(lic.id);
        if (risk) {
          risk.circuitBreaker = false;
          risk.dailyProfitLocked = false;
          risk.manualUnlockDate = new Date().toISOString().split('T')[0];
          risk._saveState();
        }
      }
      console.log(\`[ADMIN-RESET-LOCKS] Locks reset for user \${id}\`);`;

const adminResetReplace = `      const license = await prisma.license.findFirst({
        where: { userId: id },
        orderBy: { expiresAt: 'desc' }
      });
      const risk = getRiskManager(license ? license.id : id);
      if (risk) {
        risk.circuitBreaker = false;
        risk.dailyProfitLocked = false;
        risk.manualUnlockDate = new Date().toISOString().split('T')[0];
        risk._saveState();
        console.log(\`[ADMIN-RESET-LOCKS] Locks reset for user \${id}\`);
      }`;

code = code.replace(adminResetTarget, adminResetReplace);

fs.writeFileSync('server.js', code);
console.log('Successfully reverted reset-locks to use fallback to user.id');
