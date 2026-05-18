const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Lendo bot_state.json...');
    conn.exec('cat /root/AuraForex/logs/users/5782b472-0ff0-4761-bf38-9fc149705574/bot_state.json', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.end();
            process.exit(0);
        }).on('data', (data) => {
            console.log(data.toString());
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
