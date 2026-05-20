const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Executando check_users.js...');
    
    conn.exec('cd /root/AuraForex && node check_users.js', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.end();
        }).on('data', data => console.log(data.toString()))
          .on('stderr', data => console.error('STDERR: ' + data.toString()));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
