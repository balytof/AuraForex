const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Verificando porta 3005 no VPS...');
    const cmd = "netstat -tuln | grep 3005";
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log('PORTA ATIVA:', data.toString()));
        stream.on('close', () => {
            console.log('--- FIM ---');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
