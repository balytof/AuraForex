const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const fixCmd = `cp /root/AuraForex/.env /root/AuraForex/AuraForex_V2_Local_Execution/.env && cd /root/AuraForex/AuraForex_V2_Local_Execution && pm2 restart server`;
  conn.exec(fixCmd, (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('close', (code, signal) => {
      console.log('Result:\n' + data.trim());
      conn.end();
    }).on('data', (d) => {
      data += d.toString();
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
