const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../admin_dashboard.html');
const content = fs.readFileSync(filePath, 'utf8');

const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/i);
if (!scriptMatch) {
    console.log('No script block found!');
    process.exit(1);
}

const jsCode = scriptMatch[1];
fs.writeFileSync(path.resolve(__dirname, 'admin_script_temp.js'), jsCode);

try {
    const { execSync } = require('child_process');
    execSync('node --check ' + path.resolve(__dirname, 'admin_script_temp.js'));
    console.log('✅ JavaScript syntax is PERFECT!');
} catch (err) {
    console.error('❌ JavaScript syntax error:', err.message);
}
