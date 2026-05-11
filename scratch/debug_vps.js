const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('READY');
    conn.exec('cd /root/AuraForex && node check_users_vps.js', (err, stream) => {
        if (err) { console.error('EXEC ERR:', err); return; }
        stream.on('data', data => console.log('STDOUT:', data.toString()));
        stream.on('stderr', data => console.error('STDERR:', data.toString()));
        stream.on('close', (code) => {
            console.log('CLOSE CODE:', code);
            conn.end();
        });
    });
}).on('error', err => console.error('CONN ERR:', err))
.connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
