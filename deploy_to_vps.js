const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

// Usar os arquivos da raiz que são os mais recentes
const localDir = '.';

const filesToUpload = [
    { local: `${localDir}/server.js`, remote: '/root/AuraForex/server.js' },
    { local: `${localDir}/smc_bot_dashboard.html`, remote: '/root/AuraForex/smc_bot_dashboard.html' },
    { local: `${localDir}/ea_api.js`, remote: '/root/AuraForex/ea_api.js' },
    { local: `${localDir}/db.js`, remote: '/root/AuraForex/db.js' },
    { local: `${localDir}/apex_broker.js`, remote: '/root/AuraForex/apex_broker.js' },
    { local: `${localDir}/signals/smc_signal_engine.js`, remote: '/root/AuraForex/signals/smc_signal_engine.js' },
    { local: `${localDir}/signals/signals.js`, remote: '/root/AuraForex/signals/signals.js' },
    { local: `${localDir}/risk/risk.js`, remote: '/root/AuraForex/risk/risk.js' },
    { local: `AuraForex_V2_Local_Execution/public/AuraForex_V8_INSTITUTIONAL.ex5`, remote: '/root/AuraForex/public/AuraForex_V8_INSTITUTIONAL.ex5' },
    { local: `AuraForex_V2_Local_Execution/public/AuraForex_V8_INSTITUTIONAL.mq5`, remote: '/root/AuraForex/public/AuraForex_V8_INSTITUTIONAL.mq5' },
    { local: `${localDir}/prisma/schema.prisma`, remote: '/root/AuraForex/prisma/schema.prisma' }
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
                    // Comando para reiniciar o processo principal (aura-v2-elite controla o porto 3005)
                    conn.exec('cd /root/AuraForex && cp public/AuraForex_V8_INSTITUTIONAL.ex5 ./ && cp public/AuraForex_V8_INSTITUTIONAL.ex5 public/SMC_APEX_EA.ex5 && npx pm2 stop server; npx pm2 restart aura-v2-elite', (err, stream) => {
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
