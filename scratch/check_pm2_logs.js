const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Lendo logs do PM2 no VPS...');
    const cmd = "pm2 logs aura-v2-elite --lines 50 --nostream";
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log(data.toString()));
        stream.on('stderr', data => console.error(data.toString()));
        stream.on('close', () => conn.end());
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
