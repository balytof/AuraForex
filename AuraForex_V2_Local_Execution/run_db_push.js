const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && npx prisma db push --accept-data-loss', (err, stream) => {
        if (err) throw err;
        let output = '';
        stream.on('close', (code, signal) => {
            console.log(output);
            
            // Also restart PM2 just in case
            conn.exec('pm2 restart server', (err, stream2) => {
                stream2.on('close', () => conn.end());
            });
        }).on('data', (data) => {
            output += data;
        }).stderr.on('data', (data) => {
            output += data;
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
