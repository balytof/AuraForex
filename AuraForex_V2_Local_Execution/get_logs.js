const fs = require('fs');
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    conn.exec('cat /root/.pm2/logs/server-error.log | tail -n 50 && echo "===OUT===" && cat /root/.pm2/logs/server-out.log | tail -n 50', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.end();
        }).on('data', (data) => console.log(data.toString()))
          .stderr.on('data', (data) => console.error(data.toString()));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
