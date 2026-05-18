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
    const res = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'UserSettings'"
    );
    console.log('=== UserSettings Columns ===');
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);
  `;

  // Write script to project directory and run it
  conn.exec(`cat << 'EOF' > /root/AuraForex/scratch_db_columns.js\n${scriptContent}\nEOF\ncd /root/AuraForex && node scratch_db_columns.js && rm scratch_db_columns.js`, (err, stream) => {
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
