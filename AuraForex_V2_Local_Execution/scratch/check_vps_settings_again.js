const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('sqlite3 /root/AuraCrypto/aura_trade.db "SELECT * FROM settings;"', (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('close', (code, signal) => {
      console.log('OUT:', data);
      conn.end();
    }).on('data', (d) => {
      data += d.toString();
    }).stderr.on('data', (d) => {
      console.log('ERR:', d.toString());
    });
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
