const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('📝 Lendo logs de diagnóstico do VPS...');
    conn.exec('tail -n 100 /root/AuraForex/server_log.txt', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            console.log('LOGS DO VPS:\n' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
