const fs = require('fs');
let code = fs.readFileSync('public/i18n_dashboard.js', 'utf8');

const newEn4 = `
        "SALDO DISPONÍVEL": "AVAILABLE BALANCE",`;
const newFr4 = `
        "SALDO DISPONÍVEL": "SOLDE DISPONIBLE",`;
const newEs4 = `
        "SALDO DISPONÍVEL": "SALDO DISPONIBLE",`;

code = code.replace(/"TAXA DE PERFORMANCE": "PERFORMANCE FEE",/g, `"TAXA DE PERFORMANCE": "PERFORMANCE FEE",${newEn4}`);
code = code.replace(/"TAXA DE PERFORMANCE": "FRAIS DE PERFORMANCE",/g, `"TAXA DE PERFORMANCE": "FRAIS DE PERFORMANCE",${newFr4}`);
code = code.replace(/"TAXA DE PERFORMANCE": "TARIFA DE RENDIMIENTO",/g, `"TAXA DE PERFORMANCE": "TARIFA DE RENDIMIENTO",${newEs4}`);

fs.writeFileSync('public/i18n_dashboard.js', code);
console.log('Added SALDO DISPONÍVEL');
