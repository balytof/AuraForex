const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Finalizando configuração do download no VPS...');
    // Criar cópia com o nome esperado pelo dashboard
    const cmd = 'cp /root/AuraForex/public/AuraForex_V5_INSTITUTIONAL.ex5 /root/AuraForex/public/SMC_APEX_EA.ex5';
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('✅ Robô disponível para download como SMC_APEX_EA.ex5');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
