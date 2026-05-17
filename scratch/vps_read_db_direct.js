const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('🚀 Conectado ao VPS...');
  const cmd = `export PGPASSWORD='@Infomoi2023' && psql -h localhost -U aura_admin -d auraforex -c "SELECT \\"apiUrl\\", \\"installationGuide\\" FROM \\"SystemSettings\\" LIMIT 1;"`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    let errOut = '';
    stream.on('close', () => {
      console.log('OUTPUT FROM VPS DB:\n', out);
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
