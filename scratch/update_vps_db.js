const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🔗 Conectado ao VPS. Iniciando migração da base de dados...');
    
    // Comando para atualizar o schema no VPS
    // Assumindo que o projeto está em /root/AuraForex
    const cmd = 'cd /root/AuraForex && npx prisma db push';
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log(`🏁 Migração concluída com código: ${code}`);
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
