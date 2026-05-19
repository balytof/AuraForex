const fs = require('fs');
const path = require('path');

const logFile = "C:\\Users\\Lenovo\\.gemini\\antigravity\\brain\\5c5c5851-0594-4b5c-9d50-8684eba78682\\.system_generated\\logs\\overview.txt";

if (!fs.existsSync(logFile)) {
    console.error("Log file not found at " + logFile);
    process.exit(1);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING LAST CONVERSATION STEPS ===");

lines.forEach(line => {
    if (!line.trim()) return;
    try {
        const obj = JSON.parse(line);
        const step = obj.step_index;
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
    } catch (e) {
        // Ignored
    }
});
