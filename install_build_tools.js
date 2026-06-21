const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
    console.log('Installing build-essential on VPS...');
    const cmd = `apt-get update && apt-get install -y build-essential python3 && cd /root/AuraCrypto && npm install && npx pm2 restart aura-crypto`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('Crypto App successfully built and restarted.');
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
