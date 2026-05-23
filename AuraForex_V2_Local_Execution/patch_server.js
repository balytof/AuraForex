const fs = require('fs');
let txt = fs.readFileSync('server.js', 'utf8');

const getTarget = `    res.json({
      success: true,
      walletBalance: user ? user.walletBalance : 0,
      pammPerformanceFeePct,
      pammAccount: pammAccount ? {`;

const getNew = `    let showChangeApproved = false;
    if (settings && settings.pammChangeApproved) {
      showChangeApproved = true;
      await prisma.userSettings.update({
        where: { userId: req.user.id },
        data: { pammChangeApproved: false }
      });
    }

    res.json({
      success: true,
      pammChangeApproved: showChangeApproved,
      changeRequested: pammAccount ? pammAccount.changeRequested : false,
      walletBalance: user ? user.walletBalance : 0,
      pammPerformanceFeePct,
      pammAccount: pammAccount ? {`;

if (txt.includes(getTarget)) {
  txt = txt.replace(getTarget, getNew);
  console.log("GET target found and replaced.");
} else {
  console.log("GET target not found");
}

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
  console.log("POST target found and replaced.");
} else {
  console.log("POST target not found");
}

fs.writeFileSync('server.js', txt, 'utf8');
console.log('server.js restored correctly.');
