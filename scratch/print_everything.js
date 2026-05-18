const fs = require('fs');
const path = require('path');

const logFile = "C:\\Users\\Lenovo\\.gemini\\antigravity\\brain\\ca43b4fc-60f8-4e86-85c5-c306f533fcba\\.system_generated\\logs\\overview.txt";
const outFile = path.join(__dirname, '../scratch/steps_out.txt');

if (!fs.existsSync(logFile)) {
    console.error("Log file not found.");
    process.exit(1);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');
let output = '';

lines.forEach(line => {
    if (line.includes('"step_index":358') || line.includes('"step_index":361')) {
        const obj = JSON.parse(line);
        output += `\n==========================================\n`;
        output += `=== STEP INDEX: ${obj.step_index} (${obj.source}) ===\n`;
        output += `==========================================\n`;
        output += obj.content + '\n';
    }
});

fs.writeFileSync(outFile, output, 'utf8');
console.log("Written output to scratch/steps_out.txt");
