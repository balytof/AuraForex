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
    console.log('Altering table UserSettings...');
    await client.query(
      'ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "botStatus" text DEFAULT \\'stopped\\''
    );
    console.log('Table UserSettings altered successfully.');
    
    const res = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'UserSettings'"
    );
    console.log('=== New UserSettings Columns ===');
    console.log(res.rows);
  } catch (err) {
    console.error('Error during ALTER TABLE:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);
  `;

  // Write script to project directory and run it
  conn.exec(`cat << 'EOF' > /root/AuraForex/scratch_alter_table.js\n${scriptContent}\nEOF\ncd /root/AuraForex && node scratch_alter_table.js && rm scratch_alter_table.js`, (err, stream) => {
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
