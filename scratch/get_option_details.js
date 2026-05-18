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
        console.log(`\n=== STEP INDEX: ${obj.step_index} (${obj.source}) ===`);
        console.log(obj.content);
    }
});
