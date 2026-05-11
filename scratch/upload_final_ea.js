const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const localFile = 'AuraForex_V2_Local_Execution/public/AuraForex_V5_INSTITUTIONAL.ex5';
const remoteFile = '/root/AuraForex/public/SMC_APEX_EA.ex5';

conn.on('ready', () => {
    console.log('🚀 Enviando versão final blindada (V6.0) para o VPS...');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream(localFile);
        const writeStream = sftp.createWriteStream(remoteFile);

        writeStream.on('close', () => {
            console.log('✅ Upload concluído com sucesso!');
            console.log('✨ O sistema de download agora entrega a versão blindada.');
            conn.end();
        });

        readStream.pipe(writeStream);
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
