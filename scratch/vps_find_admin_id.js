const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('🚀 Conectado ao VPS para ver Admin ID...');
  const nodeScript = `
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    async function main() {
      const user = await prisma.user.findUnique({
        where: { email: 'admin@auratrade.ai' }
      });
      console.log('ADMIN_ID: ' + (user ? user.id : 'NOT_FOUND'));
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
