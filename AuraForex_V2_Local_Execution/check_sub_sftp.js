const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const scriptContent = `
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'balytof@gmail.com' } });
    if(user) {
        const sub = await prisma.clientSubscription.findFirst({ where: { userId: user.id } });
        console.log("Sub:", sub);
    }
  } catch(e) {
       console.error(e);
  } finally {
       await prisma.$disconnect();
  }
}
run();
`;
fs.writeFileSync('./check_sub.js', scriptContent);

conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.fastPut('./check_sub.js', '/root/AuraForex/AuraForex_V2_Local_Execution/check_sub.js', (err) => {
            if (err) throw err;
            conn.exec('node /root/AuraForex/AuraForex_V2_Local_Execution/check_sub.js', (err, stream) => {
                if (err) throw err;
                let output = '';
                stream.on('close', (code, signal) => {
                    console.log(output);
                    conn.end();
                }).on('data', (data) => {
                    output += data;
                }).stderr.on('data', (data) => {
                    output += data;
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
