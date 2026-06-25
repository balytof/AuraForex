const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    conn.exec('sudo -u postgres psql -d auraforex -c "SELECT id, status, type FROM \\"License\\" WHERE \\"userId\\"=\'5782b472-0ff0-4761-bf38-9fc149705574\';"', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
            process.exit(0);
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.error('STDERR: ' + data);
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
