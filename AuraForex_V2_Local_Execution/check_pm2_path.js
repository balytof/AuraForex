const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('pm2 jlist', (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('close', (code, signal) => {
      try {
        const pm2List = JSON.parse(data);
        for (const app of pm2List) {
          if (app.name === 'aura-crypto') {
            console.log('aura-crypto exec path:', app.pm2_env.pm_exec_path);
            console.log('aura-crypto cwd:', app.pm2_env.pm_cwd);
          }
        }
      } catch(e) {}
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
