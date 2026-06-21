const { Client } = require('ssh2');

const conn = new Client();

const script = `
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Users in VPS Database:', users.map(u => u.email));
}

main().catch(console.error).finally(() => prisma.$disconnect());
`;

conn.on('ready', () => {
    conn.exec(`cd AuraForex && echo "${script.replace(/"/g, '\\"').replace(/\$/g, '\\$')}" > check_users.js && node check_users.js`, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => conn.end())
        .on('data', data => process.stdout.write(data))
        .stderr.on('data', data => process.stderr.write(data));
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
