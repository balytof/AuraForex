const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('🚀 Conectado ao VPS para Atualizar Config...');
  const newUrl = 'https://www.auratradebots.com/api';
  
  const nodeScript = `
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    async function main() {
      try {
        const settings = await prisma.systemSettings.findFirst();
        if (settings) {
          await prisma.systemSettings.update({
            where: { id: settings.id },
            data: { apiUrl: '${newUrl}' }
          });
          require('fs').writeFileSync('update_status.txt', 'SUCCESS: API URL updated to ${newUrl}');
        } else {
          // Create if not exists
          await prisma.systemSettings.create({
            data: { apiUrl: '${newUrl}' }
          });
          require('fs').writeFileSync('update_status.txt', 'SUCCESS: Created settings with ${newUrl}');
        }
      } catch (e) {
        require('fs').writeFileSync('update_status.txt', 'ERROR: ' + e.message);
      }
      process.exit(0);
    }
    main();
  `;
  conn.exec(`cd /root/AuraForex && node -e "${nodeScript.replace(/"/g, '\\"')}"`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
        conn.exec('cat /root/AuraForex/update_status.txt', (err2, stream2) => {
            stream2.on('data', (d) => console.log('RESULT: ' + d.toString()));
            stream2.on('close', () => conn.end());
        });
    });
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
