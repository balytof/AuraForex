const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Enviando test_time_reset.js...');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const local = path.join(__dirname, 'test_time_reset.js');
        const remote = '/root/test_time_reset.js';
        
        sftp.fastPut(local, remote, (err) => {
            if (err) throw err;
            console.log('📤 Arquivo enviado. Executando...');
            conn.exec('node /root/test_time_reset.js', (err, stream) => {
                if (err) throw err;
                stream.on('close', () => {
                    conn.end();
                }).on('data', (data) => {
                    console.log('STDOUT FROM VPS:\n' + data.toString());
                });
            });
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
