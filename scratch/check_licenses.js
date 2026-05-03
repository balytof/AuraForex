const prisma = require('../db');

async function main() {
  const licenses = await prisma.license.findMany({
    include: { user: true }
  });
  console.log('Total licenses:', licenses.length);
  licenses.forEach(l => {
    console.log(`- ID: ${l.id} | User: ${l.user.email} | MT: ${l.mtAccount || 'EMPTY'} | Status: ${l.status} | Expires: ${l.expiresAt}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
