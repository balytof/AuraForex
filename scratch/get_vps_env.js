const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    conn.exec('cat /root/AuraForex/.env', (err, stream) => {
        if (err) throw err;
        let data = '';
        stream.on('data', chunk => { data += chunk; });
        stream.on('close', () => {
            console.log("=== VPS ENV ===");
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
