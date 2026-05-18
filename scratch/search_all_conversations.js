const fs = require('fs');
const path = require('path');

const brainDir = "C:\\Users\\Lenovo\\.gemini\\antigravity\\brain";
console.log("=== SEARCHING ALL CONVERSATION LOGS ===");

if (!fs.existsSync(brainDir)) {
    console.error("Brain directory not found.");
    process.exit(1);
}

const folders = fs.readdirSync(brainDir);
folders.forEach(folder => {
    const folderPath = path.join(brainDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) return;
    
    // Check for overview.txt in .system_generated/logs/
    const overviewPath = path.join(folderPath, '.system_generated', 'logs', 'overview.txt');
    if (fs.existsSync(overviewPath)) {
        const content = fs.readFileSync(overviewPath, 'utf8');
        const lines = content.split('\n');
        
        let found = false;
        lines.forEach((line, idx) => {
            const l = line.toLowerCase();
            if (l.includes('pamm') || l.includes('mam') || l.includes('mobile') || l.includes('opção 2') || l.includes('opcao 2')) {
                if (!found) {
                    console.log(`\n📂 Found in Conversation: ${folder}`);
                    found = true;
                }
                console.log(`  Line ${idx+1}: ${line.trim()}`);
            }
        });
    }
});
