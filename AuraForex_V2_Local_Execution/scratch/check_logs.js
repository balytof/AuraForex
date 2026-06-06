const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH connected');
    conn.exec(
        'pm2 logs server --lines 50 --nostream 2>&1 || journalctl -u pm2 -n 50 --no-pager 2>&1',
        (err, stream) => {
            if (err) throw err;
            stream.on('close', (code) => {
                console.log('Done');
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
