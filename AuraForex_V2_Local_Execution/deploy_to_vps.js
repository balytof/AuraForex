const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

// Usar os arquivos da pasta V2 Local que está estável (executado de dentro da pasta)
const localDir = '.';

const filesToUpload = [
    { local: `${localDir}/server.js`, remote: '/root/AuraForex/server.js' },
    { local: `${localDir}/admin_dashboard.html`, remote: '/root/AuraForex/admin_dashboard.html' },
    { local: `${localDir}/smc_bot_dashboard.html`, remote: '/root/AuraForex/smc_bot_dashboard.html' },
    { local: `${localDir}/ea_api.js`, remote: '/root/AuraForex/ea_api.js' },
    { local: `${localDir}/db.js`, remote: '/root/AuraForex/db.js' },
    { local: `${localDir}/prisma/schema.prisma`, remote: '/root/AuraForex/prisma/schema.prisma' },
    { local: `${localDir}/apex_broker.js`, remote: '/root/AuraForex/apex_broker.js' },
    { local: `${localDir}/signals/smc_signal_engine.js`, remote: '/root/AuraForex/signals/smc_signal_engine.js' },
    { local: `${localDir}/signals/signals.js`, remote: '/root/AuraForex/signals/signals.js' },
    { local: `${localDir}/risk/risk.js`, remote: '/root/AuraForex/risk/risk.js' },
    { local: `${localDir}/public/AuraForex_V8_INSTITUTIONAL.ex5`, remote: '/root/AuraForex/public/AuraForex_V8_INSTITUTIONAL.ex5' },
    { local: `${localDir}/pamm_metaapi.js`, remote: '/root/AuraForex/pamm_metaapi.js' },
    { local: `${localDir}/package.json`, remote: '/root/AuraForex/package.json' },
    { local: `${localDir}/package-lock.json`, remote: '/root/AuraForex/package-lock.json' }
];

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS (139.59.159.48). Iniciando Upload Full V2...');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        let completed = 0;
        filesToUpload.forEach(file => {
            const localPath = path.resolve(__dirname, file.local);
            
            console.log(`📤 Enviando: ${file.local} -> ${file.remote}`);
            
            sftp.fastPut(localPath, file.remote, (err) => {
                if (err) {
                    console.error(`❌ Erro ao enviar ${file.local}:`, err.message);
                } else {
                    console.log(`✅ ${file.local} enviado com sucesso.`);
                }
                
                completed++;
                if (completed === filesToUpload.length) {
                    console.log('🔄 Instalando pacotes, sincronizando banco de dados Prisma e reiniciando VPS via PM2...');
                    
                    const remoteCmd = 'cd /root/AuraForex && npm install && npx prisma db push --accept-data-loss && npx prisma generate && (npx pm2 restart server || npx pm2 start server.js --name server)';
                    
                    conn.exec(remoteCmd, (err, stream) => {
                        if (err) throw err;
                        stream.on('close', () => {
                            console.log('✨ TUDO ATUALIZADO, BANCO DE DADOS SINCRONIZADO E SERVIDORES REINICIADOS NO VPS!');
                            conn.end();
                            process.exit(0);
                        }).on('data', (data) => console.log('STDOUT: ' + data))
                          .on('stderr', (data) => console.error('STDERR: ' + data));
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
