const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Atualizando esquema do Prisma no VPS...');
    const cmd = `
        sed -i '/geminiKey   String?/a \\  orderLimit  Int      @default(4)' /root/AuraForex/prisma/schema.prisma &&
        cd /root/AuraForex &&
        npx prisma db push
    `;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log(data.toString()));
        stream.on('stderr', data => console.error(data.toString()));
        stream.on('close', () => {
            console.log('✅ Base de dados atualizada!');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
