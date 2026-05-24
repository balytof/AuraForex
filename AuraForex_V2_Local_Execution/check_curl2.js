const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('curl -s http://127.0.0.1:3000/smc_bot_dashboard.html | grep -o "google_translate" || echo "NOT FOUND"', (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('close', (code, signal) => {
      console.log('Result: ' + data.trim());
      conn.end();
    }).on('data', (d) => {
      data += d.toString();
    });
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
