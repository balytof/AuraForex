const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('🚀 Conectado ao VPS...');
  const userId = '5782b472-0ff0-4761-bf38-9fc149705574';
  conn.exec(`cd /root/AuraForex && node -e "const { PrismaClient } = require('@prisma/client'); new PrismaClient().user.findUnique({ where: { id: '${userId}' } }).then(u => console.log('EMAIL_FOUND:' + u.email)).catch(e => console.log(e.message))"`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
          .on('data', (data) => console.log(data.toString()));
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
