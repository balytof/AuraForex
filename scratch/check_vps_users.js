const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Analisando rotas de settings no VPS...');
    const cmd = "grep -nC 5 'api/user/settings' /root/AuraForex/server.js";
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log(data.toString()));
        stream.on('close', () => conn.end());
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
