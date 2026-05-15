const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🚑 Recuperando servidor no VPS...');
    // Mostrar logs de erro do PM2 e reiniciar o servidor principal
    conn.exec('npx pm2 logs server --lines 20 --no-colors', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            // Reiniciar tudo para garantir a porta 3005
            conn.exec('npx pm2 start 0 && npx pm2 restart 1', () => conn.end());
        }).on('data', (data) => console.log('LOGS DE ERRO PM2:\n' + data));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
