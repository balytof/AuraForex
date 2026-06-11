const fs = require('fs');
const file = 'public/AuraForex_V8_INSTITUTIONAL.mq5';
let content = fs.readFileSync(file, 'utf8');

// -------------------------------------------------------
// Step 1: Remove the bad injected block at the end (from the literal \n onwards)
// We'll strip from the "\\n\n//+---...INTELLIGENT XAU MODULE" marker to end of file
const injectedBlockStart = content.indexOf('\\\n\n//+------------------------------------------------------------------+\n//| INTELLIGENT XAU MODULE');
if (injectedBlockStart !== -1) {
  content = content.substring(0, injectedBlockStart) + '\n';
  console.log('Removed old injected block at char offset', injectedBlockStart);
} else {
  // Try alternate detection
  const alt = content.indexOf('struct XAUTimerData {');
  if (alt !== -1) {
    // find the start of the block header before the struct
    const blockStart = content.lastIndexOf('\n', alt - 50);
    content = content.substring(0, blockStart) + '\n';
    console.log('Removed old injected block (alt) at char offset', blockStart);
  } else {
    console.log('WARNING: Could not find injected block to remove');
  }
}

// -------------------------------------------------------
// Step 2: Move XAUTimerData struct + XAUTimers[] BEFORE the first function
// Insert after the existing struct declarations (after PortfolioProfitLock)
const insertAfter = '//--- GLOBAL VARIABLES ---';
const xauStruct = `
struct XAUTimerData {
   ulong    ticket;
   datetime posTime;
};
XAUTimerData XAUTimers[];

`;
if (content.indexOf('struct XAUTimerData') === -1) {
  content = content.replace(insertAfter, xauStruct + insertAfter);
  console.log('Inserted XAUTimerData struct before globals');
} else {
  console.log('XAUTimerData struct already in global scope');
}

// -------------------------------------------------------
// Step 3: Inject MonitorIntelligentXAU call in RunInstitutionalCore after MonitorTrailingStop
const coreTarget = 'MonitorTrailingStop();';
if (content.indexOf('MonitorTrailingStop();\n      MonitorIntelligentXAU();') === -1) {
  content = content.replace(coreTarget, 'MonitorTrailingStop();\n      MonitorIntelligentXAU();');
  console.log('Injected MonitorIntelligentXAU() call in RunInstitutionalCore');
} else {
  console.log('MonitorIntelligentXAU call already present');
}

