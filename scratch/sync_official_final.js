const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const localFile = 'AuraForex_V2_Local_Execution/public/AuraForex_V5_INSTITUTIONAL.ex5';
const remoteFile = '/root/AuraForex/public/AuraForex_V5_INSTITUTIONAL.ex5';

conn.on('ready', () => {
    console.log('🚀 Enviando a versão oficial validada pelo parceiro...');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream(localFile);
        const writeStream = sftp.createWriteStream(remoteFile);

        writeStream.on('close', () => {
            console.log('✅ Binário oficial enviado! Sincronizando links...');
            conn.exec('cp /root/AuraForex/public/AuraForex_V5_INSTITUTIONAL.ex5 /root/AuraForex/public/SMC_APEX_EA.ex5', (err, stream) => {
                if (err) throw err;
                stream.on('close', () => {
                    console.log('🏁 Sistema totalmente atualizado com a versão final do parceiro.');
                    conn.end();
                });
            });
        });

        readStream.pipe(writeStream);
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
