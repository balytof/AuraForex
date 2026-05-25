const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Verificando caminho do PM2...');
    
    conn.exec('pm2 info server | grep "script path" || pm2 info 0 | grep "script path" || pm2 jlist | grep -o "\\"pm2_env\\":{\\"pm_cwd\\":\\"[^\\"]*\\""', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            console.log('OUTPUT PM2 INFO:\n' + data);
        }).stderr.on('data', (data) => {
            console.error('STDERR: ' + data);
        });
    });
});

conn.connect({
    host: '141.98.24.161',
    port: 22,
    username: 'root',
    password: 'Mudar@2024$$++'
});
