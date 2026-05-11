const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Adicionando log de rastreio de rota no VPS...');
    
    const cmd = "sed -i 's/if (req.path.startsWith(\"\\/api\\/\")) return res.status(404).json({ error: \"API route not found\" });/if (req.path.startsWith(\"\\/api\\/\")) { console.log(\"[ROUTE-ERROR] URL não encontrada:\", req.method, req.url); return res.status(404).json({ error: \"API route not found: \" + req.method + \" \" + req.url }); }/' /root/AuraForex/server.js && npx pm2 restart aura-v2-elite";

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log(data.toString()));
        stream.on('stderr', data => console.log('ERRO:', data.toString()));
        stream.on('close', () => {
            console.log('✅ Log de rastreio ativado.');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
