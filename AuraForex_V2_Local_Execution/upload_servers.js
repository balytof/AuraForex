const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    console.log('Uploading server.js to AuraForex...');
    
    sftp.fastPut('./server.js', '/root/AuraForex/server.js', (err) => {
      if (err) throw err;
      console.log('server.js uploaded.');
      
      console.log('Uploading server.ts to AuraCrypto...');
      sftp.fastPut('C:/Users/Lenovo/Desktop/AuratradeCripto/Aura-Trading-Platform/server.ts', '/root/AuraCrypto/server.ts', (err) => {
        if (err) throw err;
        console.log('server.ts uploaded.');
        
        const cmd = `pm2 restart all`;
        conn.exec(cmd, (err, stream) => {
          if (err) throw err;
          stream.on('close', (code, signal) => {
            console.log('Deploy finished with code ' + code);
            conn.end();
          }).on('data', (data) => {
            console.log('STDOUT: ' + data);
          }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
          });
        });
      });
    });
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
