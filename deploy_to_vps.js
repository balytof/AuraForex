const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

// Usar os arquivos da pasta V2 Local que está estável
const localDir = './AuraForex_V2_Local_Execution';

const filesToUpload = [
    { local: './server.js', remote: '/root/AuraForex/server.js' },
    { local: './smc_bot_dashboard.html', remote: '/root/AuraForex/smc_bot_dashboard.html' },
    { local: './ea_api.js', remote: '/root/AuraForex/ea_api.js' },
    { local: './db.js', remote: '/root/AuraForex/db.js' },
    { local: './utils/logger.js', remote: '/root/AuraForex/utils/logger.js' },
    { local: './apex_broker.js', remote: '/root/AuraForex/apex_broker.js' },
    { local: './smc/smc.js', remote: '/root/AuraForex/smc/smc.js' },
    { local: './signals/smc_signal_engine.js', remote: '/root/AuraForex/signals/smc_signal_engine.js' },
    { local: './risk/risk.js', remote: '/root/AuraForex/risk/risk.js' },
    { local: './risk/store.js', remote: '/root/AuraForex/risk/store.js' },
    { local: './public/AuraForex_V8_INSTITUTIONAL.ex5', remote: '/root/AuraForex/public/AuraForex_V8_INSTITUTIONAL.ex5' },
    { local: './public/AuraForex_V8_INSTITUTIONAL.mq5', remote: '/root/AuraForex/public/AuraForex_V8_INSTITUTIONAL.mq5' },
    { local: './JAson.mqh', remote: '/root/AuraForex/public/JAson.mqh' },
    { local: './public/landing.html', remote: '/root/AuraForex/public/landing.html' },
    { local: './public/bot-human.png', remote: '/root/AuraForex/public/bot-human.png' }
];

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS (139.59.159.48). Iniciando Upload Full V2...');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        let completed = 0;
        filesToUpload.forEach(file => {
            const localPath = path.resolve(__dirname, file.local);
            
            // Garantir que o diretório remoto existe (simplificado para este caso)
            console.log(`📤 Enviando: ${file.local} -> ${file.remote}`);
            
            sftp.fastPut(localPath, file.remote, (err) => {
                if (err) {
                    console.error(`❌ Erro ao enviar ${file.local}:`, err.message);
                } else {
                    console.log(`✅ ${file.local} enviado com sucesso.`);
                }
                
                completed++;
                if (completed === filesToUpload.length) {
                    console.log('🔄 Reiniciando servidores no VPS via PM2...');
                    // Comando para reiniciar o processo principal
                    conn.exec('cd /root/AuraForex && npx pm2 restart aura-v2-elite || npx pm2 start server.js --name aura-v2-elite', (err, stream) => {
                        if (err) throw err;
                        stream.on('close', () => {
                            console.log('✨ TUDO ATUALIZADO E REINICIADO NO VPS!');
                            conn.end();
                            process.exit(0);
                        }).on('data', (data) => console.log('STDOUT: ' + data));
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
