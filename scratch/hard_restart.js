const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🧹 Limpeza profunda e reinício total no VPS...');
    // Forçar paragem, remover logs antigos e reiniciar com --force
    conn.exec('npx pm2 stop all && rm /root/.pm2/logs/*.log && cd /root/AuraForex && npx pm2 start server.js --name aura-v2-elite --force', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('✨ Servidor reiniciado do zero!');
            conn.end();
        }).on('data', (data) => console.log(data.toString()));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
