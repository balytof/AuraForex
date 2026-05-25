const { Client } = require('ssh2');
const path = require('path');

const conn = new Client();

const filesToUpload = [
    { local: './server.js', remote: '/root/AuraForex/AuraForex_V2_Local_Execution/server.js' },
    { local: './fix_db.js', remote: '/root/AuraForex/AuraForex_V2_Local_Execution/fix_db_vps.js' },
    { local: './smc_bot_dashboard.html', remote: '/root/AuraForex/AuraForex_V2_Local_Execution/smc_bot_dashboard_v3.html' }
];

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Iniciando Upload do Hotfix...');
    
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
                    console.log('🔄 Executando limpeza da DB e reiniciando o servidor PM2...');
                    conn.exec('cd /root/AuraForex && npx pm2 restart all', (err, stream) => {
                        if (err) throw err;
                        stream.on('close', () => {
                            console.log('✨ HOTFIX APLICADO COM SUCESSO!');
                            conn.end();
                            process.exit(0);
                        }).on('data', (data) => console.log('STDOUT: ' + data))
                          .stderr.on('data', (data) => console.log('STDERR: ' + data));
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
