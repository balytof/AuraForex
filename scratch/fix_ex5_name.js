const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🚀 Ajustando compatibilidade de nomes no VPS...');
    conn.exec('cp /root/AuraForex/public/AuraForex_V5_INSTITUTIONAL.ex5 /root/AuraForex/public/SMC_APEX_EA.ex5', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log('✅ Compatibilidade garantida!');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
