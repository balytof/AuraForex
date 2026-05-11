const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Atualizando a rota de settings no server.js do VPS...');
    // Usando sed para adicionar orderLimit na desestruturação e no update/create do prisma
    const cmd = `
        sed -i 's/const { risk, score, interval, activePairs, geminiKey } = req.body;/const { risk, score, interval, activePairs, geminiKey, orderLimit } = req.body;/g' /root/AuraForex/server.js &&
        sed -i '/update: {/a \\        orderLimit: orderLimit ? parseInt(orderLimit) : undefined,' /root/AuraForex/server.js &&
        sed -i '/create: {/a \\        orderLimit: orderLimit ? parseInt(orderLimit) : 4,' /root/AuraForex/server.js &&
        pm2 restart aura-v2-elite
    `;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log(data.toString()));
        stream.on('stderr', data => console.error(data.toString()));
        stream.on('close', () => {
            console.log('✅ Servidor atualizado e reiniciado!');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
