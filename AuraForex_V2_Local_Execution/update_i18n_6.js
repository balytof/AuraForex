const fs = require('fs');

let code = fs.readFileSync('public/i18n_dashboard_v3.js', 'utf8');

code = code.replace(/"TOTAL EARNINGS \(GAS\)"/g, '"GANHOS TOTAIS (GAS)"');
code = code.replace(/"AVAILABLE FOR WITHDRAWAL"/g, '"DISPONÍVEL PARA SAQUE"');
code = code.replace(/"TOTAL WITHDRAWN"/g, '"TOTAL SACADO"');
code = code.replace(/"Your Team \(Clients\)"/g, '"Sua Equipa (Clientes)"');
code = code.replace(/"Request Withdrawal"/g, '"Solicitar Saque"');
code = code.replace(/"Available Amount:"/g, '"Montante Disponível:"');
code = code.replace(/"Confirm Request"/g, '"Confirmar Pedido"');
code = code.replace(/"Withdrawal History"/g, '"Histórico de Saques"');

fs.writeFileSync('public/i18n_dashboard_v3.js', code);
console.log('Fixed dictionary keys to Portuguese');
