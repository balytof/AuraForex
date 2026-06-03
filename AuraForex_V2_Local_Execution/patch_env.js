const fs = require('fs');
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    conn.exec('grep "ENCRYPTION_KEY" /root/AuraForex/AuraForex_V2_Local_Execution/.env || echo "ENCRYPTION_KEY=\\"f3b4a9bba1e98d8eeab6c04fec8b0de239845d471588bb2eb5ea14bdead23eb2\\"" >> /root/AuraForex/AuraForex_V2_Local_Execution/.env', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && pm2 restart server', (err2, stream2) => {
                if (err2) throw err2;
                stream2.on('close', () => {
                    console.log('Env patched and PM2 restarted.');
                    conn.end();
                }).on('data', (d) => console.log(d.toString()));
            });
        }).on('data', (d) => console.log(d.toString()));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
