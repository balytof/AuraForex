const fs = require('fs');

let html = fs.readFileSync('../public/landing.html', 'utf8');

// The weird characters in Powershell output
html = html.replace(/COMISS ES/g, 'COMISSÕES');
html = html.replace(/AT% 30%/g, 'ATÉ 30%');
html = html.replace(/EXPERISNCIA/g, 'EXPERIÊNCIA');
html = html.replace(/% PARA TODOS/g, 'É PARA TODOS');
html = html.replace(/rob institucional/g, 'robô institucional');
html = html.replace(/COMISSǟO/g, 'COMISSÃO');
html = html.replace(/comisses/g, 'comissões');
html = html.replace(/vocǦ/g, 'você');
html = html.replace(/AURA COPY % PARA/g, 'AURA COPY É PARA');
html = html.replace(/AT%/g, 'ATÉ');

// Also check the syntax of the translations array.
// I see pt: { ...  is correct now.

fs.writeFileSync('../public/landing.html', html);
console.log("Fixed encodings in landing.html");
