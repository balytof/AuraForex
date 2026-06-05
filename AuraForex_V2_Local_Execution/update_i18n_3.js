const fs = require('fs');
let code = fs.readFileSync('public/i18n_dashboard.js', 'utf8');

const newEn3 = `
        "Status:": "Status:",`;
const newFr3 = `
        "Status:": "Statut:",`;
const newEs3 = `
        "Status:": "Estado:",`;

code = code.replace(/"Status: GRATUITA \\(LÍDER\\)": "Status: FREE \\(LEADER\\)",/g, `"Status: GRATUITA (LÍDER)": "Status: FREE (LEADER)",${newEn3}`);
code = code.replace(/"Status: GRATUITA \\(LÍDER\\)": "Statut: GRATUIT \\(LEADER\\)",/g, `"Status: GRATUITA (LÍDER)": "Statut: GRATUIT (LEADER)",${newFr3}`);
code = code.replace(/"Status: GRATUITA \\(LÍDER\\)": "Estado: GRATIS \\(LÍDER\\)",/g, `"Status: GRATUITA (LÍDER)": "Estado: GRATIS (LÍDER)",${newEs3}`);

fs.writeFileSync('public/i18n_dashboard.js', code);
console.log('Added Status:');
