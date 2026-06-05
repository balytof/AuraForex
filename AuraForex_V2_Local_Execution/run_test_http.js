const { Client } = require('ssh2');
const conn = new Client();

const scriptContent = `
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst({ where: { role: 'PROVIDER' } });
    if (!user) {
        console.log("No provider user found");
        return;
    }
    console.log("Testing as user:", user.email, "id:", user.id);

    const token = jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role
    }, process.env.JWT_SECRET || 'AuraForexSuperChaveSecretaDeProducao2026', { expiresIn: '7d' });

    console.log("Generated token:", token);

    const res = await fetch('http://localhost:3005/api/user/provider/stats', {
       headers: { 'Authorization': 'Bearer ' + token }
    });
    
    console.log("Status:", res.status);
    const data = await res.text();
    console.log("Response:", data);

  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
`;
const fs = require('fs');
fs.writeFileSync('./test_http.js', scriptContent);

conn.on('ready', () => {
    conn.exec('cat > /root/AuraForex/AuraForex_V2_Local_Execution/test_http.js', (err, stream) => {
        if (err) throw err;
        stream.write(scriptContent);
        stream.end();
        
        stream.on('close', () => {
            conn.exec('cd /root/AuraForex/AuraForex_V2_Local_Execution && npx @dotenvx/dotenvx run -- node test_http.js', (err, stream2) => {
                let out = '';
                stream2.on('data', d => out += d);
                stream2.stderr.on('data', d => out += d);
                stream2.on('close', () => {
                    console.log(out);
                    conn.end();
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
