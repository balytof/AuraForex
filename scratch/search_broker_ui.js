const fs = require('fs');
const content = fs.readFileSync('smc_bot_dashboard.html', 'utf8');
const lines = content.split('\n');

console.log("=== SEARCHING BROKER/MT5 UI ELEMENTS IN DASHBOARD ===");
lines.forEach((line, idx) => {
    if (line.includes('MT5') || line.includes('mt5') || line.includes('Corretora') || line.includes('corretora') || line.includes('Senha') || line.includes('senha') || line.includes('investidor') || line.includes('Investidor')) {
        if (line.includes('<div') || line.includes('<button') || line.includes('<input') || line.includes('<label') || line.includes('<section') || line.includes('function ')) {
            console.log(`Line ${idx+1}: ${line.trim()}`);
        }
    }
});
