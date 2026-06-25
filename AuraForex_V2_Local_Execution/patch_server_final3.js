const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// 1. Add global cache-control middleware
code = code.replace(/app\.use\(express\.json\(\)\);/, "app.use(express.json());\napp.use((req, res, next) => { res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private'); next(); });");

// 2. Fix the zero target bug and restore manualUnlockDate
code = code.replace(/    let isProfitLocked = risk\.dailyProfitLocked;\r?\n    if \(!isProfitLocked && dailyTargetMoney > 0 && netEvolution >= dailyTargetMoney\) \{/g, 
`    let isProfitLocked = risk.dailyProfitLocked;
    const todayStr = new Date().toISOString().split('T')[0];
    if (risk.manualUnlockDate === todayStr) {
      isProfitLocked = false;
      risk.dailyProfitLocked = false;
      risk.circuitBreaker = false;
    } else if (!isProfitLocked && dailyTargetMoney > 0 && netEvolution >= dailyTargetMoney) {`);

code = code.replace(/} else if \(isProfitLocked && dailyTargetMoney > 0 && netEvolution < dailyTargetMoney\) \{/g, '} else if (isProfitLocked && (dailyTargetMoney === 0 || netEvolution < dailyTargetMoney)) {');

fs.writeFileSync('server.js', code);
console.log('Server patched successfully with manualUnlockDate');
