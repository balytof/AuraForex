const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Connected to VPS.');
  
  const scriptContent = `
const prisma = require('./db');
async function main() {
  const lic = await prisma.license.findUnique({
    where: { id: '1e878774-b4d4-443a-9e1e-309d8828928a' },
    include: { user: { include: { settings: true } } }
  });
  console.log('=== LICENSE & USER SETTINGS ===');
  console.log('License Key:', lic ? lic.id : 'NOT FOUND');
  console.log('License Status:', lic ? lic.status : 'N/A');
  console.log('User Email:', lic && lic.user ? lic.user.email : 'N/A');
  console.log('User Settings:', lic && lic.user && lic.user.settings ? JSON.stringify(lic.user.settings, null, 2) : 'NONE');
}
main().catch(console.error).finally(() => prisma.$disconnect());
  `;

  // Write script to project directory and run it
  conn.exec(`cat << 'EOF' > /root/AuraForex/scratch_db_check.js\n${scriptContent}\nEOF\ncd /root/AuraForex && node scratch_db_check.js && rm scratch_db_check.js`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.end();
    })
    .on('data', (data) => process.stdout.write(data.toString()))
    .stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
}).connect({
  host: '139.59.159.48',
  port: 22,
  username: 'root',
  password: '@Infomoi2023'
});
