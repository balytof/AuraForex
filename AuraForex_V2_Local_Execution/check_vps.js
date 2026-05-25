const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Verificando ficheiros...');
    
    conn.exec('ls -la /root/AuraForex/smc_bot_dashboard* && grep -o "if (false)" /root/AuraForex/smc_bot_dashboard_v3.html', (err, stream) => {
        if (err) throw err;
        
        stream.on('close', (code, signal) => {
            console.log(`✨ Comandos concluídos com código ${code}`);
            conn.end();
            process.exit(0);
        }).on('data', (data) => {
            console.log('STDOUT:\n' + data);
        }).stderr.on('data', (data) => {
            console.error('STDERR:\n' + data);
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
