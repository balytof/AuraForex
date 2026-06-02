const fs = require('fs');
const file = 'public/i18n_dashboard.js';
let content = fs.readFileSync(file, 'utf8');

const correctRegexString = "const regex = new RegExp(`(?<![\\\\p{L}\\\\p{N}])${m.original.replace(/[.*+?^${}()|[\\\\]\\\\\\\\]/g, '\\\\\\\\$&')}(?![\\\\p{L}\\\\p{N}])`, 'gui');";

// We'll just carefully replace the regex line inside the placeholder branch.
// Let's actually find the placeholder branch regex by splitting the file lines.

let lines = content.split('\n');
lines[549] = "                        " + correctRegexString;

fs.writeFileSync(file, lines.join('\n'));
console.log('Regex fixed!');
