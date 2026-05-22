const MetaApi = require('metaapi.cloud-sdk').default;
const CopyFactory = require('metaapi.cloud-sdk').CopyFactory;

async function setupPammAccount(settings, accountNumber, serverName, password, existingMetaApiAccountId = null) {
  if (!settings.metaApiToken) {
    throw new Error("Token da MetaApi não está configurado no Painel Admin.");
  }
  
  const metaApi = new MetaApi(settings.metaApiToken);
  
  try {
    // Tenta detetar a plataforma com base no nome do servidor
    const platform = (serverName.toLowerCase().includes('mt5') || serverName.toLowerCase().includes('deriv')) ? 'mt5' : 'mt4';
    
    let account = null;

    if (existingMetaApiAccountId) {
      try {
        account = await metaApi.metatraderAccountApi.getAccount(existingMetaApiAccountId);
        console.log(`[PAMM] Reutilizando conta MetaApi existente: ${account.id}`);
      } catch (err) {
        console.log(`[PAMM] Conta existente (${existingMetaApiAccountId}) não encontrada na MetaApi. A criar nova...`);
        account = null;
      }
    }

    if (!account) {
      // 1. Criar a conta na MetaApi
      console.log(`[PAMM] A criar nova conta no MetaApi para ${accountNumber} (${platform})...`);
      account = await metaApi.metatraderAccountApi.createAccount({
        name: `Cliente PAMM ${accountNumber}`,
        type: 'cloud-g2',
        login: accountNumber,
        password: password,
        server: serverName,
        platform: platform,
        magic: 1000,
        copyFactoryRoles: ['SUBSCRIBER']
      });
      console.log(`[PAMM] Conta criada na MetaApi. ID: ${account.id}.`);
    }

    console.log(`[PAMM] A fazer deploy da conta ${account.id}...`);
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
    const copyFactory = new CopyFactory(settings.metaApiToken);
    
    // Verifica se a Master tem o role PROVIDER
    try {
      const masterAccount = await metaApi.metatraderAccountApi.getAccount(masterId);
      const roles = masterAccount.copyFactoryRoles || [];
      if (!roles.includes('PROVIDER')) {
        roles.push('PROVIDER');
        await masterAccount.enableCopyFactoryApi(roles);
        console.log(`[PAMM] Role PROVIDER ativado para a conta Master ${masterId}`);
      }
    } catch (err) {
      console.log(`[PAMM] Aviso: não foi possível verificar/ativar role na Master: ${err.message}`);
    }

    // Obter o ID da Estratégia correspondente ao masterId (que pode ser um Account ID)
    const strategies = await copyFactory.configurationApi.getStrategiesWithInfiniteScrollPagination();
    let strategy = strategies.find(s => s.accountId === masterId || s._id === masterId);
    let strategyId;
    if (strategy) {
      strategyId = strategy._id;
    } else {
      const generated = await copyFactory.configurationApi.generateStrategyId();
      strategyId = generated.id;
      await copyFactory.configurationApi.updateStrategy(strategyId, {
        name: `Master Strategy ${masterId}`,
        description: 'PAMM Strategy for CopyFactory',
        accountId: masterId
      });
    }

    // Adiciona como subscriber se ainda não estiver
    await copyFactory.configurationApi.updateSubscriber(account.id, {
      name: `Subscriber PAMM ${accountNumber}`,
      subscriptions: [
        {
          strategyId: strategyId,
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

async function togglePammConnection(settings, metaApiAccountId, isActive) {
  if (!settings.metaApiToken) {
    throw new Error("Token da MetaApi não está configurado no Painel Admin.");
  }
  const metaApi = new MetaApi(settings.metaApiToken);

  try {
    const copyFactory = new CopyFactory(settings.metaApiToken);
    
    if (isActive) {
      const masterId = settings.pammMasterAccountId || settings.metaApiAccountId;
      if (!masterId) throw new Error("Conta Master PAMM não configurada no Admin.");
      
      try {
        const masterAccount = await metaApi.metatraderAccountApi.getAccount(masterId);
        const roles = masterAccount.copyFactoryRoles || [];
        if (!roles.includes('PROVIDER')) {
          roles.push('PROVIDER');
          await masterAccount.enableCopyFactoryApi(roles);
        }
      } catch (e) {}

      const strategies = await copyFactory.configurationApi.getStrategiesWithInfiniteScrollPagination();
      let strategy = strategies.find(s => s.accountId === masterId || s._id === masterId);
      let strategyId;
      if (strategy) {
        strategyId = strategy._id;
      } else {
        const generated = await copyFactory.configurationApi.generateStrategyId();
        strategyId = generated.id;
        await copyFactory.configurationApi.updateStrategy(strategyId, {
          name: `Master Strategy ${masterId}`,
          description: 'PAMM Strategy for CopyFactory',
          accountId: masterId
        });
      }

      await copyFactory.configurationApi.updateSubscriber(metaApiAccountId, {
        subscriptions: [
          {
            strategyId: strategyId,
            multiplier: 1.0
          }
        ]
      });
      console.log(`[PAMM] Cópia LIGADA para a conta ${metaApiAccountId}`);
    } else {
      // Para desligar as cópias, removemos as subscrições.
      // As ordens já abertas seguem normalmente até SL/TP.
      await copyFactory.configurationApi.updateSubscriber(metaApiAccountId, {
        subscriptions: []
      });
      console.log(`[PAMM] Cópia DESLIGADA para a conta ${metaApiAccountId}`);
    }
    return { success: true };
  } catch (err) {
    console.error("[PAMM] Erro ao alterar estado da cópia:", err);
    throw new Error(err.message || "Erro ao comunicar com MetaApi.");
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
      const copyFactory = new CopyFactory(settings.metaApiToken);
      
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
            await copyFactory.configurationApi.updateSubscriber(acc.metaApiAccountId, { subscriptions: [] });
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

async function getPammAccountStats(settings, metaApiAccountId) {
  if (!settings.metaApiToken || !metaApiAccountId) return null;
  const metaApi = new MetaApi(settings.metaApiToken);
  try {
    const account = await metaApi.metatraderAccountApi.getAccount(metaApiAccountId);
    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();
    const info = await connection.getAccountInformation();
    
    // Podemos também pegar histórico de lucro/perda mais tarde se necessário
    return {
      balance: info.balance,
      equity: info.equity,
      margin: info.margin,
      freeMargin: info.freeMargin
    };
  } catch (err) {
    console.error(`[PAMM] Erro ao buscar stats da conta ${metaApiAccountId}:`, err.message);
    return null;
  }
}

module.exports = {
  setupPammAccount,
  startPammWorker,
  togglePammConnection,
  getPammAccountStats
};
