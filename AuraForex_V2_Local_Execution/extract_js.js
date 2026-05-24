const fs = require('fs');
const html = fs.readFileSync('smc_bot_dashboard.html', 'utf8');

const regex = /<script.*?>([\s\S]*?)<\/script>/gi;
let match;
let i = 1;

while ((match = regex.exec(html)) !== null) {
    const code = match[1];
    fs.writeFileSync(`script_part_${i}.js`, code);
    console.log(`Extracting script ${i}...`);
    i++;
}
