const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.fastGet('/root/AuraCrypto/server.ts', './server_vps.ts', (err) => {
      if (err) throw err;
      console.log('Successfully downloaded server.ts');
      conn.end();
    });
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
