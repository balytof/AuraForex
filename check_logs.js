const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Lendo logs...');
    conn.exec('pm2 logs aura-v2-elite --lines 100 --raw', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
