const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('🚀 Conectado ao VPS para inspecionar DB...');
  const userId = '5782b472-0ff0-4761-bf38-9fc149705574';
  const query = `cd /root/AuraForex && npx prisma license findMany --where '{\"userId\": \"${userId}\"}'`;
  // Actually, I'll use a simple node script to query prisma
  const nodeScript = `
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    async function main() {
      const licenses = await prisma.license.findMany({
        where: { userId: '${userId}' },
        orderBy: { updatedAt: 'desc' }
      });
      console.log(JSON.stringify(licenses, null, 2));
      process.exit(0);
    }
    main();
  `;
  conn.exec(`node -e "${nodeScript.replace(/"/g, '\\"')}"`, (err, stream) => {
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
