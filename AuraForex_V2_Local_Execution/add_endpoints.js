const fs = require('fs');
let txt = fs.readFileSync('server.js', 'utf8');

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
  fs.writeFileSync('server.js', txt, 'utf8');
  console.log('Endpoints added successfully.');
}
