const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:AuraTradeSecureDB2026!@localhost:5432/auraforex' });

client.connect()
  .then(() => client.query('SELECT "licenseKey" FROM "User" WHERE email=\'admin@auratrade.ai\''))
  .then(res => {
    console.log(res.rows);
    client.end();
  })
  .catch(console.error);
