const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🧹 Limpando logs e verificando PM2 no VPS...');
    // Limpar logs antigos e listar processos PM2
    conn.exec('rm /root/AuraForex/server_log.txt && npx pm2 restart all && sleep 5 && tail -n 50 /root/AuraForex/server_log.txt', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end())
              .on('data', (data) => console.log('SAÍDA VPS:\n' + data));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
