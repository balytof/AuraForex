const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    conn.exec('cat /root/AuraForex/AuraForex_V2_Local_Execution/logs/users/5782b472-0ff0-4761-bf38-9fc149705574/trade_history.json', (err, stream) => {
        if (err) throw err;
        let dataStr = '';
        stream.on('close', (code, signal) => {
            console.log('--- FILE CONTENT ---');
            console.log(dataStr ? dataStr.substring(0, 1000) : 'FILE IS EMPTY OR DOES NOT EXIST');
            conn.end();
        }).on('data', (data) => {
            dataStr += data.toString();
        }).stderr.on('data', (data) => {
            console.log('STDERR:', data.toString());
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
