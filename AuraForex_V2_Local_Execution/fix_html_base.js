const fs = require('fs');

function fixHtml(filepath) {
    if (!fs.existsSync(filepath)) return;
    let code = fs.readFileSync(filepath, 'utf8');

    code = code.replace(/TOTAL EARNINGS \(GAS\)/g, "GANHOS TOTAIS (GAS)");
    code = code.replace(/AVAILABLE FOR WITHDRAWAL/g, "DISPONÍVEL PARA SAQUE");
    code = code.replace(/TOTAL WITHDRAWN/g, "TOTAL SACADO");
    code = code.replace(/Your Team \(Clients\)/g, "Sua Equipa (Clientes)");
    code = code.replace(/Request Withdrawal/g, "Solicitar Saque");
    code = code.replace(/Available Amount:/g, "Montante Disponível:");
    code = code.replace(/Confirm Request/g, "Confirmar Pedido");
    code = code.replace(/Withdrawal History/g, "Histórico de Saques");
    code = code.replace(/WITHDRAWAL HISTORY/g, "HISTÓRICO DE SAQUES"); // Just in case it's in uppercase in HTML too
    code = code.replace(/REQUEST WITHDRAWAL/g, "SOLICITAR SAQUE");

    fs.writeFileSync(filepath, code);
}

fixHtml('smc_bot_dashboard.html');
fixHtml('smc/smc_bot_dashboard.html');
fixHtml('affiliate_dashboard.html');
fixHtml('admin_v3.html');

console.log('HTML files fixed to Portuguese base');
