const fs = require('fs');
const path = require('path');

const brainDir = "C:\\Users\\Lenovo\\.gemini\\antigravity\\brain";
console.log("=== SCANNING ALL BRAIN ARTIFACTS ===");

if (!fs.existsSync(brainDir)) {
    console.error("Brain directory not found.");
    process.exit(1);
}

function scanDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(f => {
        const p = path.join(dir, f);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
            if (f !== '.system_generated') {
                scanDir(p);
            }
        } else if (f.endsWith('.md') || f.endsWith('.json')) {
            const content = fs.readFileSync(p, 'utf8');
            if (content.toLowerCase().includes('pamm') || content.toLowerCase().includes('mam') || content.toLowerCase().includes('senha de investidor') || content.toLowerCase().includes('investor password')) {
                console.log(`\n📄 Found in: ${p}`);
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                    const l = line.toLowerCase();
                    if (l.includes('pamm') || l.includes('mam') || l.includes('investor') || l.includes('investidor') || l.includes('opção') || l.includes('opcao')) {
                        console.log(`  Line ${idx+1}: ${line.trim().substring(0, 150)}`);
                    }
                });
            }
        }
    });
}

scanDir(brainDir);
