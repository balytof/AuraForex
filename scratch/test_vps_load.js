const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Executando teste do RiskManager no VPS...');
    const cmd = "node -e 'const { getRiskManager } = require(\"/root/AuraForex/risk/store\"); const risk = getRiskManager(\"5782b472-0ff0-4761-bf38-9fc149705574\"); console.log(\"dailyStartBalance:\", risk.dailyStartBalance); console.log(\"dailyProfitTarget:\", risk.dailyProfitTarget); console.log(\"balance:\", risk.balance); console.log(\"equity:\", risk.equity);'";
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.end();
            process.exit(0);
        }).on('data', (data) => {
            console.log(data.toString());
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
