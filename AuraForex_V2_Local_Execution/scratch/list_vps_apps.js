const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('pm2 jlist', (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('close', (code, signal) => {
      try {
        const pm2List = JSON.parse(data);
        if (pm2List.length === 0) {
           console.log("No PM2 processes found.");
           conn.end();
           return;
        }
        pm2List.forEach((app, index) => {
           console.log(`[${index}] App: ${app.name}, Path: ${app.pm2_env.pm_cwd}`);
        });
        
        conn.end();

      } catch (e) {
        console.log("Error parsing pm2 jlist:", e);
        conn.end();
      }
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
