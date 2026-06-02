const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('Running npx prisma db push on VPS...');
    conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && npx prisma db push', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Prisma push exited with code', code);
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT:', data.toString());
        }).stderr.on('data', (data) => {
            console.log('STDERR:', data.toString());
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
