const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    // The script to execute on the VPS
    const remoteScript = `
const prisma = require('./db.js');

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true }
    });
    console.log('Total de usuários:', users.length);
    console.log('Usuários:', JSON.stringify(users.slice(0, 10), null, 2)); // Mostra os primeiros 10
  } catch (err) {
    console.error('Erro ao conectar ao DB:', err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
`;

    conn.exec(`cat << 'EOF' > /root/AuraForex/check_users_script.js\n${remoteScript}\nEOF\ncd /root/AuraForex && node check_users_script.js`, (err, stream) => {
        let data = '';
        stream.on('close', () => {
            console.log('Output:\n', data);
            conn.end();
        }).on('data', d => data += d.toString()).stderr.on('data', d => data += d.toString());
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
