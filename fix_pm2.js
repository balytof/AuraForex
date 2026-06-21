const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
    console.log('Client ready. Stopping old server process...');
    conn.exec('npx pm2 delete server && npx pm2 restart aura-v2-elite', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('Old server deleted and aura-v2-elite restarted.');
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
