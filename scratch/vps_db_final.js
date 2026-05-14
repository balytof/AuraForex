const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('🚀 Conectado ao VPS para DB Push e Generate...');
  // Running push and then generate. Push usually triggers generate but let's be sure.
  conn.exec('cd /root/AuraForex && npx prisma db push --accept-data-loss && npx prisma generate', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      console.log('✅ Comandos concluídos com código: ' + code);
      // Reiniciar PM2 para garantir que o novo Prisma Client seja carregado
      conn.exec('npx pm2 restart aura-v2-elite', () => {
          conn.end();
      });
    }).on('data', (data) => console.log(data.toString()));
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
