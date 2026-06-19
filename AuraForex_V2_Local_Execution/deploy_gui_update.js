const { Client } = require('ssh2');
const path = require('path');

const conn = new Client();

const remoteBaseDir = '/root/AuraForex/AuraForex_V2_Local_Execution';
const filesToUpload = [
    { local: './public/AuraForex_V8_Institutional.ex5', remote: `${remoteBaseDir}/public/AuraForex_V8_Institutional.ex5` },
    { local: './public/AuraForex_V8_Institutional.mq5', remote: `${remoteBaseDir}/public/AuraForex_V8_Institutional.mq5` },
    { local: './public/AuraGUI.mqh', remote: `${remoteBaseDir}/public/AuraGUI.mqh` },
    { local: './public/AuraMaster_Signal.ex5', remote: `${remoteBaseDir}/public/AuraMaster_Signal.ex5` },
    { local: './public/AuraCopier_Client.ex5', remote: `${remoteBaseDir}/public/AuraCopier_Client.ex5` },
    { local: './server.js', remote: `${remoteBaseDir}/server.js` },
    { local: './signals/smc_signal_engine.js', remote: `${remoteBaseDir}/signals/smc_signal_engine.js` },
    { local: './smc_bot_dashboard.html', remote: `${remoteBaseDir}/smc_bot_dashboard.html` },
    { local: './admin_dashboard.html', remote: `${remoteBaseDir}/admin_dashboard.html` },
    { local: './prisma/schema.prisma', remote: `${remoteBaseDir}/prisma/schema.prisma` }
];

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Iniciando Upload do Update Gráfico...');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        let completed = 0;
        
        function uploadNext() {
            if (completed >= filesToUpload.length) {
                console.log('✨ Todos os ficheiros enviados! A atualizar a BD e reiniciar servidor Node.js no VPS...');
                conn.exec(`cd ${remoteBaseDir} && npx prisma db push && pm2 restart server`, (err, stream) => {
                    if (err) throw err;
                    stream.on('close', (code, signal) => {
                        console.log('✅ PM2 reiniciado com código ' + code);
                        console.log('🌍 DEPLOY FINALIZADO COM SUCESSO!');
                        conn.end();
                        process.exit(0);
                    }).on('data', (data) => {
                        console.log('STDOUT: ' + data);
                    }).stderr.on('data', (data) => {
                        console.log('STDERR: ' + data);
                    });
                });
                return;
            }
            
            const file = filesToUpload[completed];
            const localPath = path.resolve(__dirname, file.local);
            console.log(`📤 Enviando: ${localPath} -> ${file.remote}`);
            
            sftp.fastPut(localPath, file.remote, (err) => {
                if (err) {
                    console.error(`❌ Erro ao enviar ${file.local}:`, err.message);
                } else {
                    console.log(`✅ ${file.local} enviado.`);
                }
                completed++;
                uploadNext();
            });
        }
        
        uploadNext();
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
