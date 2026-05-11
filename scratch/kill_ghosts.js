const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Limpeza total de processos fantasma...');
    
    // Matar tudo o que cheira a Node ou PM2 e reiniciar do zero
    const cmd = "pm2 stop all && pm2 delete all && pkill -f node && cd /root/AuraForex && npx pm2 start server.js --name aura-v2-elite";

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log(data.toString()));
        stream.on('stderr', data => console.error(data.toString()));
        stream.on('close', () => {
            console.log('✨ Servidor reiniciado do ZERO. Se o sinal continuar, o problema está no robô/MT5.');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
