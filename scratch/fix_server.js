const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log('[REPAIR] Conectado ao servidor Digital Ocean.');
  const cmd = 'cd /root/AuraForex && sed -i "s/const PORT = 3006;/const PORT = 3005;/g" server.js && git pull origin main && pm2 restart all';
  console.log('[REPAIR] Executando comandos de estabilização...');
  
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('[REPAIR] Erro na execução:', err.message);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      console.log('[REPAIR] Comandos concluídos com código: ' + code);
      conn.end();
      process.exit(code);
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).on('error', (err) => {
  console.error('[REPAIR] Erro de conexão:', err.message);
  process.exit(1);
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023',
  readyTimeout: 30000
});
