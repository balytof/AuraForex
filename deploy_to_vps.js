const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

const localDir = './AuraForex_V2_Local_Execution';

const filesToUpload = [
    { local: './AuraForex_V2_Local_Execution/server.js', remote: '/root/AuraForex/server.js' },
    { local: './AuraForex_V2_Local_Execution/hub.html', remote: '/root/AuraForex/hub.html' },
    { local: './AuraForex_V2_Local_Execution/smc_bot_dashboard.html', remote: '/root/AuraForex/smc_bot_dashboard.html' },
    { local: './AuraForex_V2_Local_Execution/admin_dashboard.html', remote: '/root/AuraForex/admin_dashboard.html' },
    { local: './AuraForex_V2_Local_Execution/affiliate_dashboard.html', remote: '/root/AuraForex/affiliate_dashboard.html' },
    { local: './AuraForex_V2_Local_Execution/login.html', remote: '/root/AuraForex/login.html' },
    { local: './AuraForex_V2_Local_Execution/ea_api.js', remote: '/root/AuraForex/ea_api.js' },
    { local: './AuraForex_V2_Local_Execution/db.js', remote: '/root/AuraForex/db.js' },
    { local: './AuraForex_V2_Local_Execution/utils/logger.js', remote: '/root/AuraForex/utils/logger.js' },
    { local: './AuraForex_V2_Local_Execution/apex_broker.js', remote: '/root/AuraForex/apex_broker.js' },
    { local: './AuraForex_V2_Local_Execution/smc/smc.js', remote: '/root/AuraForex/smc/smc.js' },
    { local: './AuraForex_V2_Local_Execution/signals/smc_signal_engine.js', remote: '/root/AuraForex/signals/smc_signal_engine.js' },
    { local: './AuraForex_V2_Local_Execution/risk/risk.js', remote: '/root/AuraForex/risk/risk.js' },
    { local: './AuraForex_V2_Local_Execution/risk/store.js', remote: '/root/AuraForex/risk/store.js' },
    { local: './AuraForex_V2_Local_Execution/public/AuraForex_V8_INSTITUTIONAL.ex5', remote: '/root/AuraForex/public/AuraForex_V8_INSTITUTIONAL.ex5' },
    { local: './AuraForex_V2_Local_Execution/public/AuraForex_V8_INSTITUTIONAL.mq5', remote: '/root/AuraForex/public/AuraForex_V8_INSTITUTIONAL.mq5' },
    { local: './AuraForex_V2_Local_Execution/JAson.mqh', remote: '/root/AuraForex/JAson.mqh' },
    { local: './AuraForex_V2_Local_Execution/public/landing.html', remote: '/root/AuraForex/public/landing.html' },
    { local: './AuraForex_V2_Local_Execution/support_api.js', remote: '/root/AuraForex/support_api.js' },
    { local: './AuraForex_V2_Local_Execution/public/i18n_dashboard.js', remote: '/root/AuraForex/public/i18n_dashboard.js' },
    { local: './AuraForex_V2_Local_Execution/public/bot-human.png', remote: '/root/AuraForex/public/bot-human.png' },
    { local: './AuraForex_V2_Local_Execution/update_db_url.js', remote: '/root/AuraForex/update_db_url.js' },
    { local: './AuraForex_V2_Local_Execution/prisma/schema.prisma', remote: '/root/AuraForex/prisma/schema.prisma' },
    { local: './AuraForex_V2_Local_Execution/workers/paymentMonitor.js', remote: '/root/AuraForex/workers/paymentMonitor.js' },
    { local: './AuraForex_V2_Local_Execution/payments/cryptoGateway.js', remote: '/root/AuraForex/payments/cryptoGateway.js' },
    { local: './crypto_deploy.zip', remote: '/root/AuraForex/crypto_deploy.zip' }
];

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS (139.59.159.48). Iniciando Upload Full (Forex + Crypto)...');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        let completed = 0;
        filesToUpload.forEach(file => {
            const localPath = path.resolve(__dirname, file.local);
            
            if (!fs.existsSync(localPath)) {
                console.warn(`⚠️ Ficheiro não encontrado localmente, saltando: ${localPath}`);
                completed++;
                checkComplete();
                return;
            }

            console.log(`📤 Enviando: ${file.local} -> ${file.remote}`);
            
            sftp.fastPut(localPath, file.remote, (err) => {
                if (err) {
                    console.error(`❌ Erro ao enviar ${file.local}:`, err.message);
                } else {
                    console.log(`✅ ${file.local} enviado com sucesso.`);
                }
                
                completed++;
                checkComplete();
            });
        });

        function checkComplete() {
            if (completed === filesToUpload.length) {
                console.log('🔄 Atualizando DB e reiniciando servidores no VPS via PM2...');
                const cmd = `
                    cd /root/AuraForex && npx prisma db push && npx prisma generate && (npx pm2 restart aura-v2-elite || npx pm2 start server.js --name aura-v2-elite) && 
                    mkdir -p /root/AuraCrypto && unzip -o /root/AuraForex/crypto_deploy.zip -d /root/AuraCrypto && cd /root/AuraCrypto && npm install && (npx pm2 restart aura-crypto || npx pm2 start "npx tsx server.ts" --name aura-crypto)
                `;
                conn.exec(cmd, (err, stream) => {
                    if (err) throw err;
                    stream.on('close', () => {
                        console.log('✨ TUDO ATUALIZADO E REINICIADO NO VPS!');
                        conn.end();
                        process.exit(0);
                    }).on('data', (data) => console.log('STDOUT: ' + data)).stderr.on('data', data => console.error('STDERR: ' + data));
                });
            }
        }
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
