const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('🚀 Conectado ao VPS para Guia via PSQL...');
  const cmd = `psql "postgresql://aura_admin:@Infomoi2023@localhost:5432/auraforex" -c "SELECT \\"installationGuide\\" FROM \\"SystemSettings\\" LIMIT 1;"`;
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
