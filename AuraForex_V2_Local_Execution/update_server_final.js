const fs = require('fs');
let txt = fs.readFileSync('server.js', 'utf8');

// 1. Add endpoints
const newEndpoints = `
app.post('/api/user/pamm/request-change', requireAuth, async (req, res) => {
  try {
    const pammAccount = await prisma.pammAccount.findUnique({ where: { userId: req.user.id } });
    if (!pammAccount) return res.status(400).json({ error: 'Conta PAMM não encontrada.' });
    await prisma.pammAccount.update({ where: { id: pammAccount.id }, data: { changeRequested: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  }
});

app.post('/api/admin/pamm/remove', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado.' });

    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'ID do usuário não fornecido.' });

    const pammAccount = await prisma.pammAccount.findUnique({ where: { userId: targetUserId } });
    if (!pammAccount) return res.status(404).json({ error: 'Conta PAMM não encontrada.' });

    const systemSettings = await prisma.systemSettings.findFirst();
    if (systemSettings && pammAccount.metaApiAccountId) {
      const { removePammAccount } = require('./pamm_metaapi.js');
      try {
        await removePammAccount(systemSettings, pammAccount.metaApiAccountId);
      } catch(e) {
        console.error("MetaApi account already removed or error:", e);
      }
    }

    await prisma.pammAccount.delete({ where: { userId: targetUserId } });
    await prisma.userSettings.update({ where: { userId: targetUserId }, data: { pammChangeApproved: true } });

    res.json({ success: true, message: 'Conta PAMM removida com sucesso.' });
  } catch (err) {
    console.error('Erro ao remover conta PAMM:', err);
    res.status(500).json({ error: 'Erro interno ao remover a conta PAMM.' });
  }
});
`;

if (!txt.includes('/api/user/pamm/request-change')) {
  txt = txt.replace('app.post("/api/user/pamm/disconnect"', newEndpoints + '\napp.post("/api/user/pamm/disconnect"');
}

// 2. Fix GET /api/user/pamm
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
}

// 3. Fix POST /api/user/pamm
const postTarget = `} else if (existingPamm && existingPamm.metaApiAccountId) {
      // Diferente conta/server? Idealmente, apagaríamos a antiga da MetaApi para não acumular custos, mas não temos o token/metaApi acessível aqui.
      console.log(\`[PAMM] Atenção: Nova conta/servidor inseridos. Um novo MetaApi ID será criado.\`);
    }`;

const postNew = `} else if (existingPamm && existingPamm.metaApiAccountId) {
      // Bloquear troca de conta/servidor
      return res.status(400).json({ error: "DUPLICATE_ACCOUNT" });
    }`;

if (txt.includes(postTarget)) {
  txt = txt.replace(postTarget, postNew);
}

fs.writeFileSync('server.js', txt, 'utf8');
console.log('server.js updated beautifully!');
