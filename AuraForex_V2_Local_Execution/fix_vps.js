const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Aplicando Correções...');
    
    const envContent = `DATABASE_URL="postgresql://aura_admin:%40Infomoi2023@localhost:5432/auraforex"
JWT_SECRET="AuraForexSuperChaveSecretaDeProducao2026"
PORT=3005
`;

    conn.sftp((err, sftp) => {
        if (err) throw err;
        const stream = sftp.createWriteStream('/root/AuraForex/.env');
        stream.end(envContent);
        stream.on('close', () => {
            console.log('✅ .env atualizado com PORT=3005');
            
            // Reiniciar tudo
            conn.exec('npx pm2 delete all; cd /root/AuraForex && npx pm2 start server.js --name server && ufw allow 3005', (err, stream) => {
                if (err) throw err;
                stream.on('data', data => console.log('STDOUT: ' + data));
                stream.on('close', () => {
                    console.log('✨ VPS RECONFIGURADO COM SUCESSO!');
                    conn.end();
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
