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
            conn.exec('cd /root/AuraCrypto && rm -rf dist && unzip -o dist.zip', (err, stream) => {
                if (err) throw err;
                stream.on('data', d => console.log(d.toString()));
                stream.on('close', () => {
                    console.log('AuraCrypto unzipped.');
                    
                    const cryptoServerRead = fs.createReadStream('AuraCrypto_Temp/server.ts');
                    const cryptoServerWrite = sftp.createWriteStream('/root/AuraCrypto/server.ts');
                    
                    cryptoServerWrite.on('close', () => {
                        console.log('AuraCrypto server.ts uploaded.');
                        conn.exec('cd /root/AuraCrypto && npx pm2 restart aura-crypto', (err2, stream2) => {
                            if (err2) throw err2;
                            stream2.on('data', d => console.log(d.toString()));
                            stream2.on('close', () => {
                                console.log('AuraCrypto restarted.');
                                
                                const htmlRead = fs.createReadStream('AuraForex_V2_Local_Execution/smc_bot_dashboard.html');
                                const htmlWrite = sftp.createWriteStream('/root/AuraForex/smc_bot_dashboard.html');
                                
                                htmlWrite.on('close', () => {
                                    console.log('AuraForex dashboard uploaded.');
                                    const serverRead = fs.createReadStream('AuraForex_V2_Local_Execution/server.js');
                                    const serverWrite = sftp.createWriteStream('/root/AuraForex/server.js');
                                    serverWrite.on('close', () => {
                                        console.log('AuraForex server.js uploaded.');
                                        conn.exec('cd /root/AuraForex && npx pm2 restart aura-v2-elite', (err, stream) => {
                                            if (err) throw err;
                                            stream.on('data', d => console.log(d.toString()));
                                            stream.on('close', () => {
                                                console.log('AuraForex server restarted.');
                                                conn.end();
                                            });
                                        });
                                    });
                                    serverRead.pipe(serverWrite);
                                });
                                htmlRead.pipe(htmlWrite);
                            });
                        });
                    });
                    cryptoServerRead.pipe(cryptoServerWrite);
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
