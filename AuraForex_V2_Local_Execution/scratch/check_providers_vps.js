const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('Client :: ready');
    conn.exec(`su -c 'psql -d auraforex -c "SELECT id, name, email, token, status, \\"userId\\" FROM \\"Provider\\";"' postgres`, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Command finished with code ' + code);
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT:\n' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR:\n' + data);
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
