const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    const cmd = `sudo -u postgres psql -d auraforex -t -c 'SELECT COUNT(*) FROM "License";'`;
    conn.exec(cmd, (err, stream) => {
        stream.on('data', data => console.log('COUNT:', data.toString().trim()));
        stream.on('close', () => conn.end());
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
