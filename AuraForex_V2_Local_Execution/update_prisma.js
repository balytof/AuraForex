const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('Client :: ready');
    conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && npx prisma db push && npx prisma generate && pm2 restart server', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Finished with code ' + code);
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
