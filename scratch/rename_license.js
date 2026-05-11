const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Renomeando ID da licença no VPS...');
    const sql = `UPDATE "License" SET id = 'AURA-V6-MASTER-2026' WHERE status = 'ACTIVE';`;
    conn.exec(`sudo -u postgres psql -d auraforex -c "${sql}"`, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log(data.toString()));
        stream.on('close', () => {
            console.log('✅ Update concluído.');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
