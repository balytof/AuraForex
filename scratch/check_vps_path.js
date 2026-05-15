const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('📂 Verificando pasta de execução do aura-v2-elite...');
    conn.exec('npx pm2 show 0', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end())
              .on('data', (data) => console.log('INFO PM2:\n' + data));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
