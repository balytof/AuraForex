const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../public/AuraForex_V8_INSTITUTIONAL.mq5');
let content = '';
try {
    const buf = fs.readFileSync(filePath);
    if (buf[0] === 0xff && buf[1] === 0xfe) {
        content = buf.toString('utf16le');
        console.log("Detected UTF-16 LE encoding");
    } else {
        content = buf.toString('utf8');
        console.log("Detected UTF-8 encoding");
    }
} catch (e) {
    console.error("Error reading file:", e.message);
}

console.log("=== SEARCHING MQ5 FOR RESET/LOCK PATTERNS ===");
const lines = content.split('\n');
lines.forEach((line, index) => {
    const l = line.toLowerCase();
    if (l.includes('day') || l.includes('timecurrent') || l.includes('24') || l.includes('86400') || l.includes('3600')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
