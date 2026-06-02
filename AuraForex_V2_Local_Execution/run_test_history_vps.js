const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) throw err;
        console.log('Uploading test_history.js...');
        sftp.fastPut('./test_history.js', '/root/AuraForex/AuraForex_V2_Local_Execution/test_history.js', (err) => {
            if (err) throw err;
            console.log('Upload complete. Running script...');
            conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && node test_history.js', (err, stream) => {
                if (err) throw err;
                stream.on('close', (code, signal) => {
                    console.log('Script exited with code', code);
                    conn.end();
                }).on('data', (data) => {
                    console.log('STDOUT:', data.toString());
                }).stderr.on('data', (data) => {
                    console.log('STDERR:', data.toString());
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
