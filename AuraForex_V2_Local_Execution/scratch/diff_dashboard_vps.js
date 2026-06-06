const { Client } = require('ssh2');
const fs = require('fs');
const crypto = require('crypto');

const localPath = 'smc_bot_dashboard.html';
const localHash = crypto.createHash('md5').update(fs.readFileSync(localPath)).digest('hex');
console.log('Local MD5:', localHash);

const conn = new Client();
conn.on('ready', () => {
    console.log('Client :: ready');
    conn.exec('md5sum /root/AuraForex/AuraForex_V2_Local_Execution/smc_bot_dashboard.html', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            console.log('VPS MD5 Sum Output:\n' + data.toString().trim());
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
