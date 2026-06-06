const fs = require('fs');

let code = fs.readFileSync('public/i18n_dashboard_v3.js', 'utf8');

const englishSectionMatch = code.match(/"en": \{([\s\S]*?)\},/);
if (englishSectionMatch) {
    let enSection = englishSectionMatch[1];
    enSection = enSection.replace(/"GANHOS TOTAIS \(GAS\)": "GANHOS TOTAIS \(GAS\)"/g, '"GANHOS TOTAIS (GAS)": "TOTAL EARNINGS (GAS)"');
    enSection = enSection.replace(/"DISPONÍVEL PARA SAQUE": "DISPONÍVEL PARA SAQUE"/g, '"DISPONÍVEL PARA SAQUE": "AVAILABLE FOR WITHDRAWAL"');
    enSection = enSection.replace(/"TOTAL SACADO": "TOTAL SACADO"/g, '"TOTAL SACADO": "TOTAL WITHDRAWN"');
    enSection = enSection.replace(/"Sua Equipa \(Clientes\)": "Sua Equipa \(Clientes\)"/g, '"Sua Equipa (Clientes)": "Your Team (Clients)"');
    enSection = enSection.replace(/"Solicitar Saque": "Solicitar Saque"/g, '"Solicitar Saque": "Request Withdrawal"');
    enSection = enSection.replace(/"Montante Disponível:": "Montante Disponível:"/g, '"Montante Disponível:": "Available Amount:"');
    enSection = enSection.replace(/"Confirmar Pedido": "Confirmar Pedido"/g, '"Confirmar Pedido": "Confirm Request"');
    enSection = enSection.replace(/"Histórico de Saques": "Histórico de Saques"/g, '"Histórico de Saques": "Withdrawal History"');

    code = code.replace(englishSectionMatch[1], enSection);
    fs.writeFileSync('public/i18n_dashboard_v3.js', code);
    console.log('Fixed English dictionary targets');
}
