const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Verificando Logs e Firewall...');
    
    // 1. Ver logs do PM2
    conn.exec('npx pm2 logs server --lines 20 --no-daemon', (err, stream) => {
        if (err) throw err;
        console.log('--- PM2 LOGS ---');
        stream.on('close', () => {
            // 2. Ver status do Firewall
            conn.exec('ufw status', (err, stream) => {
                if (err) throw err;
                console.log('\n--- FIREWALL STATUS ---');
                stream.on('close', () => {
                    // 3. Abrir porta 3005 se necessário
                    conn.exec('ufw allow 3005', (err, stream) => {
                         if (err) throw err;
                         stream.on('close', () => {
                             console.log('\n✅ Porta 3005 aberta no UFW.');
                             conn.end();
                         }).on('data', data => console.log('UFW ALLOW: ' + data));
                    });
                }).on('data', data => console.log('UFW: ' + data));
            });
        }).on('data', (data) => {
            console.log(data.toString());
            // Se já vimos logs suficientes, podemos fechar o stream de log
            if (data.toString().includes('online') || data.toString().includes('Error')) {
                 // stream.destroy(); // Opcional
            }
        });
        
        // Timeout para fechar o log se ficar preso
        setTimeout(() => stream.end(), 5000);
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
