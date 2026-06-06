const fs = require('fs');

let html = fs.readFileSync('../public/landing.html', 'utf8');

// extract the translations object string
const match = html.match(/const translations = (\{[\s\S]*?\});/);
if (match) {
    try {
        const objStr = "(" + match[1] + ")";
        const obj = eval(objStr);
        console.log("Translations object parsed successfully. Keys:", Object.keys(obj));
    } catch (e) {
        console.error("Syntax Error in translations object:", e.message);
    }
} else {
    console.error("Could not find translations object.");
}
