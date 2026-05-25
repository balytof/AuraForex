const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    conn.exec('cat /root/AuraForex/smc_bot_dashboard_v3.html | grep -C 5 "Limite de ordens atingido"', (err, stream) => {
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
    host: '82.112.238.163',
    port: 22,
    username: 'root',
    privateKey: require('fs').readFileSync('C:/Users/Lenovo/.ssh/id_rsa')
});
