const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    conn.exec('cd /root/AuraForex && node -e "const prisma = require(\'./db\'); prisma.systemSettings.findFirst().then(s => { console.log(\'DB_SETTINGS:\' + JSON.stringify(s)); process.exit(0); });"', (err, stream) => {
        stream.on('data', (d) => console.log(d.toString()));
        stream.on('close', () => conn.end());
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
