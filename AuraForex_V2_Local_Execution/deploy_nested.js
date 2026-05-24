const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  
  // We want to delete the old pm2 process and start the new one from the subfolder
  const deployCmd = `pm2 delete server || true && cd /root/AuraForex/AuraForex_V2_Local_Execution && npm install && pm2 start server.js --name "server" && pm2 save`;
  
  console.log("Executing:", deployCmd);
  
  conn.exec(deployCmd, (err, deployStream) => {
     if (err) throw err;
     deployStream.on('close', (code, signal) => {
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
