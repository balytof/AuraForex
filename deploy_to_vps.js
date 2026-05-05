const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

// Usar os arquivos da pasta V2 Local que está estável
const localDir = './AuraForex_V2_Local_Execution';

const filesToUpload = [
    { local: `${localDir}/server.js`, remote: '/root/AuraForex/server.js' },
    { local: `${localDir}/ea_api.js`, remote: '/root/AuraForex/ea_api.js' },
    { local: `${localDir}/db.js`, remote: '/root/AuraForex/db.js' },
    { local: `${localDir}/apex_broker.js`, remote: '/root/AuraForex/apex_broker.js' },
    { local: `${localDir}/signals/smc_signal_engine.js`, remote: '/root/AuraForex/signals/smc_signal_engine.js' },
    { local: `${localDir}/signals/signals.js`, remote: '/root/AuraForex/signals/signals.js' },
    { local: './AURA_PRO_FINAL.mq5', remote: '/root/AuraForex/public/AURA_PRO_FINAL.mq5' }
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
                    conn.exec('cd /root/AuraForex && npx pm2 restart server || npx pm2 start server.js --name server', (err, stream) => {
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
    password: 'Ghanhos@tradingbots2026AI'
});
