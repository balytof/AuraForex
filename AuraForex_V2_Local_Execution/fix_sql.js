const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
    // Check if postgres is available and execute SQL
    const sql = `
    UPDATE "ClientSubscription" 
    SET "totalGasPaid" = 10 
    WHERE "userId" = (SELECT id FROM "User" WHERE email='balytof@gmail.com');
    
    INSERT INTO "ClientSubscription" ("id", "userId", "providerId", "status", "totalGasPaid", "updatedAt")
    SELECT gen_random_uuid(), u.id, p.id, 'ACTIVE', 10, NOW()
    FROM "User" u
    CROSS JOIN "Provider" p
    WHERE u.email = 'balytof@gmail.com'
    AND NOT EXISTS (
        SELECT 1 FROM "ClientSubscription" cs WHERE cs."userId" = u.id
    ) LIMIT 1;
    `;
    
    const cmd = `sudo -u postgres psql -d auraforex -c "${sql.replace(/\n/g, ' ')}"`;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        let output = '';
        stream.on('close', (code, signal) => {
            console.log("SQL Output:", output);
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
