const fs = require('fs');
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) throw err;
        const file = { local: './workers/paymentMonitor.js', remote: '/root/AuraForex/AuraForex_V2_Local_Execution/workers/paymentMonitor.js' };
        
        sftp.fastPut(file.local, file.remote, (err) => {
            if (err) throw err;
            console.log('Worker uploaded.');
            conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && pm2 restart server', (err, stream) => {
                if (err) throw err;
                stream.on('close', (code) => {
                    console.log('PM2 restarted. Code:', code);
                    conn.end();
                }).on('data', (data) => console.log(data.toString()));
            });
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
