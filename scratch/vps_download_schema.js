const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

conn.on('ready', () => {
  console.log('Connected to VPS. Fetching remote schema...');
  
  conn.exec(`cat /root/AuraForex/prisma/schema.prisma`, (err, stream) => {
    if (err) throw err;
    let content = '';
    stream.on('close', () => {
      console.log('Remote schema fetched.');
      
      // Inject botStatus String @default("stopped") into UserSettings model if not present
      if (!content.includes('botStatus')) {
        console.log('Injecting botStatus into UserSettings...');
        content = content.replace(
          /model UserSettings {([^}]+)}/,
          (match, p1) => {
            // Find activePairs or geminiKey and insert after it
            if (p1.includes('geminiKey')) {
              return `model UserSettings {${p1}  botStatus   String   @default("stopped")\n}`;
            } else {
              return `model UserSettings {${p1}  botStatus   String   @default("stopped")\n}`;
            }
          }
        );
      }
      
      fs.writeFileSync('prisma/schema.prisma', content);
      console.log('Saved merged schema to prisma/schema.prisma');
      conn.end();
    })
    .on('data', (data) => {
      content += data.toString();
    })
    .stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
