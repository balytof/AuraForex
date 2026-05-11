const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Limpando sinais pendentes no VPS...');
    const sql = `UPDATE "Signal" SET status = 'EXECUTED' WHERE status = 'PENDING';`;
    conn.exec(`sudo -u postgres psql -d auraforex -c "${sql}"`, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log(data.toString()));
        stream.on('close', () => {
            console.log('✅ Sinais antigos limpos. O robô deve parar de repetir agora.');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
