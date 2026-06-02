const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('Client :: ready');
    conn.exec('pm2 logs server --lines 100 --nostream', (err, stream) => {
        if (err) throw err;
        let dataStr = '';
        stream.on('close', (code, signal) => {
            console.log('--- LOGS START ---');
            console.log(dataStr);
            console.log('--- LOGS END ---');
            conn.end();
        }).on('data', (data) => {
            dataStr += data.toString();
        }).stderr.on('data', (data) => {
            dataStr += data.toString();
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
