const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Procurando por lógica de limite no VPS...');
    // Procurar por "limit" ignorando maiúsculas/minúsculas
    const cmd = "grep -ri 'limit' /root/AuraForex/ | grep -v 'node_modules' | head -n 50";
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log(data.toString()));
        stream.on('close', () => conn.end());
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
