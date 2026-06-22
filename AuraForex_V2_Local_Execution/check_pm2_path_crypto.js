const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('pm2 jlist', (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('close', (code, signal) => {
      try {
        const pm2List = JSON.parse(data);
        const cryptoApp = pm2List.find(app => app.name === 'aura-crypto');
        console.log('App PM2 details:', JSON.stringify(cryptoApp, null, 2));
      } catch (e) {
        console.log("Error parsing pm2 jlist:", e);
      }
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
