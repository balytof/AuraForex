const fs = require('fs');
const path = require('path');

const query = process.argv[2];
const fileArg = process.argv[3] || 'server.js';

if (!query) {
    console.log("Usage: node scratch/search_code.js <query> [file]");
    process.exit(1);
}

const filePath = path.resolve(__dirname, '..', fileArg);
if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
let matchCount = 0;

console.log(`=== Matches for "${query}" in ${fileArg} ===`);
lines.forEach((line, index) => {
    if (line.toLowerCase().includes(query.toLowerCase())) {
        console.log(`${String(index + 1).padStart(5)}: ${line.trim()}`);
        matchCount++;
    }
});

console.log(`\nFound ${matchCount} matches.`);
