const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    console.log('🚀 Injetando licença mestre via SQL no VPS...');
    
    // Comando SQL para garantir que existe o plano e a licença
    const sql = `
DO $$ 
DECLARE 
    admin_id UUID;
    plan_id UUID;
BEGIN
    SELECT id INTO admin_id FROM "User" WHERE role = 'ADMIN' LIMIT 1;
    
    IF admin_id IS NULL THEN
        RAISE NOTICE 'Admin não encontrado';
    ELSE
        -- Criar plano se não existir
        INSERT INTO "LicensePlan" (id, name, price, "durationDays", "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), 'Master Plan', 0, 365, true, NOW(), NOW())
        ON CONFLICT DO NOTHING;
        
        SELECT id INTO plan_id FROM "LicensePlan" LIMIT 1;
        
        -- Criar licença
        INSERT INTO "License" (id, "userId", "planId", status, "expiresAt", "createdAt", "updatedAt")
        VALUES ('AURA-V6-MASTER-2026', admin_id, plan_id, 'ACTIVE', NOW() + interval '1 year', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', "expiresAt" = NOW() + interval '1 year';
        
        RAISE NOTICE 'Licença AURA-V6-MASTER-2026 ativada';
    END IF;
END $$;
`;

    conn.exec(`sudo -u postgres psql -d auraforex -c '${sql.replace(/'/g, "'\\''")}'`, (err, stream) => {
        if (err) throw err;
        stream.on('data', data => console.log(data.toString()));
        stream.on('stderr', data => console.error(data.toString()));
        stream.on('close', () => {
            console.log('✅ SQL executado com sucesso.');
            conn.end();
        });
    });
}).connect({
    host: '139.59.159.48',
    port: 22,
    username: 'root',
    password: '@Infomoi2023'
});
