const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH connected');
    conn.exec(
        `su -c 'psql -d auraforex -c "SELECT id, status, name, \\"userId\\" FROM \\"Provider\\";"' postgres`,
        (err, stream) => {
            if (err) throw err;
            stream.on('close', (code) => {
                console.log('Done, code:', code);
                conn.end();
            }).on('data', (data) => {
                process.stdout.write(data.toString());
            }).stderr.on('data', (data) => {
                process.stderr.write(data.toString());
            });
        }
    );
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
