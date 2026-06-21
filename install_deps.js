const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
    console.log('Client ready. Installing dependencies on VPS...');
    conn.exec('cd /root/AuraForex && npm install node-cron axios', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('Dependencies installed. Restarting PM2...');
            conn.exec('npx pm2 restart aura-v2-elite', (err, stream2) => {
                if (err) throw err;
                stream2.on('close', () => {
                    console.log('PM2 restarted successfully.');
                    conn.end();
                }).on('data', data => process.stdout.write(data))
                .stderr.on('data', data => process.stderr.write(data));
            });
        }).on('data', data => process.stdout.write(data))
        .stderr.on('data', data => process.stderr.write(data));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
