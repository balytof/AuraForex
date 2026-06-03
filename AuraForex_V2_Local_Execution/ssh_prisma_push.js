const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Connected to VPS. Uploading schema.prisma...');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        sftp.fastPut('./prisma/schema.prisma', '/root/AuraForex/AuraForex_V2_Local_Execution/prisma/schema.prisma', (err) => {
            if (err) throw err;
            console.log('✅ schema.prisma uploaded successfully.');
            
            console.log('Running npx prisma generate && npx prisma db push on VPS...');
            conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && npx prisma generate && npx prisma db push', (err, stream) => {
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
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
