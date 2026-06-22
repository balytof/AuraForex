const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    conn.exec('pm2 restart aura-v2-elite --update-env', (err, stream) => {
        let data = '';
        stream.on('close', () => {
            console.log('Done:', data);
            conn.end();
        }).on('data', d => data += d.toString()).stderr.on('data', d => data += d.toString());
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
