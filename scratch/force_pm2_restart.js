const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Tentando reiniciar PM2...');
    conn.exec('pm2 restart aura-v2-elite || npx pm2 restart aura-v2-elite', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log(`Command closed with code ${code}`);
            conn.end();
            process.exit(0);
        }).on('data', (data) => {
            console.log('STDOUT: ' + data.toString());
        });
        stream.stderr.on('data', (data) => {
            console.error('STDERR: ' + data.toString());
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
