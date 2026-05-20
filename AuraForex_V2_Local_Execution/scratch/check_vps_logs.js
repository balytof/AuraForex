const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Buscando logs PM2...');
    conn.exec('npx pm2 logs server --lines 100 --no-colors', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.end();
            process.exit(0);
        }).on('data', (data) => console.log(data.toString()))
          .on('stderr', (data) => console.error(data.toString()));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
