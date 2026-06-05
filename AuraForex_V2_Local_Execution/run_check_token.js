const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const scriptContent = `
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const admin = await prisma.user.findFirst({ where: { role: 'PROVIDER' } });
    if (!admin) {
       console.log("No provider found in Users table!");
       return;
    }
    console.log("Found provider user:", admin.email);
    
    let provider = await prisma.provider.findFirst({ where: { userId: admin.id } });
    console.log("Provider record:", provider);
    
    if(!provider) {
       console.log("No provider record! Creating one now...");
       provider = await prisma.provider.create({
           data: {
               userId: admin.id,
               token: 'AURA-PRV-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
               totalGasEarned: 0,
               availableGas: 0,
               totalGasWithdrawn: 0
           }
       });
       console.log("Created provider record:", provider);
    }

    if (!provider.token) {
       console.log("Token is empty! Fixing...");
       provider = await prisma.provider.update({
           where: { id: provider.id },
           data: { token: 'AURA-PRV-' + Math.random().toString(36).substr(2, 6).toUpperCase() }
       });
       console.log("Fixed Token:", provider.token);
    }

    // Fix balytof while we're here
    const user = await prisma.user.findUnique({ where: { email: 'balytof@gmail.com' } });
    if(user) {
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
  } catch(e) {
       console.error(e);
  } finally {
       await prisma.$disconnect();
  }
}
run();
`;
fs.writeFileSync('./check_token.js', scriptContent);

conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.fastPut('./check_token.js', '/root/AuraForex/AuraForex_V2_Local_Execution/check_token.js', (err) => {
            if (err) throw err;
            conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && node -r dotenv/config check_token.js', (err, stream) => {
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
