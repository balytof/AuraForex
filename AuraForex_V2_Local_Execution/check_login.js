const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('curl -s http://127.0.0.1:3005/login.html | grep -i "AURATRADE" || echo "NOT FOUND"', (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('close', (code, signal) => {
      console.log('Result on 3005:\n' + data.trim());
      conn.exec('curl -s http://127.0.0.1:3000/login.html | grep -i "AURATRADE" || echo "NOT FOUND"', (err, stream2) => {
        let data2 = '';
        stream2.on('close', () => {
           console.log('Result on 3000:\n' + data2.trim());
           conn.end();
        }).on('data', d => data2 += d).stderr.on('data', d => console.log('STDERR2: ' + d));
      });
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
