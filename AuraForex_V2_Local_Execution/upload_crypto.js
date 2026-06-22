const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    console.log('SFTP session started. Uploading dist.zip...');
    
    const readStream = fs.createReadStream('./auratradebotslast/dist.zip');
    const writeStream = sftp.createWriteStream('/root/AuraCrypto/dist.zip');
    
    writeStream.on('close', () => {
      console.log('Upload successful. Executing extraction and restart...');
      
      const cmd = `cd /root/AuraCrypto && rm -rf dist && unzip -o dist.zip -d dist && pm2 restart aura-crypto`;
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
    
    writeStream.on('error', (err) => {
       console.log("SFTP write error:", err);
       conn.end();
    });
    
    readStream.pipe(writeStream);
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
