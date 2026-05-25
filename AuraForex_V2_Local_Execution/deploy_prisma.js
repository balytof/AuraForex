const { Client } = require('ssh2');
const path = require('path');

const conn = new Client();

const filesToUpload = [
    { local: './prisma/schema.prisma', remote: '/root/AuraForex/AuraForex_V2_Local_Execution/prisma/schema.prisma' }
];

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Enviando schema.prisma...');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        let completed = 0;
        filesToUpload.forEach(file => {
            const localPath = path.resolve(__dirname, file.local);
            sftp.fastPut(localPath, file.remote, (err) => {
                if (err) console.error(`❌ Erro ao enviar ${file.local}:`, err.message);
                else console.log(`✅ ${file.local} enviado.`);
                
                completed++;
                if (completed === filesToUpload.length) {
                    console.log('🚀 Executando Prisma Generate e DB Push...');
                    conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && npx prisma generate && npx prisma db push --accept-data-loss && pm2 restart all', (err, stream) => {
                        if (err) throw err;
                        
                        stream.on('close', (code, signal) => {
                            console.log(`✨ Comandos concluídos com código ${code}`);
                            conn.end();
                            process.exit(0);
                        }).on('data', (data) => {
                            console.log('STDOUT: ' + data);
                        }).stderr.on('data', (data) => {
                            console.error('STDERR: ' + data);
                        });
                    });
                }
            });
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
