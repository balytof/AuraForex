const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Forçando ID da licença no VPS...');
    const sql = `
DELETE FROM "License";
INSERT INTO "License" (id, "userId", "planId", status, "expiresAt", "createdAt", "updatedAt")
SELECT 'AURA-V6-MASTER-2026', id, (SELECT id FROM "LicensePlan" LIMIT 1), 'ACTIVE', NOW() + interval '1 year', NOW(), NOW()
FROM "User" WHERE role = 'ADMIN' LIMIT 1;
`;
    conn.exec(`sudo -u postgres psql -d auraforex -c "${sql}"`, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log(data.toString()));
        stream.on('close', () => {
            console.log('✅ Licença AURA-V6-MASTER-2026 ativa.');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
