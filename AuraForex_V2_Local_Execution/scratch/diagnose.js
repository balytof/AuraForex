const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Executando diagnóstico detalhado...');
    
    // Executar comando para ver processos PM2 e o que está usando a porta 3005
    const cmd = `
        echo "=== PM2 LIST ===" && npx pm2 list && \
        echo "=== PORT 3005 OWNER ===" && (netstat -tulpn | grep 3005 || lsof -i :3005 || echo "Porta 3005 livre ou netstat/lsof ausente") && \
        echo "=== NODE PROCESSES ===" && ps aux | grep node
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.end();
        }).on('data', data => console.log(data.toString()))
          .on('stderr', data => console.error('STDERR: ' + data.toString()));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
