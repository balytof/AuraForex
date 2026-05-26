const fs = require('fs');
const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    conn.exec('grep -rn "no mesmo par atingido" /root/AuraForex/', (err, stream) => {
        if (err) throw err;
        let data = '';
        stream.on('data', d => data += d).on('close', () => {
            console.log("=== GREP RESULTS ===");
            console.log(data);
            conn.end();
        });
    });
}).connect({host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'});