// -------------------------------------------------------
// Step 4: Append the full, clean implementation at the end
const newFunctions = `
//+------------------------------------------------------------------+
//| XAU INTELLIGENT TREND MODULE                                     |
//+------------------------------------------------------------------+
int GetXAUTrend(string sym)
{
   if(!g_XAU_AutoTrend) return 0;

   double emaFast[], emaSlow[];
   ArraySetAsSeries(emaFast, true);
   ArraySetAsSeries(emaSlow, true);

   int hFast = iMA(sym, g_XAU_Timeframe, g_XAU_EmaFast, 0, MODE_EMA, PRICE_CLOSE);
   int hSlow  = iMA(sym, g_XAU_Timeframe, g_XAU_EmaSlow, 0, MODE_EMA, PRICE_CLOSE);

   if(hFast == INVALID_HANDLE || hSlow == INVALID_HANDLE) return 0;

   if(CopyBuffer(hFast, 0, 0, 3, emaFast) <= 0) { IndicatorRelease(hFast); IndicatorRelease(hSlow); return 0; }
   if(CopyBuffer(hSlow, 0, 0, 3, emaSlow) <= 0) { IndicatorRelease(hFast); IndicatorRelease(hSlow); return 0; }

   IndicatorRelease(hFast);
   IndicatorRelease(hSlow);

   double diff    = emaFast[0] - emaSlow[0];
   double minDiff = SymbolInfoDouble(sym, SYMBOL_POINT) * 50; // Needs at least 5 pips gap to be "strong"

   if(diff >  minDiff) return  1; // Strong uptrend
   if(diff < -minDiff) return -1; // Strong downtrend
   return 0; // Neutral - no trade
}

int CountXAUOrders()
{
   int c = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t > 0 && PositionSelectByTicket(t))
      {
         if(IsXAU(PositionGetString(POSITION_SYMBOL)) && PositionGetInteger(POSITION_MAGIC) == GetAuraMagic())
            c++;
      }
   }
   return c;
}

void CloseXAUPosition(ulong ticket)
{
   if(!PositionSelectByTicket(ticket)) return;
   string sym = PositionGetString(POSITION_SYMBOL);
   trade.SetTypeFillingBySymbol(sym);
   for(int i = 0; i < 3; i++)
   {
      if(trade.PositionClose(ticket, 30)) return;
      Print("⚠️ CloseXAUPosition retry ", i+1, " | ", trade.ResultRetcodeDescription());
      Sleep(200);
   }
}

void MonitorIntelligentXAU()
{
   if(!g_XAU_AutoTrend)              return;
   if(IsFridayLocked())               return;
   if(DailyTargetReached)             return;
   if(DailyLossLock)                  return;

   // -------------------------------------------------------
   // Phase 1: Basket Reversal — close wrong-direction trades
   // Collect unique XAU symbols that have open positions
   // -------------------------------------------------------
   string activeSymbols[];
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t <= 0 || !PositionSelectByTicket(t)) continue;
      if(PositionGetInteger(POSITION_MAGIC) != GetAuraMagic()) continue;
      string sym = PositionGetString(POSITION_SYMBOL);
      if(!IsXAU(sym)) continue;

      bool found = false;
      for(int j = 0; j < ArraySize(activeSymbols); j++)
         if(activeSymbols[j] == sym) { found = true; break; }
      if(!found)
      {
         int sz = ArraySize(activeSymbols);
         ArrayResize(activeSymbols, sz + 1);
         activeSymbols[sz] = sym;
      }
   }

   for(int s = 0; s < ArraySize(activeSymbols); s++)
   {
      string sym   = activeSymbols[s];
      int    trend = GetXAUTrend(sym);
      if(trend == 0) continue;

      double buyProfit = 0, sellProfit = 0;

      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         ulong t = PositionGetTicket(i);
         if(t <= 0 || !PositionSelectByTicket(t)) continue;
         if(PositionGetString(POSITION_SYMBOL) != sym) continue;
         if(PositionGetInteger(POSITION_MAGIC) != GetAuraMagic()) continue;

         double pnl = PositionGetDouble(POSITION_PROFIT)
                    + PositionGetDouble(POSITION_SWAP)
                    + PositionGetDouble(POSITION_COMMISSION);

         if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)  buyProfit  += pnl;
         else                                                          sellProfit += pnl;
      }

      // Trend reversed to DOWN -> close BUY trades that are in profit
      if(trend == -1 && buyProfit > 0)
      {
         Print("🔄 [XAU] Reversão para BAIXA. Fechando BUYs em lucro: $", DoubleToString(buyProfit, 2));
         for(int i = PositionsTotal() - 1; i >= 0; i--)
         {
            ulong t = PositionGetTicket(i);
            if(t <= 0 || !PositionSelectByTicket(t)) continue;
            if(PositionGetString(POSITION_SYMBOL) != sym) continue;
            if(PositionGetInteger(POSITION_MAGIC) != GetAuraMagic()) continue;
            if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
               CloseXAUPosition(t);
         }
      }

      // Trend reversed to UP -> close SELL trades that are in profit
      if(trend == 1 && sellProfit > 0)
      {
         Print("🔄 [XAU] Reversão para ALTA. Fechando SELLs em lucro: $", DoubleToString(sellProfit, 2));
         for(int i = PositionsTotal() - 1; i >= 0; i--)
         {
            ulong t = PositionGetTicket(i);
            if(t <= 0 || !PositionSelectByTicket(t)) continue;
            if(PositionGetString(POSITION_SYMBOL) != sym) continue;
            if(PositionGetInteger(POSITION_MAGIC) != GetAuraMagic()) continue;
            if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL)
               CloseXAUPosition(t);
         }
      }
   }

   // -------------------------------------------------------
   // Phase 2: Machine Gun — time-based close + re-entry
   // -------------------------------------------------------
   bool   closedAny       = false;
   string lastClosedSym   = "";
   int    lastClosedTrend = 0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t <= 0 || !PositionSelectByTicket(t)) continue;
      if(PositionGetInteger(POSITION_MAGIC) != GetAuraMagic()) continue;

      string sym = PositionGetString(POSITION_SYMBOL);
      if(!IsXAU(sym)) continue;

      double profit = PositionGetDouble(POSITION_PROFIT)
                    + PositionGetDouble(POSITION_SWAP)
                    + PositionGetDouble(POSITION_COMMISSION);

      // Find this ticket in our timer array
      int idx = -1;
      for(int k = 0; k < ArraySize(XAUTimers); k++)
         if(XAUTimers[k].ticket == t) { idx = k; break; }

      if(profit > 0)
      {
         if(idx == -1)
         {
            // Start timer
            int sz = ArraySize(XAUTimers);
            ArrayResize(XAUTimers, sz + 1);
            XAUTimers[sz].ticket  = t;
            XAUTimers[sz].posTime = TimeCurrent();
         }
         else if(TimeCurrent() - XAUTimers[idx].posTime >= (datetime)g_XAU_HoldSeconds)
         {
            // Time elapsed in positive -> close and re-enter
            int currentTrend = GetXAUTrend(sym);
            Print("⏱️ [XAU] Fecho por tempo! Ticket:", t,
                  " Lucro:$", DoubleToString(profit, 2),
                  " Segundos:", g_XAU_HoldSeconds,
                  " Tendência:", currentTrend == 1 ? "ALTA" : (currentTrend == -1 ? "BAIXA" : "NEUTRA"));

            if(currentTrend != 0) // Only close & re-enter if trend is still valid
            {
               lastClosedSym   = sym;
               lastClosedTrend = currentTrend;
               CloseXAUPosition(t);
               closedAny = true;
               XAUTimers[idx].ticket = 0; // Mark for cleanup
            }
            else
            {
               // Trend gone neutral — reset timer, don't force close
               XAUTimers[idx].posTime = TimeCurrent();
            }
         }
      }
      else
      {
         // Profit went negative or zero — RESET timer
         if(idx != -1)
            XAUTimers[idx].posTime = TimeCurrent();
      }
   }

   // Compact timer array (remove zeroed entries)
   int valid = 0;
   for(int k = 0; k < ArraySize(XAUTimers); k++)
   {
      if(XAUTimers[k].ticket != 0)
      {
         if(valid != k) XAUTimers[valid] = XAUTimers[k];
         valid++;
      }
   }
   if(valid < ArraySize(XAUTimers)) ArrayResize(XAUTimers, valid);

   // -------------------------------------------------------
   // Phase 3: Re-Entry after machine-gun close
   // -------------------------------------------------------
   if(closedAny && lastClosedTrend != 0 && CountXAUOrders() < g_MaxXAUOrders)
   {
      Sleep(300); // small pause to ensure close settled
      string dir    = (lastClosedTrend == 1) ? "BUY" : "SELL";
      double point  = SymbolInfoDouble(lastClosedSym, SYMBOL_POINT);
      double ask    = SymbolInfoDouble(lastClosedSym, SYMBOL_ASK);
      double bid    = SymbolInfoDouble(lastClosedSym, SYMBOL_BID);
      double entry  = (dir == "BUY") ? ask : bid;
      double sl     = (dir == "BUY")
                      ? entry - (g_MaxSLOuro * point)
                      : entry + (g_MaxSLOuro * point);
      double minLot = SymbolInfoDouble(lastClosedSym, SYMBOL_VOLUME_MIN);
      double lot    = CalculateLot(lastClosedSym, GetAdjustedRisk(), MathAbs(entry - sl), (dir == "BUY") ? ORDER_TYPE_BUY : ORDER_TYPE_SELL);
      if(lot <= 0) lot = minLot;

      trade.SetTypeFillingBySymbol(lastClosedSym);
      bool ok = false;
      if(dir == "BUY")  ok = trade.Buy(lot,  lastClosedSym, entry, sl, 0, "Aura XAU Machine Gun");
      else               ok = trade.Sell(lot, lastClosedSym, entry, sl, 0, "Aura XAU Machine Gun");

      if(ok) Print("🔫 [XAU] Machine Gun re-entrada ", dir, " | Lot:", DoubleToString(lot,2), " | SL:", DoubleToString(sl,5));
      else   Print("❌ [XAU] Falha na re-entrada: ", trade.ResultRetcodeDescription());
   }
}
`;

content = content.trimEnd() + '\n' + newFunctions + '\n';
fs.writeFileSync(file, content);
console.log('XAU Module rebuilt and injected successfully. Total chars:', content.length);
