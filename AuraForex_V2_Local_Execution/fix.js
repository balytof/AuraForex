const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const target = `    } else if (isProfitLocked && dailyTargetMoney > 0 && netEvolution < dailyTargetMoney) {
      // 🛡️ CORREÇÃO DE BUG: Se a evolução caiu abaixo da meta (ex: correção de ghost equity), destrava o bot.
      isProfitLocked = false;
      risk.dailyProfitLocked = false;
    }`;

const replacement = `    } else if (isProfitLocked && dailyTargetMoney > 0 && netEvolution < dailyTargetMoney) {
      // 🛡️ CORREÇÃO DE BUG: Se a evolução caiu abaixo da meta (ex: correção de ghost equity), destrava o bot.
      isProfitLocked = false;
      risk.dailyProfitLocked = false;
    }
    } // close else block`;

code = code.replace(target, replacement);

fs.writeFileSync('server.js', code);
console.log("Fixed syntax!");
