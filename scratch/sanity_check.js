const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    conn.exec('node -v && ls -l /root/AuraForex/check_users_vps.js', (err, stream) => {
        stream.on('data', data => console.log(data.toString()));
        stream.on('stderr', data => console.error(data.toString()));
        stream.on('close', () => conn.end());
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
