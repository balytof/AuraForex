const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Verificando server.js no VPS...');
    const cmd = "grep -n '/api/admin/plans' /root/AuraForex/server.js";
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => {
            console.log('ENCONTRADO NO VPS:');
            console.log(data.toString());
        });
        stream.on('close', () => {
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
