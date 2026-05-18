const fs = require('fs');
const content = fs.readFileSync('smc_bot_dashboard.html', 'utf8');
const lines = content.split('\n');

console.log("=== SEARCHING MODALS AND FORMS IN DASHBOARD ===");
lines.forEach((line, idx) => {
    if (line.includes('class="modal"') || line.includes('class="modal') || line.includes('id="modal') || (line.includes('id=') && (line.includes('modal') || line.includes('Modal') || line.includes('config') || line.includes('settings')))) {
        console.log(`Line ${idx+1}: ${line.trim()}`);
    }
});
