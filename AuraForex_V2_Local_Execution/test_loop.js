const fs = require('fs');

let content = fs.readFileSync('public/i18n_dashboard.js', 'utf8');
// Extract the English dictionary
let match = content.match(/"en": \{([\s\S]*?)\},\s*"fr":/);
if (match) {
    let dictString = '{' + match[1] + '}';
    // We can evaluate it safely since it's just a JS object literal
    let dict = eval('(' + dictString + ')');
    
    const map = Object.keys(dict).map(k => ({ptLower: k.toLowerCase(), original: k, target: dict[k]}));
    for (let [origKey, target] of Object.entries(dict)) {
        let lowerTarget = target.toLowerCase();
        for (let m of map) {
            if (lowerTarget.includes(m.ptLower) && lowerTarget !== m.ptLower && m.ptLower.length > 3) {
                console.log("Loop hazard:", origKey, "->", target, "which contains pt key:", m.original);
            }
        }
    }
} else {
    console.log("Could not extract dictionary");
}
