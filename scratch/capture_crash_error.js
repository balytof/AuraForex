const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Executando server.js manualmente para ver o erro...');
    const cmd = "cd /root/AuraForex && node server.js";
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log('STDOUT:', data.toString()));
        stream.on('stderr', data => console.error('STDERR:', data.toString()));
        stream.on('close', () => {
            console.log('--- PROCESSO TERMINOU ---');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
