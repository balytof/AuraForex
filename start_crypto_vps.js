const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
    console.log('Starting aura-crypto on VPS...');
    const cmd = `cd /root/AuraCrypto && npm install && npx pm2 restart aura-crypto || npx pm2 start "npx tsx server.ts" --name aura-crypto`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('Crypto App started on VPS.');
            conn.end();
        }).on('data', data => process.stdout.write(data))
        .stderr.on('data', data => process.stderr.write(data));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
