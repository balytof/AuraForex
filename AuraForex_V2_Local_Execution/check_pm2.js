const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Verificando PM2 info...');
    
    conn.exec('pm2 info server | grep "script path" || pm2 info 0 | grep "script path"', (err, stream) => {
        if (err) throw err;
        
        stream.on('close', (code, signal) => {
            conn.end();
            process.exit(0);
        }).on('data', (data) => {
            console.log('STDOUT:\n' + data);
        }).stderr.on('data', (data) => {
            console.error('STDERR:\n' + data);
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
