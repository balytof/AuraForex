const fs = require('fs');
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('Client :: ready');
    
    // Step 1: Create folders
    conn.exec('mkdir -p /root/AuraForex/AuraForex_V2_Local_Execution/payments /root/AuraForex/AuraForex_V2_Local_Execution/workers', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log('Folders created. Code:', code);
            startUploads();
        }).on('data', (data) => console.log('STDOUT:', data.toString()))
          .stderr.on('data', (data) => console.error('STDERR:', data.toString()));
    });

    function startUploads() {
        conn.sftp((err, sftp) => {
            if (err) throw err;
            
            const remoteBaseDir = '/root/AuraForex/AuraForex_V2_Local_Execution';
            const filesToUpload = [
                { local: './server.js', remote: `${remoteBaseDir}/server.js` },
                { local: './ea_api.js', remote: `${remoteBaseDir}/ea_api.js` },
                { local: './admin_dashboard.html', remote: `${remoteBaseDir}/admin_dashboard.html` },
                { local: './smc_bot_dashboard.html', remote: `${remoteBaseDir}/smc_bot_dashboard.html` },
                { local: './public/i18n_dashboard.js', remote: `${remoteBaseDir}/public/i18n_dashboard.js` },
                { local: './risk/store.js', remote: `${remoteBaseDir}/risk/store.js` },
                { local: './risk/risk.js', remote: `${remoteBaseDir}/risk/risk.js` },
                { local: './prisma/schema.prisma', remote: `${remoteBaseDir}/prisma/schema.prisma` },
                { local: './payments/cryptoGateway.js', remote: `${remoteBaseDir}/payments/cryptoGateway.js` },
                { local: './workers/paymentMonitor.js', remote: `${remoteBaseDir}/workers/paymentMonitor.js` }
            ];

            let uploadsCompleted = 0;

            function uploadNext() {
                if (uploadsCompleted >= filesToUpload.length) {
                    console.log('All uploads complete. Installing dependencies...');
                    installDeps();
                    return;
                }

                const file = filesToUpload[uploadsCompleted];
                console.log(`Uploading ${file.local}...`);
                sftp.fastPut(file.local, file.remote, (err) => {
                    if (err) {
                        console.error('Upload failed:', err.message);
                        conn.end();
                        return;
                    }
                    console.log(`${file.local} uploaded success.`);
                    uploadsCompleted++;
                    uploadNext();
                });
            }

            uploadNext();
        });
    }

    function installDeps() {
        conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && npm install ethers node-cron', (err, stream) => {
            if (err) throw err;
            stream.on('close', (code) => {
                console.log('Dependencies installed. Code:', code);
                pushDb();
            }).on('data', (data) => console.log('NPM:', data.toString()))
              .stderr.on('data', (data) => console.error('NPM ERR:', data.toString()));
        });
    }

    function pushDb() {
        conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && npx prisma generate && npx prisma db push --accept-data-loss', (err, stream) => {
            if (err) throw err;
            stream.on('close', (code) => {
                console.log('Prisma pushed. Code:', code);
                restartPm2();
            }).on('data', (data) => console.log('PRISMA:', data.toString()))
              .stderr.on('data', (data) => console.error('PRISMA ERR:', data.toString()));
        });
    }

    function restartPm2() {
        conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && pm2 restart server', (err, stream) => {
            if (err) throw err;
            stream.on('close', (code) => {
                console.log('PM2 restarted with code ' + code);
                conn.end();
            }).on('data', (data) => console.log('PM2:', data.toString()))
              .stderr.on('data', (data) => console.error('PM2 ERR:', data.toString()));
        });
    }

}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
