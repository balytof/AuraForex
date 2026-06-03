const fs = require('fs');
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    conn.exec('grep "GAS_WALLET_PRIVATE_KEY" /root/AuraForex/AuraForex_V2_Local_Execution/.env || echo "GAS_WALLET_PRIVATE_KEY=\\"0xfe2cf3419718c882240e96a36eb2b92513ee7ac634cc571abe8894cf99a77eb6\\"" >> /root/AuraForex/AuraForex_V2_Local_Execution/.env', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && pm2 restart server', (err2, stream2) => {
                if (err2) throw err2;
                stream2.on('close', () => {
                    console.log('Gas wallet injected into .env');
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
