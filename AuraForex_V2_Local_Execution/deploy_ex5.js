const { Client } = require('ssh2');
const path = require('path');

const conn = new Client();

const filesToUpload = [
    { local: './public/AuraForex_V8_Institutional.ex5', remote: '/root/AuraForex/AuraForex_V2_Local_Execution/public/AuraForex_V8_Institutional.ex5' },
    { local: './public/AuraForex_V8_Institutional.mq5', remote: '/root/AuraForex/AuraForex_V2_Local_Execution/public/AuraForex_V8_Institutional.mq5' }
];

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Iniciando Upload do EX5...');
    
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
                    console.log('✨ EX5 ATUALIZADO COM SUCESSO NO VPS!');
                    conn.end();
                    process.exit(0);
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
