const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const localFile = 'smc_bot_dashboard.html';
const remoteFile = '/root/AuraForex/smc_bot_dashboard.html';

conn.on('ready', () => {
    console.log('🚀 Sincronizando dashboard principal com o VPS...');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream(localFile);
        const writeStream = sftp.createWriteStream(remoteFile);

        writeStream.on('close', () => {
            console.log('✅ Dashboard principal sincronizado com sucesso!');
            conn.end();
        });

        readStream.pipe(writeStream);
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
