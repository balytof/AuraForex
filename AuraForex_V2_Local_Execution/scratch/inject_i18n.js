const fs = require('fs');
let content = fs.readFileSync('public/i18n_dashboard_v3.js', 'utf8');

const enInsert = `
        "Aprovar Pagamento": "Approve Payment",
        // Novas Configurações Avançadas
        "Configurações Avançadas": "Advanced Settings",
        "Filtro de Tendência (EMA)": "Trend Filter (EMA)",
        "Períodos Ajustados (VAMA)": "Adjusted Periods (VAMA)",
        "Estratégia de Fecho": "Close Strategy",
        "Take Profit Fixo": "Fixed Take Profit",
        "Tempo Limite (Exaustão)": "Time Limit (Exhaustion)",
        "Limite no Lucro (Segundos)": "Profit Limit (Seconds)",
        "Limite na Perda (Segundos)": "Loss Limit (Seconds)",
        "Guardar Configurações Avançadas": "Save Advanced Settings"`;

const frInsert = `
        "Aprovar Pagamento": "Approuver le Paiement",
        // Novas Configurações Avançadas
        "Configurações Avançadas": "Paramètres Avancés",
        "Filtro de Tendência (EMA)": "Filtre de Tendance (EMA)",
        "Períodos Ajustados (VAMA)": "Périodes Ajustées (VAMA)",
        "Estratégia de Fecho": "Stratégie de Clôture",
        "Take Profit Fixo": "Take Profit Fixe",
        "Tempo Limite (Exaustão)": "Limite de Temps (Épuisement)",
        "Limite no Lucro (Segundos)": "Limite de Profit (Secondes)",
        "Limite na Perda (Segundos)": "Limite de Perte (Secondes)",
        "Guardar Configurações Avançadas": "Sauvegarder les Paramètres Avancés"`;

const esInsert = `
        "Aprovar Pagamento": "Aprobar Pago",
        // Novas Configurações Avançadas
        "Configurações Avançadas": "Ajustes Avanzados",
        "Filtro de Tendência (EMA)": "Filtro de Tendencia (EMA)",
        "Períodos Ajustados (VAMA)": "Períodos Ajustados (VAMA)",
        "Estratégia de Fecho": "Estrategia de Cierre",
        "Take Profit Fixo": "Take Profit Fijo",
        "Tempo Limite (Exaustão)": "Límite de Tiempo (Agotamiento)",
        "Limite no Lucro (Segundos)": "Límite de Beneficio (Segundos)",
        "Limite na Perda (Segundos)": "Límite de Pérdida (Segundos)",
        "Guardar Configurações Avançadas": "Guardar Ajustes Avanzados"`;

content = content.replace('"Aprovar Pagamento": "Approve Payment"', enInsert);
content = content.replace('"Aprovar Pagamento": "Approuver le Paiement"', frInsert);
content = content.replace('"Aprovar Pagamento": "Aprobar Pago"', esInsert);

fs.writeFileSync('public/i18n_dashboard_v3.js', content);
console.log('Translations injected successfully!');
