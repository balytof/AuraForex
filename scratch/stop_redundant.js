const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🛑 Parando aura-v2-elite e mantendo apenas o server atualizado...');
    conn.exec('npx pm2 stop 0 && npx pm2 restart 1 && sleep 5 && tail -n 20 /root/AuraForex/server_log.txt', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end())
              .on('data', (data) => console.log('SAÍDA VPS:\n' + data));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
