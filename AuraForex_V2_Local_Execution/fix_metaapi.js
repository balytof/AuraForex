const fs = require('fs');
let txt = fs.readFileSync('pamm_metaapi.js', 'utf8');

// 1. Modificar setupPammAccount para procurar a conta primeiro
const setupTarget = `    if (!account) {
      // 1. Criar a conta na MetaApi
      console.log(\`[PAMM] A criar nova conta no MetaApi para \${accountNumber} (\${platform})...\`);
      account = await metaApi.metatraderAccountApi.createAccount({`;

const setupNew = `    if (!account) {
      // Procurar se já existe uma conta na MetaApi com este login para evitar duplicações
      try {
        const accounts = await metaApi.metatraderAccountApi.getAccounts();
        const existing = accounts.find(a => a.login === accountNumber);
        if (existing) {
          console.log(\`[PAMM] Conta já existente na MetaApi encontrada! Reutilizando ID: \${existing.id}\`);
          account = existing;
        }
      } catch (e) {
        console.log("[PAMM] Aviso ao procurar contas existentes na MetaApi:", e.message);
      }
    }

    if (!account) {
      // 1. Criar a conta na MetaApi
      console.log(\`[PAMM] A criar nova conta no MetaApi para \${accountNumber} (\${platform})...\`);
      account = await metaApi.metatraderAccountApi.createAccount({`;

if (txt.includes(setupTarget)) {
  txt = txt.replace(setupTarget, setupNew);
  console.log("setupPammAccount atualizado.");
} else {
  console.log("setupPammAccount target não encontrado.");
}

// 2. Modificar removePammAccount para NÃO apagar da MetaApi, apenas undeploy (interromper internamente)
const removeTarget = `    const account = await metaApi.metatraderAccountApi.getAccount(metaApiAccountId);
    await account.undeploy();
    // Apaga a conta da MetaApi para não gerar custos adicionais
    await metaApi.metatraderAccountApi.deleteAccount(metaApiAccountId);
    console.log(\`[PAMM] Conta \${metaApiAccountId} eliminada da MetaApi com sucesso.\`);`;

const removeNew = `    const account = await metaApi.metatraderAccountApi.getAccount(metaApiAccountId);
    console.log(\`[PAMM] A interromper internamente a comunicação (undeploy) para \${metaApiAccountId}...\`);
    await account.undeploy();
    // A pedido do cliente, NÃO apagamos a conta da MetaApi para evitar duplicações futuras.
    console.log(\`[PAMM] Conta \${metaApiAccountId} desconectada (undeploy) com sucesso, mas mantida no servidor.\`);`;

if (txt.includes(removeTarget)) {
  txt = txt.replace(removeTarget, removeNew);
  console.log("removePammAccount atualizado.");
} else {
  console.log("removePammAccount target não encontrado.");
}

fs.writeFileSync('pamm_metaapi.js', txt, 'utf8');
