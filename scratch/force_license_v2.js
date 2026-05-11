const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Forçando criação da licença AURA-V6-MASTER-2026...');
    const sql = `
DELETE FROM "License";
INSERT INTO "License" (id, "userId", "planId", status, "expiresAt", "createdAt", "updatedAt")
VALUES (
    'AURA-V6-MASTER-2026', 
    (SELECT id FROM "User" WHERE email = 'admin@auratrade.ai' LIMIT 1),
    (SELECT id FROM "LicensePlan" LIMIT 1),
    'ACTIVE',
    NOW() + interval '1 year',
    NOW(),
    NOW()
);
SELECT * FROM "License" WHERE id = 'AURA-V6-MASTER-2026';
`;
    conn.exec(`sudo -u postgres psql -d auraforex -c "${sql}"`, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log(data.toString()));
        stream.on('close', () => {
            console.log('✅ Verificação concluída.');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48', port: 22, username: 'root', password: '@Infomoi2023'
});
