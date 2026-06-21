const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

const files = [
    { local: './AuraForex_V2_Local_Execution/workers/paymentMonitor.js', remote: '/root/AuraForex/workers/paymentMonitor.js' },
    { local: './AuraForex_V2_Local_Execution/payments/cryptoGateway.js', remote: '/root/AuraForex/payments/cryptoGateway.js' }
];

conn.on('ready', () => {
    console.log('Client ready. Deploying hotfix...');
    conn.exec('mkdir -p /root/AuraForex/workers /root/AuraForex/payments', (err, stream) => {
        stream.on('close', () => {
            conn.sftp((err, sftp) => {
                if (err) throw err;
                
                let completed = 0;
                files.forEach(f => {
                    sftp.fastPut(f.local, f.remote, err => {
                        if (err) console.error(err);
                        else console.log('Uploaded ' + f.local);
                        completed++;
                        if (completed === files.length) {
                            conn.exec('npx pm2 restart aura-v2-elite', (err, stream) => {
                                stream.on('close', () => {
                                    console.log('PM2 restarted.');
                                    conn.end();
                                });
                            });
                        }
                    });
                });
            });
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
