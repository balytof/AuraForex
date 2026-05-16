const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Conectado ao VPS. Inspecionando caminhos...');
    
    conn.exec('ls -la /root/AuraForex/admin_dashboard.html && md5sum /root/AuraForex/admin_dashboard.html', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
