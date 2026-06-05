const fs = require('fs');

const content = fs.readFileSync('public/i18n_dashboard.js', 'utf8');
const objMatch = content.match(/const dashboardTranslations = ([\s\S]*?);\n\nfunction/);
const objStr = objMatch[1];
const mapObj = eval('(' + objStr + ')');
const frMap = mapObj['fr'];

for (let key in frMap) {
    try {
        const regexStr = `(?<![\\p{L}\\p{N}])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`;
        new RegExp(regexStr, 'gui');
    } catch (e) {
        console.error("FAILED ON KEY:", key, e.message);
    }
}
console.log("All regexes tested.");
