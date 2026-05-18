const fs = require('fs');
const path = require('path');

const commonPaths = [
    "C:\\Program Files\\MetaTrader 5\\metaeditor64.exe",
    "C:\\Program Files\\MetaTrader 5\\metaeditor.exe",
    "C:\\Program Files (x86)\\MetaTrader 5\\metaeditor64.exe",
    "C:\\Program Files (x86)\\MetaTrader 5\\metaeditor.exe",
    "C:\\Program Files\\MetaTrader\\metaeditor64.exe",
    "C:\\Program Files\\MetaTrader\\metaeditor.exe",
];

console.log("=== SCANNING FOR METAEDITOR ===");
let found = false;
commonPaths.forEach(p => {
    if (fs.existsSync(p)) {
        console.log(`✅ Found MetaEditor at: ${p}`);
        found = true;
    }
});

if (!found) {
    console.log("❌ MetaEditor not found in common default program files paths.");
}
