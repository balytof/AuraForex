const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
    console.log('Client :: ready');
    conn.exec('pm2 logs aura-v2-elite --lines 100 --nostream', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            console.log('' + data);
        }).stderr.on('data', (data) => {
            console.error('' + data);
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
