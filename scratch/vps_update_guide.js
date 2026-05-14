const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('🚀 Conectado ao VPS para Atualizar Guia...');
  const oldUrl = 'http://139.59.159.48:3005/api';
  const newUrl = 'https://www.auratradebots.com/api';
  
  const nodeScript = `
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    async function main() {
      const settings = await prisma.systemSettings.findFirst();
      if (settings) {
        let guide = settings.installationGuide || '';
        guide = guide.split('${oldUrl}').join('${newUrl}');
        // Also update the apiUrl field
        await prisma.systemSettings.update({
          where: { id: settings.id },
          data: { 
            installationGuide: guide,
            apiUrl: '${newUrl}'
          }
        });
        console.log('✅ Guia e API URL atualizados!');
      } else {
        console.log('❌ Configurações não encontradas.');
      }
      process.exit(0);
    }
    main();
  `;
  conn.exec(`cd /root/AuraForex && node -e "${nodeScript.replace(/"/g, '\\"')}"`, (err, stream) => {
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
