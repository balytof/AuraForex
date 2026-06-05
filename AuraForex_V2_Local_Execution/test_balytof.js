const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    const script = `
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      async function run() {
        try {
          const user = await prisma.user.findUnique({ where: { email: 'balytof@gmail.com' } });
          console.log('User balytof:', user ? user.id : 'not found');
          if(user) {
             const sub = await prisma.clientSubscription.findFirst({ where: { userId: user.id }});
             console.log('Sub:', sub);
          }
        } catch(e) {
             console.error(e);
        }
      }
      run();
    `;
    
    conn.exec(`echo '${script}' > /root/AuraForex/AuraForex_V2_Local_Execution/test_balytof.js && node /root/AuraForex/AuraForex_V2_Local_Execution/test_balytof.js`, (err, stream) => {
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
