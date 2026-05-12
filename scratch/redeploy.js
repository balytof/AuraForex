const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const filesToSync = [
    { local: 'AuraForex_V2_Local_Execution/prisma/schema.prisma', remote: '/root/AuraForex/prisma/schema.prisma' },
    { local: 'AuraForex_V2_Local_Execution/server.js', remote: '/root/AuraForex/server.js' },
    { local: 'AuraForex_V2_Local_Execution/smc_bot_dashboard.html', remote: '/root/AuraForex/smc_bot_dashboard.html' },
    { local: 'AuraForex_V2_Local_Execution/prisma.config.js', remote: '/root/AuraForex/prisma.config.js' },
    { local: 'AuraForex_V2_Local_Execution/ea_api.js', remote: '/root/AuraForex/ea_api.js' }
];

conn.on('ready', () => {
    console.log('🚀 Iniciando Re-Deploy (Recuperação)...');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        let completed = 0;
        filesToSync.forEach(file => {
            const readStream = fs.createReadStream(file.local);
            const writeStream = sftp.createWriteStream(file.remote);
            
            writeStream.on('close', () => {
                console.log(`✅ Sincronizado: ${file.local}`);
                completed++;
                if (completed === filesToSync.length) {
                    console.log('🏁 Todos os ficheiros enviados. Iniciando Processos...');
                    runFinal();
                }
            });
            readStream.pipe(writeStream);
        });
    });

    function runFinal() {
        conn.exec('cd /root/AuraForex && npx prisma db push --accept-data-loss', (err, stream) => {
            if (err) throw err;
            stream.on('close', () => {
                console.log('✅ DB Push OK');
                conn.exec('cd /root/AuraForex && npx prisma generate', (err, s2) => {
                    if (err) throw err;
                    s2.on('close', () => {
                        console.log('✅ Prisma Generate OK');
                        conn.exec('pm2 restart all', (err, s3) => {
                            if (err) throw err;
                            s3.on('close', () => {
                                console.log('🚀 RESTART OK');
                                conn.end();
                            });
                        });
                    });
                });
            });
        });
    }
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
