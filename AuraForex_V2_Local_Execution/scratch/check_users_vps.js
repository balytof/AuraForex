const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('Client :: ready');
    conn.exec(`su -c 'psql -d auraforex -c "SELECT u.id, u.email, p.id as p_id, p.status as p_status FROM \\"User\\" u LEFT JOIN \\"Provider\\" p ON u.id = p.\\"userId\\";"' postgres`, (err, stream) => {
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
