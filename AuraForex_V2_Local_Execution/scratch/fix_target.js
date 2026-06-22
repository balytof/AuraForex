const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const fixDbCmd = `cd /root/AuraCrypto && sqlite3 aura_trade.db "UPDATE settings SET value = 'blank' WHERE key = 'custom_button_target';"`;
  conn.exec(fixDbCmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Settings target fix finished with code', code);
      conn.end();
    }).on('data', (data) => {
      console.log('OUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('ERR: ' + data);
    });
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
