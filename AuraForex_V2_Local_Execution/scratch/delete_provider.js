const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH connected');
    // Delete the orphan PENDING provider
    conn.exec(
        `su -c 'psql -d auraforex -c "DELETE FROM \\"Provider\\" WHERE id = '"'"'e0a4ce0c-49bc-4ec1-8821-1c3b7a77378e'"'"';"' postgres`,
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
