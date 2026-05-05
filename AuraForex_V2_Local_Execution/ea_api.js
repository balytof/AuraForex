const express = require("express");
const router = express.Router();
const prisma = require("./db");
const signalsQueue = [];

function formatForMT5(signal) {
  return {
    id: Date.now().toString(),
    pair: signal.pair,
    direction: signal.direction,
    sl: signal.sl,
    tp: signal.tp,
    lot: 0.01
  };
}



/**
 * ── ENDPOINT: VALIDATE ──────────────────────────────────────────────
 * O EA chama este endpoint ao iniciar para verificar se a licença é válida
 * e se está amarrada ao número da conta MetaTrader correto.
 * ─────────────────────────────────────────────────────────────────────
 */
/**
 * ── ENDPOINT: VALIDATE ──────────────────────────────────────────────
 * O EA chama este endpoint ao iniciar para verificar se a licença é válida.
 * ─────────────────────────────────────────────────────────────────────
 */
router.post("/validate", (req, res) => {
  return res.json({ status: "OK" });
});


function pushSignal(signal) {
  signalsQueue.push(formatForMT5(signal));
  console.log(`[QUEUE] Novo sinal adicionado. Fila atual: ${signalsQueue.length}`);
}

/**
 * ── ENDPOINT: SIGNALS ───────────────────────────────────────────────
 * O EA chama este endpoint periodicamente para buscar novos sinais na fila.
 * A fila é limpa imediatamente após o envio.
 * ─────────────────────────────────────────────────────────────────────
 */
router.get("/signals", (req, res) => {
  const data = [...signalsQueue];
  
  // Limpa depois de enviar (Padrão sugerido para execução única)
  signalsQueue.length = 0;

  if (data.length > 0) {
    console.log(`[EA-API] Enviando ${data.length} sinais e limpando fila.`);
  }

  res.json({ signals: data });
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

