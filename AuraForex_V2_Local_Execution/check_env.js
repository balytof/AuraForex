const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && cat .env ecosystem.config.js', (err, stream) => {
        if (err) throw err;
        let output = '';
        stream.on('close', (code, signal) => {
            console.log(output);
            conn.end();
        }).on('data', (data) => {
            output += data;
        }).stderr.on('data', (data) => {
            output += data;
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
