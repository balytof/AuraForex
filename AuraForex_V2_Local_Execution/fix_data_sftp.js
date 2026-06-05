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
       const admin = await prisma.user.findUnique({ where: { email: 'admin@auratrade.ai' } });
       if(admin) {
           const provider = await prisma.provider.findFirst({ where: { userId: admin.id } });
           if(provider) {
               const sub = await prisma.clientSubscription.findFirst({ where: { userId: user.id } });
               if(sub) {
                   await prisma.clientSubscription.update({
                       where: { id: sub.id },
                       data: { totalGasPaid: 10 }
                   });
                   console.log("Updated balytof sub totalGasPaid to 10");
               } else {
                   await prisma.clientSubscription.create({
                       data: {
                           userId: user.id,
                           providerId: provider.id,
                           totalGasPaid: 10,
                           status: "ACTIVE"
                       }
                   });
                   console.log("Created balytof sub with totalGasPaid 10");
               }
           }
       }
    }
  } catch(e) {
       console.error(e);
  } finally {
       await prisma.$disconnect();
  }
}
run();
`;
fs.writeFileSync('./script_to_upload.js', scriptContent);

conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.fastPut('./script_to_upload.js', '/root/AuraForex/AuraForex_V2_Local_Execution/script_to_upload.js', (err) => {
            if (err) throw err;
            conn.exec('node /root/AuraForex/AuraForex_V2_Local_Execution/script_to_upload.js', (err, stream) => {
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
