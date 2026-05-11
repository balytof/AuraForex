const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const files = [
    { local: 'public/AURA_PRO_FINAL.mq5', remote: '/root/AuraForex/AURA_PRO_FINAL.mq5' },
    { local: 'public/AuraForex_V5_INSTITUTIONAL.mq5', remote: '/root/AuraForex/public/AuraForex_V5_INSTITUTIONAL.mq5' }
];

conn.on('ready', () => {
    console.log('🚀 Sincronizando ficheiros públicos com o VPS...');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        let completed = 0;
        files.forEach(f => {
            const readStream = fs.createReadStream(f.local);
            const writeStream = sftp.createWriteStream(f.remote);
            
            writeStream.on('close', () => {
                console.log(`✅ ${f.local} enviado para ${f.remote}`);
                completed++;
                if (completed === files.length) {
                    console.log('🏁 Sincronização terminada!');
                    conn.end();
                }
            });
            
            readStream.pipe(writeStream);
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
