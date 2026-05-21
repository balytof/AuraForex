const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    conn.exec('curl -X POST http://localhost:3000/api/bot/analyze -H "Content-Type: application/json" -d \'{"pair":"EURUSD","htfBias":"BEARISH","candles":[]}\'', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end()).on('data', d => process.stdout.write(d));
    });
}).connect({ host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023' });
