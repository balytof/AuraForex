const fs = require('fs');
let code = fs.readFileSync('public/i18n_dashboard.js', 'utf8');

const newEn = `
        "Provedor": "Provider",
        "Robô VPS": "VPS Robot",
        "Copy Trading": "Copy Trading",
        "P&L Realizado (Hoje)": "Realized P&L (Today)",
        "Ganhos/Perdas Totais": "Total Gains/Losses",
        "Operações Abertas": "Open Trades",
        "PAINEL ADMIN": "ADMIN PANEL",
        "Painel Admin": "Admin Panel",
        "MINHA CARTEIRA": "MY WALLET",
        "Créditos Pré-Pagos": "Prepaid Credits",
        "TAXA DE PERFORMANCE": "PERFORMANCE FEE",
        "Ver Extrato & Movimentações": "View Statement & Movements",
        "Sinal enviado para o terminal local (EA).": "Signal sent to local terminal (EA).",
        "Status: GRATUITA (LÍDER)": "Status: FREE (LEADER)",
        "Status: PRO": "Status: PRO",
        "Aderir ao Copy Trading": "Join Copy Trading",`;

const newFr = `
        "Provedor": "Fournisseur",
        "Robô VPS": "Robot VPS",
        "Copy Trading": "Copy Trading",
        "P&L Realizado (Hoje)": "P&L Réalisé (Aujourd'hui)",
        "Ganhos/Perdas Totais": "Gains/Pertes Totaux",
        "Operações Abertas": "Transactions Ouvertes",
        "PAINEL ADMIN": "PANNEAU ADMIN",
        "Painel Admin": "Panneau Admin",
        "MINHA CARTEIRA": "MON PORTEFEUILLE",
        "Créditos Pré-Pagos": "Crédits Prépayés",
        "TAXA DE PERFORMANCE": "FRAIS DE PERFORMANCE",
        "Ver Extrato & Movimentações": "Voir le Relevé & Mouvements",
        "Sinal enviado para o terminal local (EA).": "Signal envoyé au terminal local (EA).",
        "Status: GRATUITA (LÍDER)": "Statut: GRATUIT (LEADER)",
        "Status: PRO": "Statut: PRO",
        "Aderir ao Copy Trading": "Rejoindre Copy Trading",`;

const newEs = `
        "Provedor": "Proveedor",
        "Robô VPS": "Robot VPS",
        "Copy Trading": "Copy Trading",
        "P&L Realizado (Hoje)": "P&L Realizado (Hoy)",
        "Ganhos/Perdas Totais": "Ganancias/Pérdidas Totales",
        "Operações Abertas": "Operaciones Abiertas",
        "PAINEL ADMIN": "PANEL ADMIN",
        "Painel Admin": "Panel Admin",
        "MINHA CARTEIRA": "MI BILLETERA",
        "Créditos Pré-Pagos": "Créditos Prepagos",
        "TAXA DE PERFORMANCE": "TARIFA DE RENDIMIENTO",
        "Ver Extrato & Movimentações": "Ver Extracto & Movimientos",
        "Sinal enviado para o terminal local (EA).": "Señal enviada al terminal local (EA).",
        "Status: GRATUITA (LÍDER)": "Estado: GRATIS (LÍDER)",
        "Status: PRO": "Estado: PRO",
        "Aderir ao Copy Trading": "Unirse a Copy Trading",`;

code = code.replace(/"Dashboard": "Dashboard",/g, `"Dashboard": "Dashboard",${newEn}`);
code = code.replace(/"Dashboard": "Tableau de Bord",/g, `"Dashboard": "Tableau de Bord",${newFr}`);
code = code.replace(/"Dashboard": "Panel",/g, `"Dashboard": "Panel",${newEs}`);
fs.writeFileSync('public/i18n_dashboard.js', code);
console.log('Updated i18n_dashboard.js');
