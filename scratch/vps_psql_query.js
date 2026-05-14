const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('🚀 Conectado ao VPS para PSQL...');
  const query = `SELECT u.email, l.balance, l."updatedAt" FROM \\"User\\" u JOIN \\"License\\" l ON u.id = l.\\"userId\\" ORDER BY l.\\"updatedAt\\" DESC LIMIT 5;`;
  const cmd = `psql "postgresql://aura_admin:@Infomoi2023@localhost:5432/auraforex" -c "${query}"`;
  conn.exec(cmd, (err, stream) => {
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
