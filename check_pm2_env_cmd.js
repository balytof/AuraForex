const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
    conn.exec('npx pm2 env 1 | grep SECRET && npx pm2 env 2 | grep SECRET', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end())
        .on('data', data => process.stdout.write(data))
        .stderr.on('data', data => process.stderr.write(data));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
