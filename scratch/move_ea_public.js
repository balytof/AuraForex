const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Movendo EA V6 para a pasta pública no VPS...');
    const cmd = 'cp /root/AuraForex/AURA_PRO_FINAL.mq5 /root/AuraForex/public/AURA_PRO_FINAL.mq5';
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('✅ EA V6 disponível para download em /public/AURA_PRO_FINAL.mq5');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
