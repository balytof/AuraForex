const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const readStream = fs.createReadStream('scratch/vps_script_pull_guide.js');
    const writeStream = sftp.createWriteStream('/root/AuraForex/pull_guide.js');
    writeStream.on('close', () => {
      conn.exec('cd /root/AuraForex && node pull_guide.js && cat /root/guide_out.html', (err, stream) => {
        if (err) throw err;
        let output = '';
        stream.on('close', () => {
          fs.writeFileSync('guide_out.html', output);
          console.log('Saved to guide_out.html local');
          conn.end();
        }).on('data', (data) => {
          output += data.toString();
        }).stderr.on('data', data => console.error(data.toString()));
      });
    });
    readStream.pipe(writeStream);
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
