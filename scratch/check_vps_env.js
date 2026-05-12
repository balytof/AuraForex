const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🔗 Conectado ao VPS. Lendo .env...');
    conn.exec('cat /root/AuraForex/.env', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end()).on('data', (data) => {
            console.log('.env Content:\n' + data);
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
