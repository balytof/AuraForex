const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('❌ Lendo logs de erro do aura-v2-elite no VPS...');
    conn.exec('tail -n 20 /root/.pm2/logs/aura-v2-elite-error.log', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end())
              .on('data', (data) => console.log('ERRO NO VPS:\n' + data));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
