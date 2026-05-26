const fs = require('fs');
const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    conn.exec('cat /root/AuraForex/AuraForex_V2_Local_Execution/smc_bot_dashboard_v3.html | grep -C 2 "ignorado"', (err, stream) => {
        if (err) throw err;
        let data = '';
        stream.on('data', d => data += d).on('close', () => {
            console.log("=== smc_bot_dashboard_v3.html ===");
            console.log(data);
            conn.end();
        });
    });
}).connect({host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'});
