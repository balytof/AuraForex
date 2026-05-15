const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    console.log('🔍 Inspecionando estados de bot no VPS...');
    // Listar todos os ficheiros de estado para ver se há mistura de dados
    conn.exec('find /root/AuraForex/logs/users -name "bot_state.json" -exec grep -l "dailyProfitLocked\": true" {} +', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end())
              .on('data', (data) => console.log('Utilizadores Bloqueados no VPS:\n' + data));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
