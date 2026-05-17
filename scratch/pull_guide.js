const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

conn.on('ready', () => {
  const query = `SELECT \\"installationGuide\\" FROM \\"SystemSettings\\" LIMIT 1;`;
  // Using \pset format unaligned and tuples_only to get clean output
  const cmd = `psql "postgresql://aura_admin:@Infomoi2023@localhost:5432/auraforex" -t -A -c "${query}"`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let dataOut = '';
    stream.on('close', () => {
        fs.writeFileSync('guide_out.html', dataOut);
        console.log('Saved to guide_out.html');
        conn.end();
    }).on('data', (data) => {
        dataOut += data.toString();
    });
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
