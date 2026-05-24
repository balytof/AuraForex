const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('pm2 jlist', (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('close', (code, signal) => {
      try {
        const pm2List = JSON.parse(data);
        console.log("Found PM2 processes:");
        pm2List.forEach((p, i) => {
            console.log(`[${i}] Name: ${p.name}, CWD: ${p.pm2_env.pm_cwd}, Status: ${p.pm2_env.status}, RestartTime: ${p.pm2_env.restart_time}`);
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
