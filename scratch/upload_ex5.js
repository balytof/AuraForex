const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const localFile = 'AuraForex_V2_Local_Execution/public/AuraForex_V5_INSTITUTIONAL.ex5';
const remoteFile = '/root/AuraForex/public/AuraForex_V5_INSTITUTIONAL.ex5';

conn.on('ready', () => {
    console.log('🚀 Sincronizando o executável (.ex5) com o VPS...');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream(localFile);
        const writeStream = sftp.createWriteStream(remoteFile);

        writeStream.on('close', () => {
            console.log('✅ Executável sincronizado com sucesso!');
            conn.end();
        });

        readStream.pipe(writeStream);
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
