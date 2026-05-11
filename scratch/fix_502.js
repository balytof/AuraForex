const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Diagnosticando queda do servidor...');
    const cmd = "cd /root/AuraForex && npx pm2 delete all && npx pm2 start server.js --name aura-v2-elite && npx pm2 list";
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log(data.toString()));
        stream.on('stderr', data => console.error(data.toString()));
        stream.on('close', () => {
            console.log('✅ Tentativa de reinício concluída. Verificando logs de erro...');
            conn.exec("npx pm2 logs aura-v2-elite --lines 20 --nostream", (err2, stream2) => {
                stream2.on('data', data => console.log(data.toString()));
                stream2.on('close', () => conn.end());
            });
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
