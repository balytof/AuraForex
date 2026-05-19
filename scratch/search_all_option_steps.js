const fs = require('fs');
const path = require('path');

const logFile = "C:\\Users\\Lenovo\\.gemini\\antigravity\\brain\\ca43b4fc-60f8-4e86-85c5-c306f533fcba\\.system_generated\\logs\\overview.txt";

if (!fs.existsSync(logFile)) {
    console.error("Log file not found.");
    process.exit(1);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING STEPS FROM ca43b4fc ===");

lines.forEach(line => {
    if (!line.trim()) return;
    try {
        const obj = JSON.parse(line);
        const step = obj.step_index;
        if (step >= 340) {
            const body = obj.content || "";
            const matches = body.toLowerCase().includes("opcao") || 
                            body.toLowerCase().includes("opção") || 
                            body.toLowerCase().includes("investidor") || 
                            body.toLowerCase().includes("investor") || 
                            body.toLowerCase().includes("pamm") || 
                            body.toLowerCase().includes("mam");
            
            if (matches) {
                console.log(`\n==========================================`);
                console.log(`=== STEP: ${step} (${obj.source}) ===`);
                console.log(`==========================================`);
                console.log(body);
            }
        }
    } catch (e) {
        // Ignored
    }
});
