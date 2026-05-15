const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    conn.exec('npx pm2 list', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end())
              .on('data', (data) => console.log('PM2 LIST:\n' + data));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
