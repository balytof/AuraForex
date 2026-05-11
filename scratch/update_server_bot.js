const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Atualizando server.js para suportar botRunning...');
    const cmd = `
        sed -i 's/orderLimit } = req.body;/orderLimit, botRunning } = req.body;/g' /root/AuraForex/server.js &&
        sed -i '/orderLimit: orderLimit ? parseInt(orderLimit) : undefined,/a \\        botRunning: botRunning !== undefined ? (botRunning === true || botRunning === "true") : undefined,' /root/AuraForex/server.js &&
        sed -i '/orderLimit: orderLimit ? parseInt(orderLimit) : 4,/a \\        botRunning: botRunning !== undefined ? (botRunning === true || botRunning === "true") : false,' /root/AuraForex/server.js &&
        pm2 restart aura-v2-elite
    `;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log(data.toString()));
        stream.on('stderr', data => console.error(data.toString()));
        stream.on('close', () => {
            console.log('✅ Servidor atualizado!');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
