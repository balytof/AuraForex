const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const localFile = 'scratch/master_license_vps.js';
const remoteFile = '/root/AuraForex/scratch_license.js';

conn.on('ready', () => {
    console.log('🚀 Enviando script de licença para o VPS...');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream(localFile);
        const writeStream = sftp.createWriteStream(remoteFile);

        writeStream.on('close', () => {
            console.log('✅ Script enviado. Executando...');
            conn.exec(`cd /root/AuraForex && node scratch_license.js`, (err2, stream) => {
                if (err2) throw err2;
                stream.on('data', data => console.log(data.toString()));
                stream.on('stderr', data => console.error(data.toString()));
                stream.on('close', () => {
                    console.log('✨ Fim da execução.');
                    conn.end();
                });
            });
        });

        readStream.pipe(writeStream);
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
