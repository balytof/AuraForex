const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Client ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.fastPut('c:\\Users\\Lenovo\\Desktop\\Auraforex\\fix_affiliates.sql', '/root/AuraForex/fix_affiliates.sql', (err2) => {
      if (err2) throw err2;
      console.log('SQL file uploaded');
      conn.exec('psql "postgresql://aura_admin:%40Infomoi2023@localhost:5432/auraforex" -f /root/AuraForex/fix_affiliates.sql', (err3, stream) => {
        if (err3) throw err3;
        stream.on('close', (code) => {
          console.log('psql closed with code ' + code);
          conn.end();
        }).on('data', (data) => {
          console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
          console.log('STDERR: ' + data);
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
