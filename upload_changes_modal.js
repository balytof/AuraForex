const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) throw err;

        // Upload dist.zip for AuraCrypto
        const distRead = fs.createReadStream('AuraCrypto_Temp/dist.zip');
        const distWrite = sftp.createWriteStream('/root/AuraCrypto/dist.zip');
        
        distWrite.on('close', () => {
            console.log('AuraCrypto frontend uploaded. Unzipping...');
            conn.exec('cd /root/AuraCrypto && rm -rf dist && unzip -o dist.zip && npx pm2 restart aura-crypto', (err, stream) => {
                if (err) throw err;
                stream.on('data', d => console.log(d.toString()));
                stream.on('close', () => {
                    console.log('AuraCrypto restarted.');
                    
                    // Upload smc_bot_dashboard.html for AuraForex
                    const htmlRead = fs.createReadStream('AuraForex_V2_Local_Execution/smc_bot_dashboard.html');
                    const htmlWrite = sftp.createWriteStream('/root/AuraForex/smc_bot_dashboard.html');
                    
                    htmlWrite.on('close', () => {
                        console.log('AuraForex dashboard uploaded.');
                        conn.end();
                    });
                    
                    htmlRead.pipe(htmlWrite);
                });
            });
        });
        
        distRead.pipe(distWrite);
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
