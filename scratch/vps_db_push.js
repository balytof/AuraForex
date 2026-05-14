const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('🚀 Conectado ao VPS para DB Push...');
  conn.exec('cd /root/AuraForex && npx prisma db push --accept-data-loss', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('✅ DB Push concluído com código: ' + code);
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
