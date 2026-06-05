const fs = require('fs');
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('Client :: ready');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        const remoteBaseDir = '/root/AuraForex/AuraForex_V2_Local_Execution';
        const filesToUpload = [
            { local: './server.js', remote: `${remoteBaseDir}/server.js` },
            { local: './ea_api.js', remote: `${remoteBaseDir}/ea_api.js` },
            { local: './admin_dashboard.html', remote: `${remoteBaseDir}/admin_dashboard.html` },
            { local: './smc_bot_dashboard.html', remote: `${remoteBaseDir}/smc_bot_dashboard.html` },
            { local: './affiliate_dashboard.html', remote: `${remoteBaseDir}/affiliate_dashboard.html` },
            { local: './public/i18n_dashboard.js', remote: `${remoteBaseDir}/public/i18n_dashboard.js` },
            { local: './risk/store.js', remote: `${remoteBaseDir}/risk/store.js` },
            { local: './risk/risk.js', remote: `${remoteBaseDir}/risk/risk.js` },
            { local: './prisma/schema.prisma', remote: `${remoteBaseDir}/prisma/schema.prisma` },
            { local: './payments/cryptoGateway.js', remote: `${remoteBaseDir}/payments/cryptoGateway.js` },
            { local: './workers/paymentMonitor.js', remote: `${remoteBaseDir}/workers/paymentMonitor.js` },
            { local: './public/AuraForex_V8_INSTITUTIONAL.ex5', remote: `${remoteBaseDir}/public/AuraForex_V8_INSTITUTIONAL.ex5` },
            { local: './public/AuraForex_V8_INSTITUTIONAL.mq5', remote: `${remoteBaseDir}/public/AuraForex_V8_INSTITUTIONAL.mq5` }
        ];

        let uploadsCompleted = 0;

        function uploadNext() {
            if (uploadsCompleted >= filesToUpload.length) {
                console.log('All uploads complete. Restarting PM2...');
                conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && pm2 restart server', (err, stream) => {
                    if (err) throw err;
                    stream.on('close', (code, signal) => {
                        console.log('PM2 restarted with code ' + code);
                        conn.end();
                    }).on('data', (data) => {
                        console.log('STDOUT: ' + data);
                    }).stderr.on('data', (data) => {
                        console.log('STDERR: ' + data);
                    });
                });
                return;
            }

            const file = filesToUpload[uploadsCompleted];
            console.log(`Uploading ${file.local}...`);
            sftp.fastPut(file.local, file.remote, (err) => {
                if (err) throw err;
                console.log(`${file.local} uploaded success.`);
                uploadsCompleted++;
                uploadNext();
            });
        }

        uploadNext();
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
