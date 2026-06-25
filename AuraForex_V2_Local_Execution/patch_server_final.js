const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const targetStr = `    let isProfitLocked = risk.dailyProfitLocked;\r\n    if (!isProfitLocked && dailyTargetMoney > 0 && netEvolution >= dailyTargetMoney) {`;
const targetStr2 = `    let isProfitLocked = risk.dailyProfitLocked;\n    if (!isProfitLocked && dailyTargetMoney > 0 && netEvolution >= dailyTargetMoney) {`;

const replaceStr = `    let isProfitLocked = risk.dailyProfitLocked;\n    const todayStr = new Date().toISOString().split('T')[0];\n    if (risk.manualUnlockDate === todayStr) {\n      isProfitLocked = false;\n      risk.dailyProfitLocked = false;\n      risk.circuitBreaker = false;\n    } else if (!isProfitLocked && dailyTargetMoney > 0 && netEvolution >= dailyTargetMoney) {`;

code = code.replace(targetStr, replaceStr);
code = code.replace(targetStr2, replaceStr);

fs.writeFileSync('server.js', code);
console.log(code.includes('manualUnlockDate === todayStr') ? 'Success' : 'Fail');
