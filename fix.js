const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');
code = code.replace(
  'const result = await activeBroker.connect(credentials);',
  `const connectWithTimeout = new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('A corretora não respondeu em 15 segundos. Verifique as credenciais.')), 15000);
      try { const r = await activeBroker.connect(credentials); clearTimeout(timer); resolve(r); } 
      catch(err) { clearTimeout(timer); reject(err); }
    });
    const result = await connectWithTimeout;`
);
code = code.replace(
  'if (!result.success) return res.status(401).json(result);',
  'if (!result.success) return res.status(400).json(result);'
);
code = code.replace(
  'return res.status(500).json({ success: false, error: "Erro interno no servidor ao conectar." });',
  'return res.status(400).json({ success: false, error: e.message || "Erro ao conectar." });'
);
fs.writeFileSync('server.js', code);
console.log("CORRECAO APLICADA COM SUCESSO!");
