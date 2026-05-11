const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Caçando sinal fantasma no VPS...');
    
    // 1. Verificar na DB
    const sql = `SELECT id, status, "userId" FROM "Signal" WHERE id = 'e6bf7d31-b003-4b2a-bd71-7d3dd5aa1630';`;
    conn.exec(`sudo -u postgres psql -d auraforex -c "${sql}"`, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => {
            console.log('RESULTADO DB:');
            console.log(data.toString());
        });
        stream.on('close', () => {
            // 2. Verificar nos ficheiros do servidor
            const cmd = "grep -r 'e6bf7d31-b003-4b2a-bd71-7d3dd5aa1630' /root/AuraForex/";
            conn.exec(cmd, (err2, stream2) => {
                if (err2) throw err2;
                stream2.on('data', data => {
                    console.log('ENCONTRADO NO CÓDIGO:');
                    console.log(data.toString());
                });
                stream2.on('close', () => conn.end());
            });
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
