const fs = require('fs');
let code = fs.readFileSync('public/i18n_dashboard_v3.js', 'utf8');

const newEnProv = `
        "Painel de Provedor": "Provider Panel",
        "TOTAL DEPOSITADO (CLIENTES)": "TOTAL DEPOSITED (CLIENTS)",
        "TOTAL EARNINGS (GAS)": "TOTAL EARNINGS (GAS)",
        "AVAILABLE FOR WITHDRAWAL": "AVAILABLE FOR WITHDRAWAL",
        "TOTAL WITHDRAWN": "TOTAL WITHDRAWN",
        "Your Team (Clients)": "Your Team (Clients)",
        "Registado a": "Registered on",
        "Gas Total Pago": "Total Gas Paid",
        "Request Withdrawal": "Request Withdrawal",
        "Available Amount:": "Available Amount:",
        "Montante (USD)": "Amount (USD)",
        "Rede": "Network",
        "Confirm Request": "Confirm Request",
        "Withdrawal History": "Withdrawal History",
        "Montante": "Amount",
        "Rede/Carteira": "Network/Wallet",`;

const newFrProv = `
        "Painel de Provedor": "PANNEAU DU FOURNISSEUR",
        "TOTAL DEPOSITADO (CLIENTES)": "TOTAL DÉPOSÉ (CLIENTS)",
        "TOTAL EARNINGS (GAS)": "GAINS TOTAUX (GAS)",
        "AVAILABLE FOR WITHDRAWAL": "DISPONIBLE POUR RETRAIT",
        "TOTAL WITHDRAWN": "TOTAL RETIRÉ",
        "Your Team (Clients)": "Votre Équipe (Clients)",
        "Registado a": "Inscrit le",
        "Gas Total Pago": "Gas Total Payé",
        "Request Withdrawal": "Demander un Retrait",
        "Available Amount:": "Montant Disponible:",
        "Montante (USD)": "Montant (USD)",
        "Rede": "Réseau",
        "Confirm Request": "Confirmer la Demande",
        "Withdrawal History": "Historique des Retraits",
        "Montante": "Montant",
        "Rede/Carteira": "Réseau/Portefeuille",`;

const newEsProv = `
        "Painel de Provedor": "PANEL DEL PROVEEDOR",
        "TOTAL DEPOSITADO (CLIENTES)": "TOTAL DEPOSITADO (CLIENTES)",
        "TOTAL EARNINGS (GAS)": "GANANCIAS TOTALES (GAS)",
        "AVAILABLE FOR WITHDRAWAL": "DISPONIBLE PARA RETIRO",
        "TOTAL WITHDRAWN": "TOTAL RETIRADO",
        "Your Team (Clients)": "Su Equipo (Clientes)",
        "Registado a": "Registrado el",
        "Gas Total Pago": "Gas Total Pagado",
        "Request Withdrawal": "Solicitar Retiro",
        "Available Amount:": "Cantidad Disponible:",
        "Montante (USD)": "Monto (USD)",
        "Rede": "Red",
        "Confirm Request": "Confirmar Solicitud",
        "Withdrawal History": "Historial de Retiros",
        "Montante": "Monto",
        "Rede/Carteira": "Red/Billetera",`;

code = code.replace(/"Provedor": "Provider",/g, `"Provedor": "Provider",${newEnProv}`);
code = code.replace(/"Provedor": "Fournisseur",/g, `"Provedor": "Fournisseur",${newFrProv}`);
code = code.replace(/"Provedor": "Proveedor",/g, `"Provedor": "Proveedor",${newEsProv}`);

fs.writeFileSync('public/i18n_dashboard_v3.js', code);
console.log('Provider strings added to v3');
