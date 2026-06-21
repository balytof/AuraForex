const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

const files = [
    { local: './AuraForex_V2_Local_Execution/workers/paymentMonitor.js', remote: '/root/AuraForex/workers/paymentMonitor.js' },
    { local: './AuraForex_V2_Local_Execution/payments/cryptoGateway.js', remote: '/root/AuraForex/payments/cryptoGateway.js' }
];

conn.on('ready', () => {
    console.log('Client ready. Deploying hotfix...');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        let completed = 0;
        files.forEach(f => {
            sftp.fastPut(f.local, f.remote, err => {
                if (err) console.error("Error uploading", f.local, err.message);
                else console.log('Uploaded ' + f.local);
                completed++;
                if (completed === files.length) {
                    console.log('Restarting PM2...');
                    conn.exec('npx pm2 restart aura-v2-elite', (err, stream) => {
                        if (err) throw err;
                        stream.on('close', () => {
                            console.log('PM2 restarted.');
                            conn.end();
                        }).on('data', data => console.log('STDOUT: ' + data))
                        .stderr.on('data', data => console.error('STDERR: ' + data));
                    });
                }
            });
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
