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
       console.log("No provider found");
       return;
    }
    console.log("Found provider user:", admin.email);
    
    // Simulate what the stats endpoint does:
    const provider = await prisma.provider.findFirst({ where: { userId: admin.id } });
    console.log("Provider record:", provider);
    
    if(!provider) {
       console.log("No provider record for this user!");
       return;
    }

    const clients = await prisma.clientSubscription.findMany({
      where: { providerId: provider.id }
    });
    console.log("Clients:", clients);
    
  } catch(e) {
       console.error(e);
  } finally {
       await prisma.$disconnect();
  }
}
run();
`;
fs.writeFileSync('./test_endpoint_sftp.js', scriptContent);

conn.on('ready', () => {
    conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.fastPut('./test_endpoint_sftp.js', '/root/AuraForex/AuraForex_V2_Local_Execution/test_endpoint_sftp.js', (err) => {
            if (err) throw err;
            conn.exec('node /root/AuraForex/AuraForex_V2_Local_Execution/test_endpoint_sftp.js', (err, stream) => {
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
