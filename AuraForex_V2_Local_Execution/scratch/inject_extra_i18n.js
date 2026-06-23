const fs = require('fs');
let content = fs.readFileSync('public/i18n_dashboard_v3.js', 'utf8');

const enInsert = `
        "Controla a tendência do bot.": "Controls the bot's trend.",
        "🤖 Automático (ADX)": "🤖 Automatic (ADX)",
        "✅ Sempre LIGADO": "✅ Always ON",
        "❌ Sempre DESLIGADO": "❌ Always OFF",
        "A aguardar...": "Waiting...",
        "Metas Diárias (%)": "Daily Targets (%)",
        "Meta de Lucro Diário (%)": "Daily Profit Target (%)",
        "Limite de Perda Diário (%)": "Daily Loss Limit (%)",
        "Gestão de Ganhos (Runners)": "Earnings Management (Runners)",
        "Desativado": "Disabled",
        "Trailing Stop (Padrão)": "Trailing Stop (Default)",
        "Profit Lock (Avançado)": "Profit Lock (Advanced)",
        "Ativação ($)": "Activation ($)",
        "Queda Tolerada (%)": "Tolerated Drop (%)",
`;

const frInsert = `
        "Controla a tendência do bot.": "Contrôle la tendance du bot.",
        "🤖 Automático (ADX)": "🤖 Automatique (ADX)",
        "✅ Sempre LIGADO": "✅ Toujours ACTIVÉ",
        "❌ Sempre DESLIGADO": "❌ Toujours DÉSACTIVÉ",
        "A aguardar...": "En attente...",
        "Metas Diárias (%)": "Objectifs Quotidiens (%)",
        "Meta de Lucro Diário (%)": "Objectif de Profit Quotidien (%)",
        "Limite de Perda Diário (%)": "Limite de Perte Quotidienne (%)",
        "Gestão de Ganhos (Runners)": "Gestion des Gains (Runners)",
        "Desativado": "Désactivé",
        "Trailing Stop (Padrão)": "Trailing Stop (Par défaut)",
        "Profit Lock (Avançado)": "Profit Lock (Avancé)",
        "Ativação ($)": "Activation ($)",
        "Queda Tolerada (%)": "Baisse Tolérée (%)",
`;

const esInsert = `
        "Controla a tendência do bot.": "Controla la tendencia del bot.",
        "🤖 Automático (ADX)": "🤖 Automático (ADX)",
        "✅ Sempre LIGADO": "✅ Siempre ENCENDIDO",
        "❌ Sempre DESLIGADO": "❌ Siempre APAGADO",
        "A aguardar...": "Esperando...",
        "Metas Diárias (%)": "Metas Diarias (%)",
        "Meta de Lucro Diário (%)": "Meta de Beneficio Diario (%)",
        "Limite de Perda Diário (%)": "Límite de Pérdida Diaria (%)",
        "Gestão de Ganhos (Runners)": "Gestión de Ganancias (Runners)",
        "Desativado": "Desactivado",
        "Trailing Stop (Padrão)": "Trailing Stop (Por defecto)",
        "Profit Lock (Avançado)": "Profit Lock (Avanzado)",
        "Ativação ($)": "Activación ($)",
        "Queda Tolerada (%)": "Caída Tolerada (%)",
`;

content = content.replace('"Guardar Configurações Avançadas": "Save Advanced Settings"', enInsert + '        "Guardar Configurações Avançadas": "Save Advanced Settings"');
content = content.replace('"Guardar Configurações Avançadas": "Sauvegarder les Paramètres Avancés"', frInsert + '        "Guardar Configurações Avançadas": "Sauvegarder les Paramètres Avancés"');
content = content.replace('"Guardar Configurações Avançadas": "Guardar Ajustes Avanzados"', esInsert + '        "Guardar Configurações Avançadas": "Guardar Ajustes Avanzados"');

fs.writeFileSync('public/i18n_dashboard_v3.js', content);
console.log('Extra translations injected successfully!');
