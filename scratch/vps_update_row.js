const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Connected to VPS.');
  
  const scriptContent = `
const { Pool } = require('pg');
require('dotenv').config();
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    console.log('Updating botStatus to running...');
    const upRes = await client.query(
      "UPDATE \\"UserSettings\\" SET \\"botStatus\\" = 'running' WHERE \\"userId\\" = '005cfe66-ee57-423f-9934-fa5599fba4bc'"
    );
    console.log('Update result:', upRes.rowCount);
    
    const res = await client.query(
      "SELECT * FROM \\"UserSettings\\" WHERE \\"userId\\" = '005cfe66-ee57-423f-9934-fa5599fba4bc'"
    );
    console.log('=== UserSettings row in PG ===');
    console.log(res.rows[0]);
  } catch (err) {
    console.error('Error during UPDATE:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);
  `;

  // Write script and run it, then run prisma generate
  conn.exec(`cat << 'EOF' > /root/AuraForex/scratch_update_row.js\n${scriptContent}\nEOF\ncd /root/AuraForex && node scratch_update_row.js && rm scratch_update_row.js && npx prisma generate`, (err, stream) => {
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
