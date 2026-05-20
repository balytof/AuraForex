const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Iniciando limpeza do PM2...');
    
    const cmd = `
        echo "=== DELETANDO PROCESSOS DUPLICADOS ==="
        npx pm2 delete aura-v2-elite || true
        npx pm2 delete server || true
        
        echo "=== INICIANDO SERVIDOR ÚNICO COM CÓDIGO ATUALIZADO ==="
        cd /root/AuraForex
        npx pm2 start server.js --name server
        
        echo "=== LISTANDO PROCESSOS ATIVOS ==="
        npx pm2 list
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('✅ PM2 Limpo e reiniciado com sucesso!');
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
