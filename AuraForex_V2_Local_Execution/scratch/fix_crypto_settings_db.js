const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const fixDbCmd = `cd /root/AuraCrypto && sqlite3 aura_trade.db "UPDATE settings SET value = 'true' WHERE key = 'custom_button_enabled'; UPDATE settings SET value = 'https://auratradebots.com' WHERE key = 'custom_button_url'; UPDATE settings SET value = 'Forex Hub' WHERE key = 'custom_button_label';"`;
  conn.exec(fixDbCmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Settings fix finished with code', code);
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
