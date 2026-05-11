const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.fastPut('scratch/check_users_vps.js', '/root/AuraForex/check_users_vps.js', (err2) => {
            if (err2) throw err2;
            conn.exec(`cd /root/AuraForex && node check_users_vps.js`, (err3, stream) => {
                if (err3) throw err3;
                stream.on('data', data => console.log(data.toString()));
                stream.on('close', () => conn.end());
            });
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
