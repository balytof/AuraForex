const fs = require('fs');

let html = fs.readFileSync('../public/landing.html', 'utf8');

// Fix syntax error
html = html.replace(/pt: \{\\n/g, 'pt: {\n');
html = html.replace(/en: \{\\n/g, 'en: {\n');
html = html.replace(/es: \{\\n/g, 'es: {\n');
html = html.replace(/fr: \{\\n/g, 'fr: {\n');

// Fix any weird characters in the translated text
html = html.replace(/COMISS ES/g, 'COMISSÕES');
html = html.replace(/AT% 30%/g, 'ATÉ 30%');
html = html.replace(/EXPERISNCIA/g, 'EXPERIÊNCIA');
html = html.replace(/% PARA/g, 'É PARA');
html = html.replace(/rob /g, 'robô ');
html = html.replace(/COMISSǟO/g, 'COMISSÃO');

fs.writeFileSync('../public/landing.html', html);
console.log("Fixed syntax and encodings in landing.html");
