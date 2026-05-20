const MetaApi = require('metaapi.cloud-sdk').default;

async function setupPammAccount(settings, accountNumber, serverName, password) {
  if (!settings.metaApiToken) {
    throw new Error("Token da MetaApi não está configurado no Painel Admin.");
  }
  
  const metaApi = new MetaApi(settings.metaApiToken);
  
  try {
    // Tenta detetar a plataforma com base no nome do servidor
    const platform = serverName.toLowerCase().includes('mt5') ? 'mt5' : 'mt4';
    
    // 1. Criar a conta na MetaApi
    console.log(`[PAMM] A criar conta no MetaApi para ${accountNumber} (${platform})...`);
    const account = await metaApi.metatraderAccountApi.createAccount({
      name: `Cliente PAMM ${accountNumber}`,
      type: 'cloud-g2',
      login: accountNumber,
      password: password,
      serverName: serverName,
      platform: platform,
      magic: 1000
    });
    
    console.log(`[PAMM] Conta criada na MetaApi. ID: ${account.id}. A fazer deploy...`);
    await account.deploy();
    
    // Esperar que fique conectada (com timeout de 30s)
    console.log(`[PAMM] A aguardar conexão da conta ${account.id}...`);
    await account.waitConnected();
    
    // 2. Configurar no CopyFactory
    if (!settings.pammMasterAccountId && !settings.metaApiAccountId) {
      throw new Error("Conta Master PAMM não configurada no Painel Admin.");
    }
    const masterId = settings.pammMasterAccountId || settings.metaApiAccountId;
    
    console.log(`[PAMM] A configurar CopyFactory (Master: ${masterId}, Subscriber: ${account.id})...`);
    const copyFactory = metaApi.copyFactory;
    
    // Adiciona como subscriber se ainda não estiver
    await copyFactory.subscriberApi.updateSubscriber(account.id, {
      name: `Subscriber PAMM ${accountNumber}`,
      subscriptions: [
        {
          strategyId: masterId,
          multiplier: 1.0 // Cópias 1:1 baseadas no balance/equity (configurável no CopyFactory UI)
        }
      ]
    });
    
    console.log(`[PAMM] Conta ${account.id} configurada como Subscriber com sucesso!`);
    return { success: true, metaApiAccountId: account.id };
    
  } catch (error) {
    console.error("[PAMM] Erro na integração MetaApi:", error);
    throw new Error(error.message || "Erro desconhecido na MetaApi.");
  }
}

/**
 * Worker em background para processar trades fechados e cobrar "Gás"
 */
function startPammWorker(prisma) {
  console.log("[PAMM] Worker de dedução de Gás iniciado (corre a cada 1 hora).");
  
  // Executar a cada hora (3600000 ms)
  setInterval(async () => {
    try {
      console.log("[PAMM] A verificar trades fechados para cobrança de Gás...");
      
      const settings = await prisma.systemSettings.findFirst();
      if (!settings || !settings.metaApiToken) return;

      const metaApi = new MetaApi(settings.metaApiToken);
      
      // Buscar todas as contas PAMM ativas que têm MetaApi ID
      const accounts = await prisma.pammAccount.findMany({
        where: { isActive: true, metaApiAccountId: { not: null } },
        include: { user: { include: { settings: true } } }
      });

      for (const acc of accounts) {
        if (acc.user.walletBalance <= 0) {
          // Gás acabou - Desativar cópia (remover do CopyFactory)
          console.log(`[PAMM] Utilizador ${acc.user.email} sem Gás. A desativar cópia...`);
          try {
            await metaApi.copyFactory.subscriberApi.updateSubscriber(acc.metaApiAccountId, { subscriptions: [] });
            await prisma.pammAccount.update({ where: { id: acc.id }, data: { isActive: false } });
          } catch (e) {
            console.error(`Erro ao desativar cópia para ${acc.accountNumber}:`, e.message);
          }
          continue;
        }

        // TODO: Buscar histórico de trades da MetaApi (metatraderAccountApi.getHistoricalTrades)
        // Calcular lucro (se houver lucro)
        // const profit = await fetchProfitFromMetaApi(acc.metaApiAccountId);
        // if (profit > 0) {
        //    const feePct = acc.user.settings?.pammPerformanceFeePct ?? settings.defaultPammPerformanceFee;
        //    const fee = profit * (feePct / 100);
        //    await prisma.user.update({ where: { id: acc.userId }, data: { walletBalance: { decrement: fee } } });
        //    await prisma.walletTransaction.create({ ... });
        // }
      }
    } catch (err) {
      console.error("[PAMM] Erro no worker:", err);
    }
  }, 3600000);
}

module.exports = {
  setupPammAccount,
  startPammWorker
};
