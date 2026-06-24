const { Client } = require('ssh2');
const path = require('path');

const conn = new Client();

const filesToUpload = [
    { local: './smc_bot_dashboard.html', remote: '/root/AuraForex/smc_bot_dashboard.html' },
    { local: './server.js', remote: '/root/AuraForex/server.js' },
    { local: './ea_api.js', remote: '/root/AuraForex/ea_api.js' },
    { local: './prisma/schema.prisma', remote: '/root/AuraForex/prisma/schema.prisma' },
    { local: './public/i18n_dashboard_v3.js', remote: '/root/AuraForex/public/i18n_dashboard_v3.js' },
    { local: './public/AuraForex_V8_Institutional.mq5', remote: '/root/AuraForex/public/AuraForex_V8_Institutional.mq5' },
    { local: './public/AuraForex_V8_Institutional.ex5', remote: '/root/AuraForex/public/AuraForex_V8_Institutional.ex5' }
];

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Iniciando Upload do Dashboard e Servidor...');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        let completed = 0;
        filesToUpload.forEach(file => {
            const localPath = path.resolve(__dirname, file.local);
            console.log(`📤 Enviando: ${localPath} -> ${file.remote}`);
            
            sftp.fastPut(localPath, file.remote, (err) => {
                if (err) {
                    console.error(`❌ Erro ao enviar ${file.local}:`, err.message);
                } else {
                    console.log(`✅ ${file.local} enviado.`);
                }
                
                completed++;
                if (completed === filesToUpload.length) {
                    console.log('✨ UPLOAD CONCLUÍDO! Atualizando Base de Dados no VPS...');
                    
                    conn.exec('cd /root/AuraForex && npx prisma db push && npx prisma generate && pm2 restart all', (err, stream) => {
                        if (err) throw err;
                        stream.on('close', (code, signal) => {
                            console.log('🔄 Prisma Push, Generate e PM2 Restart concluídos. Código:', code);
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
