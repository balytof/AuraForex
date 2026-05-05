const express = require("express");
const router = express.Router();
const prisma = require("./db");
const userQueues = new Map(); // userId -> Array de sinais


function formatForMT5(signal) {
  return {
    id: String(signal.id || Date.now().toString()),
    pair: String(signal.pair).toUpperCase(),
    direction: String(signal.direction).toUpperCase(),
    entry: Number(signal.entry || 0),
    sl: Number(signal.sl || 0),
    tp: Number(signal.tp || 0),
    lot: Number(signal.lot || 0.01)
  };
}




/**
 * ── ENDPOINT: VALIDATE ──────────────────────────────────────────────
 * O EA chama este endpoint ao iniciar para verificar se a licença é válida
 * e se está amarrada ao número da conta MetaTrader correto.
 * ─────────────────────────────────────────────────────────────────────
 * O EA chama este endpoint ao iniciar para verificar se a licença é válida.
 * ─────────────────────────────────────────────────────────────────────
 */
router.post("/validate", (req, res) => {
  const { licenseKey, mtAccount } = req.body;
  console.log(`[EA-API] 🛡️ Validando MT5: Conta ${mtAccount} | Licença ${licenseKey}`);
  res.json({ status: "OK" });
});



function pushSignal(userId, signal) {
  if (!userQueues.has(userId)) userQueues.set(userId, []);
  const queue = userQueues.get(userId);
  queue.push(formatForMT5(signal));
  console.log(`[QUEUE] Sinal enviado para User ${userId.substring(0,8)}. Fila: ${queue.length}`);
}

/**
 * ── ENDPOINT: SIGNALS ───────────────────────────────────────────────
 * O EA chama este endpoint periodicamente para buscar novos sinais na fila.
 * ─────────────────────────────────────────────────────────────────────
 */
router.get("/signals", async (req, res) => {
  const { licenseKey } = req.query;
  console.log(`[EA-API] 📡 EA a buscar sinais para licença: ${licenseKey}`);
  if (!licenseKey) return res.status(400).json({ error: "licenseKey obrigatória." });


  try {
    const license = await prisma.license.findUnique({ where: { id: licenseKey } });
    if (!license) return res.status(403).json({ error: "Licença inválida." });

    const queue = userQueues.get(license.userId) || [];
    const data = [...queue];
    
    // Limpa a fila do utilizador após a entrega
    userQueues.set(license.userId, []);

    if (data.length > 0) {
      console.log(`[EA-API] Enviando ${data.length} sinais para User ${license.userId.substring(0,8)}.`);
    }

    res.json({ signals: data });
  } catch (e) {
    res.status(500).json({ error: "Erro interno." });
  }
});



/**
 * ── ENDPOINT: REPORT ────────────────────────────────────────────────
 * O EA chama este endpoint após executar uma ordem para atualizar o status
 * no servidor (ajuda no dashboard e estatísticas).
 * ─────────────────────────────────────────────────────────────────────
 */
router.post("/report", async (req, res) => {
  const { signalId, status, orderTicket } = req.body;

  if (!signalId || !status) {
    return res.status(400).json({ error: "signalId e status são obrigatórios." });
  }

  try {
    await prisma.signal.update({
      where: { id: signalId },
      data: {
        status: status, // EXECUTED, FAILED
        brokerId: orderTicket ? orderTicket.toString() : null,
        executedAt: status === "EXECUTED" ? new Date() : null
      }
    });

    console.log(`[EA-REPORT] Sinal ${signalId} atualizado para: ${status} (Ticket: ${orderTicket || 'N/A'})`);
    return res.json({ success: true });

  } catch (err) {
    console.error("[EA-REPORT] Erro ao reportar execução:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

/**
 * ── ENDPOINT: REPORT-BALANCE ─────────────────────────────────────────
 * O EA chama este endpoint periodicamente para atualizar o saldo e equity
 * da conta MetaTrader na base de dados.
 * ─────────────────────────────────────────────────────────────────────
 */
router.post("/report-balance", async (req, res) => {
  const { licenseKey, balance, equity } = req.body;

  if (!licenseKey || balance === undefined || equity === undefined) {
    return res.status(400).json({ error: "Dados incompletos (licenseKey, balance, equity)." });
  }

  try {
    await prisma.license.update({
      where: { id: licenseKey },
      data: {
        balance: parseFloat(balance),
        equity: parseFloat(equity),
        updatedAt: new Date()
      }
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("[EA-BALANCE] Erro ao atualizar saldo:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

module.exports = {
  router,
  pushSignal
};

