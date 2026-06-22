const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
sed -i 's/proxy_pass http:\\/\\/localhost:3000;/proxy_pass http:\\/\\/127.0.0.1:3000;/g' /etc/nginx/sites-available/auracrypto
nginx -t && systemctl reload nginx
`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
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
