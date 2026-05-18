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
      "SELECT id, \\"apiUrl\\", \\"installationGuide\\" FROM \\"SystemSettings\\" LIMIT 1"
    );
    console.log('=== SystemSettings ===');
    console.log(res.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);
  `;

  // Write script and run it
  conn.exec(`cat << 'EOF' > /root/AuraForex/scratch_system_settings.js\n${scriptContent}\nEOF\ncd /root/AuraForex && node scratch_system_settings.js && rm scratch_system_settings.js`, (err, stream) => {
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
