const fs = require('fs');
const path = require('path');

console.log("=== SEARCHING FOR 24-HOUR ROLOVER LOGIC IN JS FILES ===");

function searchDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(f => {
        const p = path.join(dir, f);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
            if (f !== 'node_modules' && f !== '.git' && f !== '.gemini') {
                searchDir(p);
            }
        } else if (f.endsWith('.js')) {
            const content = fs.readFileSync(p, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes('24') && (line.includes('hour') || line.includes('lock') || line.includes('time') || line.includes('reset') || line.includes('Date') || line.includes('3600') || line.includes('86400'))) {
                    console.log(`\n📄 Found in: ${p}`);
                    console.log(`  Line ${idx+1}: ${line.trim()}`);
                }
            });
        }
    });
}

searchDir(path.resolve(__dirname, '..'));
