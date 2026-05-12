const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const localFile = 'public/AuraForex_V5_INSTITUTIONAL.ex5';
const remoteFile = '/root/AuraForex/public/AuraForex_V5_INSTITUTIONAL.ex5';

conn.on('ready', () => {
    console.log('🚀 Sincronizando novo binário blindado com o VPS...');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream(localFile);
        const writeStream = sftp.createWriteStream(remoteFile);

        writeStream.on('close', () => {
            console.log('✅ Binário enviado! Atualizando links de compatibilidade...');
            conn.exec('cp /root/AuraForex/public/AuraForex_V5_INSTITUTIONAL.ex5 /root/AuraForex/public/SMC_APEX_EA.ex5', (err, stream) => {
                if (err) throw err;
                stream.on('close', () => {
                    console.log('🏁 Tudo sincronizado e pronto para execução institucional.');
                    conn.end();
                });
            });
        });

        readStream.pipe(writeStream);
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
