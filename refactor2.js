const fs = require('fs');
let b = fs.readFileSync('server.js', 'utf8');

// 1. Fix auto-connect credentials construction (approx line 190-210)
const oldAutoConnect = `const credentials = {
           environment: connection.environment,
           accountId: connection.accountId,
           apiToken: decrypt(connection.apiTokenEncrypted),
           metaApiToken: decrypt(connection.apiTokenEncrypted),
           identifier: decrypt(connection.capitalIdentifier),
           password: decrypt(connection.capitalPassword),
           apiKey: decrypt(connection.apiTokenEncrypted),
           region: connection.region
         };
         const adapter = getBrokerAdapter(connection.brokerType);
         const resConn = await adapter.connect(credentials);`;

const newAutoConnect = `const config = {
           provider: connection.brokerType,
           environment: connection.environment,
           accountId: connection.accountId,
           apiToken: decrypt(connection.apiTokenEncrypted),
           metaApiToken: decrypt(connection.apiTokenEncrypted),
           metaApiAccountId: connection.accountId,
           oandaAccountId: connection.accountId,
           oandaApiKey: decrypt(connection.apiTokenEncrypted),
           capitalIdentifier: decrypt(connection.capitalIdentifier),
           capitalPassword: decrypt(connection.capitalPassword),
           capitalApiKey: decrypt(connection.apiTokenEncrypted),
           region: connection.region
         };
         const adapter = getBrokerAdapter(config);
         const resConn = await adapter.connect();`;

b = b.replace(oldAutoConnect, newAutoConnect);

// 2. Fix /api/broker/connect route logic
const oldConnectLogic = `activeBroker = getBrokerAdapter(brokerType);
    const connectWithTimeout = new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('A corretora não respondeu em 15 segundos. Verifique as credenciais e tente novamente.')), 15000);
      try { const rConnect = await activeBroker.connect(credentials); clearTimeout(timer); resolve(rConnect); } 
      catch(err) { clearTimeout(timer); reject(err); }
    });`;

const newConnectLogic = `const config = {
      provider: brokerType,
      environment: credentials.environment,
      accountId: credentials.accountId || credentials.identifier,
      apiToken: credentials.apiToken || credentials.metaApiToken || credentials.apiKey,
      metaApiToken: credentials.metaApiToken,
      metaApiAccountId: credentials.accountId,
      oandaAccountId: credentials.accountId,
      oandaApiKey: credentials.apiToken,
      capitalIdentifier: credentials.identifier,
      capitalPassword: credentials.password,
      capitalApiKey: credentials.apiKey,
      region: credentials.region
    };
    activeBroker = getBrokerAdapter(config);
    const connectWithTimeout = new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('A corretora não respondeu em 15 segundos. Verifique as credenciais e tente novamente.')), 15000);
      try { const rConnect = await activeBroker.connect(); clearTimeout(timer); resolve(rConnect); } 
      catch(err) { clearTimeout(timer); reject(err); }
    });`;

b = b.replace(oldConnectLogic, newConnectLogic);

// 3. Fix /api/broker/order payload
const oldOrderLogic = `const result = await req.broker.placeOrder({ pair, direction, lotSize, sl, tp });`;
const newOrderLogic = `const result = await req.broker.placeOrder({ pair, direction, sl, tp }, lotSize);`;
b = b.replace(oldOrderLogic, newOrderLogic);

// 4. Update memory cache clearing
// Old `try { await activeBroker.disconnect(); }` should be fine.

fs.writeFileSync('server.js', b);
console.log("Refactoring part 2 complete.");
