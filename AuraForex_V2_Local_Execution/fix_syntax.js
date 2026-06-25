const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// The block ends around line 575
//     } else if (isProfitLocked && dailyTargetMoney > 0 && netEvolution < dailyTargetMoney) {
//       // CORREÇÃO DE BUG...
//       isProfitLocked = false;
//       risk.dailyProfitLocked = false;
//     }
// 
//     // Removida a busca cega...
code = code.replace(/risk\.dailyProfitLocked = false;\n    }\n\n    \/\/ Removida a busca cega/, `risk.dailyProfitLocked = false;\n    }\n    }\n\n    // Removida a busca cega`);

fs.writeFileSync('server.js', code);
console.log("Fixed server.js syntax error");
