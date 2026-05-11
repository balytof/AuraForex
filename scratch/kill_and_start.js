const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Libertando a porta 3005...');
    const cmd = "fuser -k 3005/tcp && sleep 2 && cd /root/AuraForex && pm2 start server.js --name aura-v2-elite";
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log(data.toString()));
        stream.on('stderr', data => console.error(data.toString()));
        stream.on('close', () => {
            console.log('✅ Porta libertada e servidor reiniciado!');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
