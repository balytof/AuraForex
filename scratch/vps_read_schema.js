const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Connected to VPS. Reading schema...');
  
  conn.exec(`cat /root/AuraForex/prisma/schema.prisma`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
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
