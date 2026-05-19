const fs = require('fs');

const files = ['AuraForex_V8_INSTITUTIONAL.mq5', 'public/AuraForex_V8_INSTITUTIONAL.mq5'];

files.forEach(file => {
   let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
   let modified = false;

   // 1. Inject PortfolioProfitLock structure
   const targetStruct = `struct ProfitLockData {
   ulong    ticket;
   double   peakProfit;   // Pico máximo de lucro atingido
   bool     active;       // ProfitLock activado para este ticket
   datetime activationTime; // Tempo de activação para buffer anti-spike
};`;

   const replacementStruct = `struct ProfitLockData {
   ulong    ticket;
   double   peakProfit;   // Pico máximo de lucro atingido
   bool     active;       // ProfitLock activado para este ticket
   datetime activationTime; // Tempo de activação para buffer anti-spike
};

struct PortfolioProfitLock {
   bool     active;
   double   peakProfit;
   datetime activationTime;
};`;

   if (content.includes(targetStruct)) {
      content = content.replace(targetStruct, replacementStruct);
      console.log(`[${file}] Struct injected successfully.`);
   }

   // 2. Inject GlobalProfitLockState global variable
   const targetVar = `ProfitLockData    ProfitLocks[];   // Array de monitoramento`;
   const replacementVar = `ProfitLockData    ProfitLocks[];   // Array de monitoramento
PortfolioProfitLock GlobalProfitLockState = {false, 0, 0}; // Estado do ProfitLock Global`;

   if (content.includes(targetVar)) {
      content = content.replace(targetVar, replacementVar);
      console.log(`[${file}] Global variable injected successfully.`);
   }

   // 3. Inject call in RunInstitutionalCore
   const targetCall = `      MonitorTrailingStop();
      MonitorPartialTP();
      MonitorProfitLock();`;
   const replacementCall = `      MonitorTrailingStop();
      MonitorPartialTP();
      MonitorProfitLock();
      MonitorGlobalProfitLock();`;

   if (content.includes(targetCall)) {
      content = content.replace(targetCall, replacementCall);
      console.log(`[${file}] Call injected successfully.`);
   }

   // 4. Inject function MonitorGlobalProfitLock definition
   const targetFuncEnd = `   // Limpar entradas de tickets já fechados
   CleanClosedPositions();
}`;

   const replacementFuncEnd = `   // Limpar entradas de tickets já fechados
   CleanClosedPositions();
}

//+------------------------------------------------------------------+
//| GLOBAL PORTFOLIO PROFIT LOCK                                    |
//+------------------------------------------------------------------+
void MonitorGlobalProfitLock()
{
   // 1. Calcular o lucro flutuante líquido atual das nossas ordens
   double currentNetProfit = 0;
   int openPositionsCount = 0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         long magic = PositionGetInteger(POSITION_MAGIC);
         if(magic == GetAuraMagic() || (InpManageManualOrders && magic == 0))
         {
            currentNetProfit += PositionGetDouble(POSITION_PROFIT);
            openPositionsCount++;
         }
      }
   }

   // Se não houver posições abertas, resetar o estado do ProfitLock Global
   if(openPositionsCount == 0)
   {
      if(GlobalProfitLockState.active)
      {
         GlobalProfitLockState.active = false;
         GlobalProfitLockState.peakProfit = 0;
         GlobalProfitLockState.activationTime = 0;
      }
      return;
   }

   // FASE 1: Activação do Profit Lock Global
   if(!GlobalProfitLockState.active)
   {
      double minGlobalActivation = InpProfitLockMin;
      
      if(currentNetProfit >= minGlobalActivation)
      {
         GlobalProfitLockState.active         = true;
         GlobalProfitLockState.peakProfit     = currentNetProfit;
         GlobalProfitLockState.activationTime = TimeCurrent();
         Print("🛡️ [GLOBAL PROFITLOCK] Ativado! Lucro Líquido: $", DoubleToString(currentNetProfit, 2), " | Meta Ativação: $", DoubleToString(minGlobalActivation, 2));
      }
   }
   else
   {
      // FASE 2: Atualizar o pico do lucro global
      if(currentNetProfit > GlobalProfitLockState.peakProfit)
      {
         GlobalProfitLockState.peakProfit = currentNetProfit;
      }

      // FASE 3: Verificar queda do pico baseada em InpProfitLockDrop (%)
      // Buffer de Tempo (Anti-Spike) de 30 segundos
      if(TimeCurrent() - GlobalProfitLockState.activationTime < 30) return;

      double peak = GlobalProfitLockState.peakProfit;
      double allowedDropMoney = peak * (InpProfitLockDrop / 100.0);
      if(allowedDropMoney < 0.5) allowedDropMoney = 0.5; // Limite mínimo viável

      double currentDropMoney = peak - currentNetProfit;

      if(currentDropMoney >= allowedDropMoney)
      {
         Print("🚨 [GLOBAL PROFITLOCK] Lucro Líquido recuou demais! Pico: $", DoubleToString(peak, 2), " | Atual: $", DoubleToString(currentNetProfit, 2), " | Queda: $", DoubleToString(currentDropMoney, 2), " >= Permitido: $", DoubleToString(allowedDropMoney, 2), " | Fechando TODAS as ordens...");
         
         CloseAllPositions();
         
         // Resetar estado após fecho total
         GlobalProfitLockState.active         = false;
         GlobalProfitLockState.peakProfit     = 0;
         GlobalProfitLockState.activationTime = 0;
      }
   }
}`;

   if (content.includes(targetFuncEnd)) {
      content = content.replace(targetFuncEnd, replacementFuncEnd);
      modified = true;
      console.log(`[${file}] Function definition injected successfully.`);
   }

   if (modified) {
      fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
      console.log(`✅ File saved successfully: ${file}`);
   }
});
