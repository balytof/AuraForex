const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const conn = new Client();

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Enviando test_prisma_query.js...');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        const localPath = path.resolve(__dirname, 'test_prisma_query.js');
        const remotePath = '/root/AuraForex/test_prisma_query.js';
        
        sftp.fastPut(localPath, remotePath, (err) => {
            if (err) throw err;
            console.log('✅ test_prisma_query.js enviado. Executando...');
            
            conn.exec('cd /root/AuraForex && node test_prisma_query.js', (err, stream) => {
                if (err) throw err;
                stream.on('close', () => {
                    conn.end();
                }).on('data', data => console.log(data.toString()))
                  .on('stderr', data => console.error('STDERR: ' + data.toString()));
            });
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
