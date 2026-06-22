const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  const deployCmd = `cd /root/AuraCrypto && pm2 restart aura-crypto`;
  console.log("Executing:", deployCmd);
  
  conn.exec(deployCmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Deploy finished with code', code);
      conn.end();
    }).on('data', (data) => {
      console.log('DEPLOY OUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('DEPLOY ERR: ' + data);
    });
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
