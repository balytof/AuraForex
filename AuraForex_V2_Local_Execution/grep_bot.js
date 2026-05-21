const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    conn.exec('pm2 logs server --lines 500 --nostream', (err, stream) => {
        if (err) throw err;
        let data = '';
        stream.on('close', () => {
            console.log(data.split('\n').filter(l => l.includes('[BOT]')).join('\n'));
            conn.end();
        }).on('data', (d) => data += d);
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
