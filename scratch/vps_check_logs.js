const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Connected to VPS. Running commands...');
  
  // Get latest 100 lines of PM2 logs
  conn.exec('npx pm2 logs aura-v2-elite --lines 100 --raw', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      console.log('\n--- End of Logs ---');
      conn.end();
    })
    .on('data', (data) => process.stdout.write(data.toString()));
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
