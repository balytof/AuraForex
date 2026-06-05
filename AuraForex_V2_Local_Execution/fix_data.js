const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    const script = `
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      async function run() {
        try {
          // Find balytof
          const user = await prisma.user.findUnique({ where: { email: 'balytof@gmail.com' } });
          if(user) {
             // Find provider of admin
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
        }
      }
      run();
    `;
    
    conn.exec(`echo '${script}' > /root/AuraForex/AuraForex_V2_Local_Execution/fix_data.js && node /root/AuraForex/AuraForex_V2_Local_Execution/fix_data.js`, (err, stream) => {
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
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
