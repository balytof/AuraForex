const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    conn.exec('echo "ENCRYPTION_KEY=f3b4a9bba1e98d8eeab6c04fec8b0de239845d471588bb2eb5ea14bdead23eb2" >> /root/AuraForex/.env && pm2 restart aura-v2-elite', (err, stream) => {
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
