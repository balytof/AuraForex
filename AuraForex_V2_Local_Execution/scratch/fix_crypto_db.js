const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const localPath = 'C:\\Users\\Lenovo\\Desktop\\Auraforex\\auratradebotslast\\server.ts';
    const remotePath = '/root/AuraCrypto/server.ts';
    
    sftp.fastPut(localPath, remotePath, (err) => {
      if (err) throw err;
      console.log('server.ts uploaded successfully!');
      
      const fixDbCmd = `cd /root/AuraCrypto && sqlite3 aura_trade.db "DELETE FROM trades WHERE strategy_id IN (SELECT id FROM strategies WHERE name IN ('BTC Trend Follower', 'ETH Arbitrage Bot', 'SOL High Frequency')); DELETE FROM strategies WHERE name IN ('BTC Trend Follower', 'ETH Arbitrage Bot', 'SOL High Frequency');" && pm2 restart aura-crypto`;
      console.log("Executing:", fixDbCmd);
      
      conn.exec(fixDbCmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
          console.log('DB fix and restart finished with code', code);
          conn.end();
        }).on('data', (data) => {
          console.log('OUT: ' + data);
        }).stderr.on('data', (data) => {
          console.log('ERR: ' + data);
        });
      });
    });
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
