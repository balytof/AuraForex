const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('ls -la /etc/nginx/sites-enabled/ && cat /etc/nginx/sites-enabled/*', (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('close', (code, signal) => {
      console.log('SITES:\n' + data.trim());
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
