const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// 1. Wrap the connection with a 15-second timeout, preserving the variable name ('result' or 'r')
code = code.replace(
  /const\s+(result|r)\s*=\s*await\s+activeBroker\.connect\(credentials\);/,
  `const connectWithTimeout = new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('A corretora não respondeu em 15 segundos. Verifique as credenciais e tente novamente.')), 15000);
      try { const rConnect = await activeBroker.connect(credentials); clearTimeout(timer); resolve(rConnect); } 
      catch(err) { clearTimeout(timer); reject(err); }
    });
    const $1 = await connectWithTimeout;`
);

// 2. Change 401 to 400 for broker error responses
code = code.replace(/res\.status\(401\)\.json\((result|r)\)/g, 'res.status(400).json($1)');

// 3. Ensure the catch block returns the actual error message instead of 'Erro interno'
code = code.replace(
  /return res\.status\(500\)\.json\(\{\s*success:\s*false,\s*error:\s*"Erro interno no servidor ao conectar\."\s*\}\);/,
  'return res.status(400).json({ success: false, error: e.message || "Erro ao conectar." });'
);

fs.writeFileSync('server.js', code);
console.log("CORRECAO DO TIMEOUT APLICADA COM SUCESSO!");
