const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.stat('/root/AuraForex/public/SMC_APEX_EA.ex5', (err, stats) => {
            if (err) console.log('❌ SMC_APEX_EA.ex5 ainda não existe');
            else console.log('✅ SMC_APEX_EA.ex5 existe e tem ' + stats.size + ' bytes');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
