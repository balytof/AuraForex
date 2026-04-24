const fs = require('fs');
let b = fs.readFileSync('server.js', 'utf8');

// Replace imports
b = b.replace(
  /\/\/ Broker Adapters[\s\S]*?const MetaApiAdapter = require\("\.\/broker-adapters\/metaapi"\);/,
  '// APEX SMC Broker Layer\nconst { createBroker } = require("./apex_broker");'
);

// We won't replace getBrokerAdapter entirely yet, let's just make it call createBroker directly
// but since the signature changes, let's just comment out the old one and add the new one.
b = b.replace(
  /function getBrokerAdapter\(type\) \{[\s\S]*?\n\}/,
  'function getBrokerAdapter(config) {\n  return createBroker(config);\n}'
);

fs.writeFileSync('server.js', b);
console.log("Refactoring part 1 complete.");
