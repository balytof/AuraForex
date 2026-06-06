const fs = require('fs');
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('Client :: ready');
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        const remoteBaseDir = '/root/AuraForex/AuraForex_V2_Local_Execution';
        const filesToUpload = [
            { local: './public/i18n_dashboard_v3.js', remote: `${remoteBaseDir}/public/i18n_dashboard_v3.js` },
            { local: './smc_bot_dashboard.html', remote: `${remoteBaseDir}/smc_bot_dashboard.html` },
            { local: './smc/smc_bot_dashboard.html', remote: `${remoteBaseDir}/smc/smc_bot_dashboard.html` },
            { local: './affiliate_dashboard.html', remote: `${remoteBaseDir}/affiliate_dashboard.html` },
            { local: './admin_v3.html', remote: `${remoteBaseDir}/admin_v3.html` }
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
                if (err) {
                    console.log(`Error uploading ${file.local}`, err.message);
                } else {
                    console.log(`${file.local} uploaded success.`);
                }
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
