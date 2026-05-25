const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    conn.exec('grep -rn "Limite de ordens atingido" /root/AuraForex/', (err, stream) => {
        if (err) throw err;
        let data = '';
        stream.on('data', d => data += d.toString());
        stream.on('close', () => {
            console.log("RESULT:");
            console.log(data);
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
