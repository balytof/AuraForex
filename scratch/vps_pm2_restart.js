const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Connected to VPS. Hard-resetting PM2...');
  
  conn.exec(`cd /root/AuraForex && npx pm2 stop aura-v2-elite && npx pm2 delete aura-v2-elite && npx pm2 start server.js --name aura-v2-elite`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      console.log('PM2 hard-reset completed.');
      conn.end();
    })
    .on('data', (data) => process.stdout.write(data.toString()))
    .stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
