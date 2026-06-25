const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// The replacement logic:
const target1 = `    } else if (isProfitLocked && dailyTargetMoney > 0 && netEvolution < dailyTargetMoney) {
      // 🛡️ CORREÇÃO DE BUG: Se a evolução caiu abaixo da meta (ex: correção de ghost equity), destrava o bot.
      isProfitLocked = false;
      risk.dailyProfitLocked = false;
    }`;

const replace1 = `    } else if (isProfitLocked && dailyTargetMoney > 0 && netEvolution < dailyTargetMoney) {
      // 🛡️ CORREÇÃO DE BUG: Se a evolução caiu abaixo da meta (ex: correção de ghost equity), destrava o bot.
      isProfitLocked = false;
      risk.dailyProfitLocked = false;
    }
    } // closes the manualUnlockDate else block`;

// I also need to make sure I add the if (manualUnlockDate === todayStr) part:
const target2 = `    let isProfitLocked = risk.dailyProfitLocked;
    if (!isProfitLocked && dailyTargetMoney > 0 && netEvolution >= dailyTargetMoney) {`;

const replace2 = `    let isProfitLocked = risk.dailyProfitLocked;
    const todayStr = new Date().toISOString().split('T')[0];
    if (risk.manualUnlockDate === todayStr) {
      isProfitLocked = false;
      risk.dailyProfitLocked = false;
      risk.circuitBreaker = false;
    } else {
    if (!isProfitLocked && dailyTargetMoney > 0 && netEvolution >= dailyTargetMoney) {`;

code = code.replace(target2, replace2);
code = code.replace(target1, replace1);

// We also need to add manualUnlockDate setting in reset-locks
const target3 = `      const risk = getRiskManager(license ? license.id : req.user.id);
      if (risk) {
        risk.circuitBreaker = false;
        risk.dailyProfitLocked = false;
        risk._saveState();`;

const replace3 = `      const risk = getRiskManager(license ? license.id : req.user.id);
      if (risk) {
        risk.circuitBreaker = false;
        risk.dailyProfitLocked = false;
        const todayStr = new Date().toISOString().split('T')[0];
        risk.manualUnlockDate = todayStr;
        risk._saveState();`;

code = code.replace(target3, replace3);

const target4 = `      const risk = getRiskManager(license ? license.id : id);
      if (risk) {
        risk.circuitBreaker = false;
        risk.dailyProfitLocked = false;
        risk._saveState();`;

const replace4 = `      const risk = getRiskManager(license ? license.id : id);
      if (risk) {
        risk.circuitBreaker = false;
        risk.dailyProfitLocked = false;
        const todayStr = new Date().toISOString().split('T')[0];
        risk.manualUnlockDate = todayStr;
        risk._saveState();`;

code = code.replace(target4, replace4);

fs.writeFileSync('server.js', code);
console.log("Patched server.js properly");
