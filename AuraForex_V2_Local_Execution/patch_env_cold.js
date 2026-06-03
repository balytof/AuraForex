const fs = require('fs');
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    conn.exec('grep "ADMIN_COLD_WALLET" /root/AuraForex/AuraForex_V2_Local_Execution/.env || echo "ADMIN_COLD_WALLET=\\"0x9cedb92f865e53105d4a900b3c2edf2c8da9e3f6\\"" >> /root/AuraForex/AuraForex_V2_Local_Execution/.env', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && pm2 restart server', (err2, stream2) => {
                if (err2) throw err2;
                stream2.on('close', () => {
                    console.log('Cold wallet injected into .env');
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
