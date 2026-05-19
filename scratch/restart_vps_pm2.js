const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('🚀 Conectado ao VPS...');
  const cmd = `cd /root/AuraForex && npx prisma generate && npx pm2 restart aura-v2-elite`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    let errOut = '';
    stream.on('close', () => {
      console.log('OUTPUT FROM VPS GENERATE/RESTART:\n', out);
      if (errOut) console.log('ERRORS:\n', errOut);
      conn.end();
    }).on('data', (data) => {
      out += data.toString();
    }).stderr.on('data', (data) => {
      errOut += data.toString();
    });
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
