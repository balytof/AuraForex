const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
    const hash = "$2b$10$1XUFrprfd7X7Lrdtk5Hw9eyCnugcR3gmWrL9YOEdFLV8qeQyBVwSS";
    conn.exec(`sudo -u postgres psql -d auraforex -c "UPDATE \\"User\\" SET \\"passwordHash\\" = '${hash}' WHERE email = 'balytof@gmail.com';"`, (err, stream) => {
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
