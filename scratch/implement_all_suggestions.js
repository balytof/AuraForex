const fs = require('fs');

const files = ['AuraForex_V8_INSTITUTIONAL.mq5', 'public/AuraForex_V8_INSTITUTIONAL.mq5'];

files.forEach(file => {
   let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
   let modified = false;

   // 1. Inject new parameters at the top
   const targetInputs = `input bool   InpManageManualOrders = true;     // Gerir Ordens Manuais (Magic 0)
input double InpDailyTargetPct     = 5.0;      // Meta Diária (% de Lucro)
input double InpMaxDailyLossPct    = 10.0;     // Perda Máxima Diária (%)`;

   const replacementInputs = `input bool   InpManageManualOrders = true;     // Gerir Ordens Manuais (Magic 0)
input double InpDailyTargetPct     = 5.0;      // Meta Diária (% de Lucro)
input double InpMaxDailyLossPct    = 10.0;     // Perda Máxima Diária (%)

// --- TRAVA DE META DIÁRIA (DAILY TARGET PROFIT LOCK) ---
input bool   InpDailyTargetLockActive = true;  // Ativar Trava de Meta Diária
input double InpDailyTargetLockPct   = 80.0;  // Ativar Trava ao atingir % da Meta (ex: 80%)
input double InpDailyTargetFloorPct  = 50.0;  // Lucro Mínimo Garantido ao reverter % (ex: 50%)

// --- BE INTELIGENTE + CUSTOS (BREAKEVEN PLUS COSTS) ---
input bool   InpBreakevenEnabled     = true;   // Ativar Breakeven Inteligente
input int    InpBreakevenTrigger     = 40;     // Gatilho do Breakeven (4.0 pips de lucro)
input int    InpBreakevenSecure      = 10;     // Pips Extras a Garantir (BE + 1.0 pip)

// --- SEXTA-FEIRA SEGURA (FRIDAY SAFE LOCK) ---
input bool   InpFridaySafeLock       = true;   // Fechar Sexta-feira Fim do Dia
input int    InpFridayHour           = 20;     // Hora de fecho na Sexta-feira (GMT/Broker)
input int    InpFridayMinute         = 0;      // Minuto de fecho na Sexta-feira

// --- FILTRO DE SPREAD (SPREAD SPIKE GUARDIAN) ---
input bool   InpSpreadGuardianActive = true;   // Ativar Spread Spike Guardian
input double InpMaxSpreadPips        = 5.0;    // Spread Máximo Permitido para Modificações (Pips)`;

   if (content.includes(targetInputs)) {
      content = content.replace(targetInputs, replacementInputs);
      console.log(`[${file}] Inputs injected successfully.`);
   }

   // 2. Inject global tracking variables for Daily Target Profit Lock
   const targetGlobals = `bool              DailyTargetReached = false;
bool              DailyLossLock      = false; // Bloqueio por perda diária`;

   const replacementGlobals = `bool              DailyTargetReached = false;
bool              DailyLossLock      = false; // Bloqueio por perda diária
double            DailyPeakPnL       = 0;     // Pico de lucro diário atingido
bool              DailyTargetLockActive = false; // Se a trava diária foi ativada`;

   if (content.includes(targetGlobals)) {
      content = content.replace(targetGlobals, replacementGlobals);
      console.log(`[${file}] Global variables injected successfully.`);
   }

   // 3. Inject new calls in RunInstitutionalCore
   const targetCalls = `      CheckDailyLoss();
      CheckDailyTarget();`;

   const replacementCalls = `      CheckDailyLoss();
      CheckDailyTarget();
      CheckFridaySafeLock();
      ApplyBreakeven();`;

   if (content.includes(targetCalls)) {
      content = content.replace(targetCalls, replacementCalls);
      console.log(`[${file}] Calls injected successfully.`);
   }

   // 4. Inject Spread Guardian check in MonitorTrailingStop
   const targetTrailingLoop = `      double trailStart = InpTrailingStart    * point;
      double trailStep  = InpTrailingStep     * point;
      double trailDist  = InpTrailingDistance * point;`;

   const replacementTrailingLoop = `      // SPREAD SPIKE GUARDIAN CHECK
      if(InpSpreadGuardianActive)
      {
         double spread = (ask - bid) / point;
         if(spread > InpMaxSpreadPips) continue; // Pular se o spread estiver alargado (notícia)
      }

      double trailStart = InpTrailingStart    * point;
      double trailStep  = InpTrailingStep     * point;
      double trailDist  = InpTrailingDistance * point;`;

   if (content.includes(targetTrailingLoop)) {
      content = content.replace(targetTrailingLoop, replacementTrailingLoop);
      console.log(`[${file}] Spread Guardian injected in Trailing loop successfully.`);
   }

   // 5. Replace CheckDailyTarget to support Daily Target Profit Lock
   const targetDailyTargetFunc = `   // CÁLCULO PRECISO DO LUCRO DIÁRIO DO PRÓPRIO BOT (Closed + Open)
   double dailyPnL = GetDailyPnL();
   double targetProfit = DailyStartEquity * (InpDailyTargetPct / 100.0);

   if(dailyPnL >= targetProfit)
   {
      DailyTargetReached = true;
      Print("🏆 [DAILY] META ATINGIDA PELO BOT: $", DoubleToString(dailyPnL, 2), " >= Meta: $", DoubleToString(targetProfit, 2), " | Fechando posições...");
      
      CloseAllPositions();
   }`;

   const replacementDailyTargetFunc = `   // CÁLCULO PRECISO DO LUCRO DIÁRIO DO PRÓPRIO BOT (Closed + Open)
   double dailyPnL = GetDailyPnL();
   double targetProfit = DailyStartEquity * (InpDailyTargetPct / 100.0);

   // 1. Meta 100% atingida de imediato
   if(dailyPnL >= targetProfit)
   {
      DailyTargetReached = true;
      Print("🏆 [DAILY] META ATINGIDA PELO BOT: $", DoubleToString(dailyPnL, 2), " >= Meta: $", DoubleToString(targetProfit, 2), " | Fechando posições...");
      
      CloseAllPositions();
      DailyTargetLockActive = false;
      DailyPeakPnL = 0;
      return;
   }

   // 2. Lógica da Trava de Segurança Diária (Daily Target Profit Lock)
   if(InpDailyTargetLockActive)
   {
      double activationThreshold = targetProfit * (InpDailyTargetLockPct / 100.0);
      double floorProfit         = targetProfit * (InpDailyTargetFloorPct / 100.0);

      // Ativar trava ao alcançar o gatilho (ex: 80% da meta)
      if(!DailyTargetLockActive && dailyPnL >= activationThreshold)
      {
         DailyTargetLockActive = true;
         DailyPeakPnL = dailyPnL;
         Print("🛡️ [DAILY LOCK] Ativado! Lucro Diário: $", DoubleToString(dailyPnL, 2), 
               " atingiu o gatilho de ", InpDailyTargetLockPct, "% ($", DoubleToString(activationThreshold, 2), ")");
      }

      if(DailyTargetLockActive)
      {
         // Atualizar pico diário
         if(dailyPnL > DailyPeakPnL) DailyPeakPnL = dailyPnL;

         // Se cair abaixo do lucro mínimo garantido (ex: 50% da meta), fechar tudo
         if(dailyPnL <= floorProfit)
         {
            DailyTargetReached = true;
            Print("🛑 [DAILY LOCK] Lucro recuou ao limite mínimo garantido de ", InpDailyTargetFloorPct, 
                  "% ($", DoubleToString(floorProfit, 2), ") | Lucro Atual: $", DoubleToString(dailyPnL, 2), 
                  " (Pico: $", DoubleToString(DailyPeakPnL, 2), ") | Fechando tudo para trancar lucros!");
            
            CloseAllPositions();
            DailyTargetLockActive = false;
            DailyPeakPnL = 0;
         }
      }
   }`;

   if (content.includes(targetDailyTargetFunc)) {
      content = content.replace(targetDailyTargetFunc, replacementDailyTargetFunc);
      console.log(`[${file}] CheckDailyTarget updated successfully.`);
   }

   // 6. Inject helper functions: GetBreakevenPrice, ApplyBreakeven, CheckFridaySafeLock
   const targetFuncEnd = `//+------------------------------------------------------------------+
//| GLOBAL PORTFOLIO PROFIT LOCK                                    |
//+------------------------------------------------------------------+`;

   const replacementFuncEnd = `//+------------------------------------------------------------------+
//| BREAKEVEN INTELIGENTE + CUSTOS                                   |
//+------------------------------------------------------------------+
double GetBreakevenPrice(ulong ticket, double openPrice, int posType, double volume, string sym)
{
   double point    = SymbolInfoDouble(sym, SYMBOL_POINT);
   double tickVal  = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
   double tickSize = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
   
   if(point <= 0 || tickSize <= 0 || tickVal <= 0 || volume <= 0) 
      return openPrice;
      
   double commission = PositionGetDouble(POSITION_COMMISSION);
   double swap       = PositionGetDouble(POSITION_SWAP);
   
   double totalCost = 0;
   if(commission < 0) totalCost += MathAbs(commission);
   if(swap < 0)       totalCost += MathAbs(swap);
   
   double extraProfit = InpBreakevenSecure * point;
   double priceOffset = totalCost / (volume * (tickVal / tickSize));
   
   double bePrice = openPrice;
   if(posType == POSITION_TYPE_BUY)
   {
      bePrice = openPrice + priceOffset + extraProfit;
   }
   else if(posType == POSITION_TYPE_SELL)
   {
      bePrice = openPrice - priceOffset - extraProfit;
   }
   
   return bePrice;
}

void ApplyBreakeven()
{
   if(!InpBreakevenEnabled) return;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      long magic = PositionGetInteger(POSITION_MAGIC);
      string sym = PositionGetString(POSITION_SYMBOL);

      if(magic != GetAuraMagic() && (!InpManageManualOrders || magic != 0)) continue;

      double point     = SymbolInfoDouble(sym, SYMBOL_POINT);
      int    digits    = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      double ask       = SymbolInfoDouble(sym, SYMBOL_ASK);
      double bid       = SymbolInfoDouble(sym, SYMBOL_BID);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentSL = PositionGetDouble(POSITION_SL);
      double volume    = PositionGetDouble(POSITION_VOLUME);
      int    posType   = (int)PositionGetInteger(POSITION_TYPE);

      if(InpSpreadGuardianActive)
      {
         double spread = (ask - bid) / point;
         if(spread > InpMaxSpreadPips) continue;
      }

      double triggerDist = InpBreakevenTrigger * point;
      double bePrice = GetBreakevenPrice(ticket, openPrice, posType, volume, sym);

      if(posType == POSITION_TYPE_BUY)
      {
         if(bid - openPrice >= triggerDist)
         {
            double targetSL = NormalizeDouble(bePrice, digits);
            if(currentSL < targetSL)
            {
               ResetLastError();
               if(trade.PositionModify(ticket, targetSL, PositionGetDouble(POSITION_TP)))
               {
                  Print("🛡️ [BE SECURE] Breakeven ativado | Buy Ticket: ", ticket, " | SL definido para: ", DoubleToString(targetSL, digits));
               }
            }
         }
      }
      else if(posType == POSITION_TYPE_SELL)
      {
         if(openPrice - ask >= triggerDist)
         {
            double targetSL = NormalizeDouble(bePrice, digits);
            if(currentSL > targetSL || currentSL == 0)
            {
               ResetLastError();
               if(trade.PositionModify(ticket, targetSL, PositionGetDouble(POSITION_TP)))
               {
                  Print("🛡️ [BE SECURE] Breakeven ativado | Sell Ticket: ", ticket, " | SL definido para: ", DoubleToString(targetSL, digits));
               }
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| SEXTA-FEIRA SEGURA (FRIDAY SAFE LOCK)                            |
//+------------------------------------------------------------------+
void CheckFridaySafeLock()
{
   if(!InpFridaySafeLock) return;

   MqlDateTime dt;
   TimeCurrent(dt);

   if(dt.day_of_week == 5)
   {
      if(dt.hour > InpFridayHour || (dt.hour == InpFridayHour && dt.min >= InpFridayMinute))
      {
         int openCount = 0;
         for(int i = PositionsTotal() - 1; i >= 0; i--)
         {
            ulong ticket = PositionGetTicket(i);
            if(ticket > 0 && PositionSelectByTicket(ticket))
            {
               long magic = PositionGetInteger(POSITION_MAGIC);
               if(magic == GetAuraMagic() || (InpManageManualOrders && magic == 0))
               {
                  openCount++;
               }
            }
         }

         if(openCount > 0)
         {
            Print("📅 [FRIDAY SAFE LOCK] Sexta-feira fim de dia atingido (", 
                  dt.hour, ":", dt.min, ") | Fechando todas as ordens para evitar riscos de fim de semana...");
            CloseAllPositions();
         }
      }
   }
}

//+------------------------------------------------------------------+
//| GLOBAL PORTFOLIO PROFIT LOCK                                    |
//+------------------------------------------------------------------+`;

   if (content.includes(targetFuncEnd)) {
      content = content.replace(targetFuncEnd, replacementFuncEnd);
      modified = true;
      console.log(`[${file}] Helper functions injected successfully.`);
   }

   if (modified) {
      fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
      console.log(`✅ File updated successfully: ${file}`);
   } else {
      console.error(`❌ No replacements made in: ${file}`);
   }
});
