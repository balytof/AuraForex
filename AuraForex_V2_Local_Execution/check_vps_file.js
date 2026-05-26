const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    conn.exec('grep "Limite de" /root/AuraForex/smc_bot_dashboard_v3.html', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.error('STDERR: ' + data);
        });
    });
}).connect({
    host: '141.98.24.161',
    port: 22,
    username: 'root',
    password: 'Mudar@2024$$++'
});
