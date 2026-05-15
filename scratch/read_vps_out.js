const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('📖 Lendo logs de saída do VPS...');
    conn.exec('tail -n 200 /root/.pm2/logs/aura-v2-elite-out.log', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end())
              .on('data', (data) => console.log('LOGS VPS:\n' + data));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
