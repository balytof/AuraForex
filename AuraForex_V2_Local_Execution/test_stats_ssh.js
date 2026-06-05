const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    // Generate a simple script to test on the VPS
    const script = `
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      async function run() {
        try {
          const provider = await prisma.provider.findFirst();
          console.log('Provider:', provider);
          
          if (!provider) return console.log('No provider');
          
          const clients = await prisma.clientSubscription.findMany({
            where: { providerId: provider.id }
          });
          console.log('Clients:', clients.length);
          
          let totalGasDeposited = 0;
          for (let c of clients) {
            totalGasDeposited += (c.totalGasPaid || 0);
          }
          console.log('Total deposited:', totalGasDeposited);
          
          const withdrawals = await prisma.withdrawalRequest.findMany({
            where: { type: "PROVIDER" }
          });
          console.log('Withdrawals:', withdrawals.length);
        } catch(e) {
          console.error('ERROR:', e);
        } finally {
          await prisma.$disconnect();
        }
      }
      run();
    `;
    
    conn.exec(`echo "${script.replace(/"/g, '\\"')}" > /root/AuraForex/AuraForex_V2_Local_Execution/test_stats.js && node /root/AuraForex/AuraForex_V2_Local_Execution/test_stats.js`, (err, stream) => {
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
