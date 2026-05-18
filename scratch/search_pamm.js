const fs = require('fs');
const path = require('path');

const brainDir = "C:\\Users\\Lenovo\\.gemini\\antigravity\\brain";
console.log("=== SEARCHING PAMM/MAM ===");

if (!fs.existsSync(brainDir)) {
    console.error("Brain directory not found.");
    process.exit(1);
}

const folders = fs.readdirSync(brainDir);
folders.forEach(folder => {
    const folderPath = path.join(brainDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) return;
    
    const overviewPath = path.join(folderPath, '.system_generated', 'logs', 'overview.txt');
    if (fs.existsSync(overviewPath)) {
        const content = fs.readFileSync(overviewPath, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, idx) => {
            const l = line.toLowerCase();
            if (l.includes('pamm') || l.includes('mam') || (l.includes('opção 2') && l.includes('sugeriste'))) {
                console.log(`[${folder}] Line ${idx+1}: ${line.trim().substring(0, 300)}`);
            }
        });
    }
});
