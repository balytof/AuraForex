const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const filesToUpload = [
    { local: './data/broker.js', remote: '/root/AuraForex/data/broker.js' },
    { local: './server.js', remote: '/root/AuraForex/server.js' },
    { local: './smc_bot_dashboard.html', remote: '/root/AuraForex/smc_bot_dashboard.html' },
    { local: './AURA_PRO_FINAL.mq5', remote: '/root/AuraForex/public/AURA_PRO_FINAL.mq5' }
];

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Iniciando Upload...');
    
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
                    console.log('🔄 Reiniciando servidores no VPS...');
                    conn.exec('cd /root/AuraForex && npx pm2 restart all', (err, stream) => {
                        if (err) throw err;
                        stream.on('close', () => {
                            console.log('✨ TUDO ATUALIZADO NO VPS!');
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
    password: 'Mesinfos@2020'
});
