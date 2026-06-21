const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
const serverPath = 'AuraCrypto_Temp/server.ts';

conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const readStream = fs.createReadStream(serverPath);
        const writeStream = sftp.createWriteStream('/root/AuraCrypto/server.ts');
        
        writeStream.on('close', () => {
            console.log('Upload complete.');
            conn.exec('npx pm2 restart aura-crypto', (err, stream) => {
                if (err) throw err;
                stream.on('close', () => conn.end())
                .on('data', data => process.stdout.write(data))
                .stderr.on('data', data => process.stderr.write(data));
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
