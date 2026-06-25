const fs = require('fs');

// Patch risk.js
let riskCode = fs.readFileSync('risk/risk.js', 'utf8');

if (!riskCode.includes('this.manualUnlockDate')) {
    riskCode = riskCode.replace(/this\.dailyDate = null;/g, 'this.dailyDate = null;\n    this.manualUnlockDate = null;');
    riskCode = riskCode.replace(/this\.dailyProfitLocked = false;/g, 'this.dailyProfitLocked = false;\n      this.manualUnlockDate = null;');
    
    // Patch checkDailyProfitTarget
    riskCode = riskCode.replace(/if \(this\.dailyProfitLocked\) return \{ hit: true, alreadyLocked: true \};/, `const todayStr = new Date().toISOString().split('T')[0];
    if (this.manualUnlockDate === todayStr) return { hit: false };
    if (this.dailyProfitLocked) return { hit: true, alreadyLocked: true };`);
    
    // Patch state saving
    riskCode = riskCode.replace(/circuitBreaker: this\.circuitBreaker,/, 'circuitBreaker: this.circuitBreaker,\n        manualUnlockDate: this.manualUnlockDate,');
    riskCode = riskCode.replace(/this\.circuitBreaker = state\.circuitBreaker \|\| false;/, 'this.circuitBreaker = state.circuitBreaker || false;\n        this.manualUnlockDate = state.manualUnlockDate || null;');
    
    fs.writeFileSync('risk/risk.js', riskCode);
    console.log("Patched risk.js");
}

// Patch server.js
let serverCode = fs.readFileSync('server.js', 'utf8');

if (!serverCode.includes('manualUnlockDate = todayStr')) {
    // Modify /api/user/reset-locks
    serverCode = serverCode.replace(/risk\.dailyProfitLocked = false;\s*risk\._saveState\(\);/g, `risk.dailyProfitLocked = false;
        const todayStr = new Date().toISOString().split('T')[0];
        risk.manualUnlockDate = todayStr;
        risk._saveState();`);

    // Modify sync logic
    serverCode = serverCode.replace(/let isProfitLocked = risk\.dailyProfitLocked;/g, `let isProfitLocked = risk.dailyProfitLocked;
    const todayStr = new Date().toISOString().split('T')[0];
    if (risk.manualUnlockDate === todayStr) {
      isProfitLocked = false;
      risk.dailyProfitLocked = false;
      risk.circuitBreaker = false;
    } else {`);

    serverCode = serverCode.replace(/if \(!isProfitLocked && dailyTargetMoney > 0 && netEvolution >= dailyTargetMoney\) \{/g, `if (!isProfitLocked && dailyTargetMoney > 0 && netEvolution >= dailyTargetMoney) {`);
    
    serverCode = serverCode.replace(/isProfitLocked = false;\n\s*risk\.dailyProfitLocked = false;\n\s*\}/g, `isProfitLocked = false;
      risk.dailyProfitLocked = false;
    }
    } // closes the else block for manualUnlockDate`);
    
    fs.writeFileSync('server.js', serverCode);
    console.log("Patched server.js");
}
