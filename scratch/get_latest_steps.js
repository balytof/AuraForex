const fs = require('fs');
const path = require('path');

const logFile = "C:\\Users\\Lenovo\\.gemini\\antigravity\\brain\\ca43b4fc-60f8-4e86-85c5-c306f533fcba\\.system_generated\\logs\\overview.txt";

if (!fs.existsSync(logFile)) {
    console.error("Log file not found.");
    process.exit(1);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING ALL STEPS >= 350 ===");

lines.forEach(line => {
    if (!line.trim()) return;
    try {
        const obj = JSON.parse(line);
        const step = obj.step_index;
        if (step >= 350) {
            console.log(`\n==========================================`);
            console.log(`=== STEP: ${step} (${obj.source}) ===`);
            console.log(`==========================================`);
            console.log(obj.content || "");
        }
    } catch (e) {
        // Ignored
    }
});
