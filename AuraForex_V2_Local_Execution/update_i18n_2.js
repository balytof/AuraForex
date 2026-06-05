const fs = require('fs');
let code = fs.readFileSync('public/i18n_dashboard.js', 'utf8');

const newEn2 = `
        "GRATUITA (LÍDER)": "FREE (LEADER)",`;
const newFr2 = `
        "GRATUITA (LÍDER)": "GRATUIT (LEADER)",`;
const newEs2 = `
        "GRATUITA (LÍDER)": "GRATIS (LÍDER)",`;

code = code.replace(/"Status: GRATUITA \\(LÍDER\\)": "Status: FREE \\(LEADER\\)",/g, `"Status: GRATUITA (LÍDER)": "Status: FREE (LEADER)",${newEn2}`);
code = code.replace(/"Status: GRATUITA \\(LÍDER\\)": "Statut: GRATUIT \\(LEADER\\)",/g, `"Status: GRATUITA (LÍDER)": "Statut: GRATUIT (LEADER)",${newFr2}`);
code = code.replace(/"Status: GRATUITA \\(LÍDER\\)": "Estado: GRATIS \\(LÍDER\\)",/g, `"Status: GRATUITA (LÍDER)": "Estado: GRATIS (LÍDER)",${newEs2}`);

fs.writeFileSync('public/i18n_dashboard.js', code);
console.log('Added GRATUITA (LÍDER)');
