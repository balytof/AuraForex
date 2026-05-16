const { Client } = require('ssh2');
const conn = new Client();

const dbUrl = "postgresql://aura_admin:%40Infomoi2023@localhost:5432/auraforex";
const sql = `UPDATE "User" SET "sponsorId" = (SELECT id FROM "User" WHERE "referralCode" = 'AURA-MASTER' LIMIT 1) WHERE "sponsorId" IS NULL AND "referralCode" != 'AURA-MASTER';`;

conn.on('ready', () => {
  console.log('Client ready');
  conn.exec(`psql "${dbUrl}" -c "${sql}"`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
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
