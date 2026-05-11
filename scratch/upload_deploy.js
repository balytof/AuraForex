const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const localFile = 'deploy_complete.zip';
const remoteFile = '/root/AuraForex/deploy_complete.zip';

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Enviando deploy_complete.zip...');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream(localFile);
        const writeStream = sftp.createWriteStream(remoteFile);

        writeStream.on('close', () => {
            console.log('✅ Upload concluído. Extraindo no VPS...');
            
            // Comandos para extrair, instalar deps e reiniciar
            // Usamos -o para sobrescrever
            const cmd = 'cd /root/AuraForex && unzip -o deploy_complete.zip && npx prisma generate && npx pm2 restart aura-v2-elite && rm deploy_complete.zip';
            
            conn.exec(cmd, (err2, stream) => {
                if (err2) throw err2;
                stream.on('data', data => process.stdout.write(data.toString()));
                stream.on('stderr', data => process.stderr.write(data.toString()));
                stream.on('close', () => {
                    console.log('\n✨ VPS restaurado para o commit 44250a1 e reiniciado!');
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
