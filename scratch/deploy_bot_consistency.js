const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const filesToSync = [
    { local: 'AuraForex_V2_Local_Execution/prisma/schema.prisma', remote: '/root/AuraForex/prisma/schema.prisma' },
    { local: 'AuraForex_V2_Local_Execution/server.js', remote: '/root/AuraForex/server.js' },
    { local: 'AuraForex_V2_Local_Execution/smc_bot_dashboard.html', remote: '/root/AuraForex/smc_bot_dashboard.html' }
];

conn.on('ready', () => {
    console.log('🚀 Iniciando Deploy Total para Sincronização de Bot Status...');
    
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
                    console.log('🏁 Todos os ficheiros enviados. Iniciando DB Push no VPS...');
                    runDbPush();
                }
            });
            readStream.pipe(writeStream);
        });
    });

    function runDbPush() {
        conn.exec('cd /root/AuraForex && npx prisma db push', (err, stream) => {
            if (err) throw err;
            stream.on('close', (code) => {
                console.log(`✅ DB Push concluído (Código: ${code})`);
                console.log('🔄 Reiniciando Servidor no VPS...');
                conn.exec('pm2 restart all', (err, s2) => {
                    if (err) console.error(err);
                    s2.on('close', () => {
                        console.log('🚀 SISTEMA ONLINE E SINCRONIZADO!');
                        conn.end();
                    });
                });
            }).on('data', (data) => console.log('STDOUT: ' + data))
              .stderr.on('data', (data) => console.log('STDERR: ' + data));
        });
    }
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
