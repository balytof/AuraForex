const fs = require('fs');
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('Client :: ready');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        const localPath = './server.js';
        const remotePath = '/root/AuraForex/AuraForex_V2_Local_Execution/server.js';
        
        console.log('Uploading server.js...');
        sftp.fastPut(localPath, remotePath, (err) => {
            if (err) throw err;
            console.log('Upload success.');
            
            console.log('Restarting PM2...');
            conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && pm2 restart server', (err, stream) => {
                if (err) throw err;
                stream.on('close', (code, signal) => {
                    console.log('PM2 restarted with code ' + code);
                    conn.end();
                }).on('data', (data) => {
                    console.log('STDOUT: ' + data);
                }).stderr.on('data', (data) => {
                    console.log('STDERR: ' + data);
                });
            });
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
