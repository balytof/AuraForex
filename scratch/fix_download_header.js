const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Corrigindo rota de download no server.js do VPS...');
    
    // Garantir que a rota aponta para o .ex5 e define o Content-Type correto
    const cmd = "sed -i 's/res.setHeader(\"Content-Type\", \"application\\/octet-stream\");/res.setHeader(\"Content-Type\", \"application\\/octet-stream\"); res.setHeader(\"Content-Disposition\", \"attachment; filename=\\\"SMC_APEX_EA.ex5\\\"\");/' /root/AuraForex/server.js && npx pm2 restart aura-v2-elite";

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('✅ Rota de download corrigida e servidor reiniciado.');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
