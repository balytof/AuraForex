const { Client } = require('ssh2');

const conn = new Client();

const script = `
const pm2 = require('pm2');
pm2.connect((err) => {
  if (err) process.exit(2);
  pm2.list((err, list) => {
    list.forEach(app => {
      console.log(app.name, 'JWT_SECRET:', app.pm2_env.JWT_SECRET);
      console.log(app.name, 'SSO_SECRET:', app.pm2_env.SSO_SECRET);
    });
    pm2.disconnect();
  });
});
`;

conn.on('ready', () => {
    conn.exec(`echo "${script.replace(/"/g, '\\"')}" > /root/check_pm2_env.js && node /root/check_pm2_env.js`, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end())
        .on('data', data => process.stdout.write(data))
        .stderr.on('data', data => process.stderr.write(data));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
