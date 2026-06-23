const fs = require('fs');
let content = fs.readFileSync('public/i18n_dashboard_v3.js', 'utf8');

// I'll find where "Ações": "Acciones", "Aprovar Pagamento": "Aprobar Pago" is and fix everything below it
const esBlockEnd = '"Aprovar Pagamento": "Aprobar Pago"';
let idx = content.lastIndexOf(esBlockEnd);

if (idx !== -1) {
    let before = content.substring(0, idx + esBlockEnd.length);
    let fixedEnd = `,
        "Configurações Avançadas": "Ajustes Avanzados",
        "Filtro de Tendência (EMA)": "Filtro de Tendencia (EMA)",
        "Períodos Ajustados (VAMA)": "Períodos Ajustados (VAMA)",
        "Estratégia de Fecho": "Estrategia de Cierre",
        "Take Profit Fixo": "Take Profit Fijo",
        "Tempo Limite (Exaustão)": "Límite de Tiempo (Agotamiento)",
        "Limite no Lucro (Segundos)": "Límite de Beneficio (Segundos)",
        "Limite na Perda (Segundos)": "Límite de Pérdida (Segundos)",
        "Guardar Configurações Avançadas": "Guardar Ajustes Avanzados"
    }
};

function buildI18nMap(lang) {
    if (lang === 'pt') return null;
    const dict = dashboardTranslations[lang];
    if (!dict) return null;
    
    let map = [];`;
    
    // Replace everything after esBlockEnd with fixedEnd and the rest of the code starting from 'for (let key in dict)'
    let afterMap = content.substring(content.indexOf('for (let key in dict)'));
    content = before + fixedEnd + '\n    ' + afterMap;
    fs.writeFileSync('public/i18n_dashboard_v3.js', content);
    console.log("Fixed successfully.");
} else {
    console.log("esBlockEnd not found.");
}
