const fs = require('fs');
const path = require('path');

const logFile = "C:\\Users\\Lenovo\\.gemini\\antigravity\\brain\\ca43b4fc-60f8-4e86-85c5-c306f533fcba\\.system_generated\\logs\\overview.txt";

if (!fs.existsSync(logFile)) {
    console.error("Log file not found.");
    process.exit(1);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

lines.forEach(line => {
    if (line.includes('"step_index":358') || line.includes('"step_index":361')) {
        const obj = JSON.parse(line);
        console.log(`\n==========================================`);
        console.log(`=== STEP INDEX: ${obj.step_index} ===`);
        console.log(`==========================================`);
        
        const paragraphs = obj.content.split('\n');
        paragraphs.forEach(p => {
            if (p.includes('Mecanismo') || p.includes('PAMM') || p.includes('Investidor') || p.includes('investidor') || p.includes('Copiador') || p.includes('copiador') || p.includes('Opção')) {
                console.log(p.trim());
                console.log("");
            }
        });
    }
});
