const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const localFile = 'scratch/update_guide_text.js';
const remoteFile = '/root/AuraForex/update_guide_text.js';

conn.on('ready', () => {
    console.log('🚀 Uploading guide update script to VPS...');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream(localFile);
        const writeStream = sftp.createWriteStream(remoteFile);

        writeStream.on('close', () => {
            console.log('✅ Script uploaded. Running it now...');
            conn.exec('cd /root/AuraForex && node update_guide_text.js', (err, stream) => {
                if (err) throw err;
                stream.on('close', (code, signal) => {
                    console.log(`🏁 Process finished with code ${code}`);
                    conn.end();
                }).on('data', (data) => {
                    console.log('STDOUT: ' + data);
                }).stderr.on('data', (data) => {
                    console.log('STDERR: ' + data);
                });
            });
        });

        readStream.pipe(writeStream);
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
