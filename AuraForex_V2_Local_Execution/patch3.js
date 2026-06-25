const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// The logic inside server.js:
const searchString = `    let isProfitLocked = risk.dailyProfitLocked;
    if (!isProfitLocked && dailyTargetMoney > 0 && netEvolution >= dailyTargetMoney) {`;

const replaceString = `    let isProfitLocked = risk.dailyProfitLocked;
    const todayStr = new Date().toISOString().split('T')[0];
    if (risk.manualUnlockDate === todayStr) {
      isProfitLocked = false;
      risk.dailyProfitLocked = false;
      risk.circuitBreaker = false;
    } else if (!isProfitLocked && dailyTargetMoney > 0 && netEvolution >= dailyTargetMoney) {`;

code = code.replace(searchString, replaceString);

// Also need to set manualUnlockDate when unlocking via API
const resetSearch1 = `      const risk = getRiskManager(license ? license.id : req.user.id);
      if (risk) {
        risk.circuitBreaker = false;
        risk.dailyProfitLocked = false;
        risk._saveState();`;

const resetReplace1 = `      const risk = getRiskManager(license ? license.id : req.user.id);
      if (risk) {
        risk.circuitBreaker = false;
        risk.dailyProfitLocked = false;
        risk.manualUnlockDate = new Date().toISOString().split('T')[0];
        risk._saveState();`;

code = code.replace(resetSearch1, resetReplace1);

const resetSearch2 = `      const risk = getRiskManager(license ? license.id : id);
      if (risk) {
        risk.circuitBreaker = false;
        risk.dailyProfitLocked = false;
        risk._saveState();`;

const resetReplace2 = `      const risk = getRiskManager(license ? license.id : id);
      if (risk) {
        risk.circuitBreaker = false;
        risk.dailyProfitLocked = false;
        risk.manualUnlockDate = new Date().toISOString().split('T')[0];
        risk._saveState();`;

code = code.replace(resetSearch2, resetReplace2);

fs.writeFileSync('server.js', code);
console.log("Success patched!");
