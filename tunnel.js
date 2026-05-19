const { Client } = require('ssh2');
const net = require('net');

const conn = new Client();
conn.on('ready', () => {
  console.log('🚀 SSH Tunnel connected to VPS!');
  
  net.createServer((sock) => {
    conn.forwardOut('127.0.0.1', sock.remotePort, '127.0.0.1', 5432, (err, stream) => {
      if (err) {
        console.error('Tunnel error:', err.message);
        sock.end();
        return;
      }
      sock.pipe(stream).pipe(sock);
    });
  }).listen(5433, '127.0.0.1', () => {
    console.log('✅ Local port forward established: localhost:5433 -> VPS localhost:5432');
  });
}).on('error', (err) => {
  console.error('SSH Connection error:', err.message);
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
