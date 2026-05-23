const fs = require('fs');
let txt = fs.readFileSync('server.js', 'utf8');

const postTarget = `    } else if (existingPamm && existingPamm.metaApiAccountId) {
      // Diferente conta/server? Idealmente, apagaríamos a antiga da MetaApi para não acumular custos, mas não temos o token/metaApi acessível aqui.
      console.log(\`[PAMM] Atenção: Nova conta/servidor inseridos. Um novo MetaApi ID será criado.\`);
    }`;

const postNew = `    } else if (existingPamm && existingPamm.metaApiAccountId) {
      // Bloquear troca de conta/servidor
      return res.status(400).json({ error: "DUPLICATE_ACCOUNT" });
    }`;

if (txt.includes(postTarget)) {
  txt = txt.replace(postTarget, postNew);
  fs.writeFileSync('server.js', txt, 'utf8');
  console.log('Fixed duplicate account bug in server.js');
} else {
  console.log('Target not found in server.js');
}
