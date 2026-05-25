const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    conn.exec('tail -n 100 /root/.pm2/logs/server-out.log', (err, stream) => {
        if (err) throw err;
        let data = '';
        stream.on('data', d => data += d.toString());
        stream.on('close', () => {
            console.log('RESULT:\n', data);
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: process.env.SSH_PASSWORD || 'O+Fq5084920'
});
