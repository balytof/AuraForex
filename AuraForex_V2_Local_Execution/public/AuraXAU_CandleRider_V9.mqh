//+------------------------------------------------------------------+
//|  AuraXAU_CandleRider.mqh                                        |
//|  Candle Trend Rider â€” Escalona ordens ao longo da vela          |
//|  enquanto a tendÃªncia se mantÃ©m, fecha tudo na reversÃ£o         |
//+------------------------------------------------------------------+

#ifndef AURA_CANDLE_RIDER_MQH
#define AURA_CANDLE_RIDER_MQH

#include "AuraXAU_HedgeFundEngine.mqh"

//+------------------------------------------------------------------+
//| PARÃ‚METROS DE INPUT â€” adicionar ao bloco input do EA principal   |
//+------------------------------------------------------------------+
/*
   Copiar para AuraForex_SMC_V8.mq5 (bloco de inputs):

   input bool   CR_Enable              = true;    // [CandleRider] Activar Scalper de Vela
   input int    CR_EMA_Period          = 50;       // [CandleRider] PerÃ­odo EMA de TendÃªncia
   input int    CR_EMA_Timeframe       = 15;       // [CandleRider] Timeframe EMA (min)
   input int    CR_StepPoints          = 80;       // [CandleRider] DistÃ¢ncia entre ordens (pts)
   input int    CR_MaxOrdersPerCandle  = 5;        // [CandleRider] MÃ¡x ordens por vela
   input int    CR_SL_Points           = 300;      // [CandleRider] Stop Loss fixo (pts)
   input int    CR_TP_Points           = 200;      // [CandleRider] Take Profit por ordem (pts)
   input int    CR_ReversalPoints      = 120;      // [CandleRider] ReversÃ£o p/ fechar grupo (pts)
   input int    CR_Timeframe           = 15;       // [CandleRider] Timeframe da vela (min)
   input double CR_RiskPercent         = 0.5;      // [CandleRider] Risco por ordem (%)
   input bool   CR_TrailingGroup       = true;     // [CandleRider] Trailing global do grupo
   input int    CR_TrailingStart       = 150;      // [CandleRider] Trailing Start (pts)
   input int    CR_TrailingDistance    = 200;      // [CandleRider] Trailing Distance (pts)
   input int    CR_TrailingStep        = 40;       // [CandleRider] Trailing Step (pts)
*/

//+------------------------------------------------------------------+
//| VARIÃVEIS GLOBAIS â€” adicionar ao bloco de globals do EA          |
//+------------------------------------------------------------------+
/*
   bool   g_CR_Enable             = true;
   int    g_CR_EMA_Period         = 50;
   int    g_CR_EMA_Timeframe      = 15;
   int    g_CR_StepPoints         = 80;
   int    g_CR_MaxOrdersPerCandle = 5;
   int    g_CR_SL_Points          = 300;
   int    g_CR_TP_Points          = 200;
   int    g_CR_ReversalPoints     = 120;
   int    g_CR_Timeframe          = 15;
   double g_CR_RiskPercent        = 0.5;
   bool   g_CR_TrailingGroup      = true;
   int    g_CR_TrailingStart      = 150;
   int    g_CR_TrailingDistance   = 200;
   int    g_CR_TrailingStep       = 40;
*/

//+------------------------------------------------------------------+
//| ESTRUTURA DE ESTADO DO GRUPO DE ORDENS DA VELA ATUAL            |
//+------------------------------------------------------------------+
struct CandleRiderGroup
{
   datetime  candleTime;       // Tempo de abertura da vela activa
   int       direction;        // 1 = BUY, -1 = SELL, 0 = sem grupo
   double    extremePrice;     // MÃ¡ximo (BUY) ou MÃ­nimo (SELL) desde abertura do grupo
   double    lastEntryPrice;   // PreÃ§o da Ãºltima ordem aberta
   int       orderCount;       // NÃºmero de ordens abertas neste grupo
   bool      closed;           // Grupo jÃ¡ foi fechado (reversÃ£o detectada)
};

CandleRiderGroup g_CR_Group;
int              g_CR_EmaHandle = INVALID_HANDLE;

//+------------------------------------------------------------------+
//| INICIALIZAÃ‡ÃƒO â€” chamar em OnInit()                               |
//+------------------------------------------------------------------+
void CandleRider_Init()
{
   ZeroMemory(g_CR_Group);
   g_CR_Group.direction = 0;

   ENUM_TIMEFRAMES tf = CandleRider_GetTF(g_CR_EMA_Timeframe);
   if(g_CR_EmaHandle != INVALID_HANDLE)
      IndicatorRelease(g_CR_EmaHandle);

   g_CR_EmaHandle = iMA("XAUUSD", tf, g_CR_EMA_Period, 0, MODE_EMA, PRICE_CLOSE);
   if(g_CR_EmaHandle == INVALID_HANDLE)
   {
      // Fallback para sÃ­mbolo com sufixo
      g_CR_EmaHandle = iMA("XAUUSDm", tf, g_CR_EMA_Period, 0, MODE_EMA, PRICE_CLOSE);
   }
   Print("âœ… [CandleRider] Inicializado | EMA Handle: ", g_CR_EmaHandle);
}

//+------------------------------------------------------------------+
//| DEINIT â€” chamar em OnDeinit()                                    |
//+------------------------------------------------------------------+
void CandleRider_Deinit()
{
   if(g_CR_EmaHandle != INVALID_HANDLE)
   {
      IndicatorRelease(g_CR_EmaHandle);
      g_CR_EmaHandle = INVALID_HANDLE;
   }
}

//+------------------------------------------------------------------+
//| HELPER: Converter minutos â†’ ENUM_TIMEFRAMES                     |
//+------------------------------------------------------------------+
ENUM_TIMEFRAMES CandleRider_GetTF(int minutes)
{
   switch(minutes)
   {
      case 1:    return PERIOD_M1;
      case 5:    return PERIOD_M5;
      case 15:   return PERIOD_M15;
      case 30:   return PERIOD_M30;
      case 60:   return PERIOD_H1;
      case 240:  return PERIOD_H4;
      case 1440: return PERIOD_D1;
      default:   return PERIOD_M15;
   }
}

//+------------------------------------------------------------------+
//| HELPER: Obter valor actual da EMA                                |
//+------------------------------------------------------------------+
double CandleRider_GetEMA(string sym)
{
   if(g_CR_EmaHandle == INVALID_HANDLE)
   {
      ENUM_TIMEFRAMES tf = CandleRider_GetTF(g_CR_EMA_Timeframe);
      g_CR_EmaHandle = iMA(sym, tf, g_CR_EMA_Period, 0, MODE_EMA, PRICE_CLOSE);
   }
   double buf[];
   ArraySetAsSeries(buf, true);
   if(CopyBuffer(g_CR_EmaHandle, 0, 0, 1, buf) > 0)
      return buf[0];
   return 0;
}

//+------------------------------------------------------------------+
//| HELPER: Detectar tendência da vela actual                        |
//|  Integração V9: Usa o motor Hedge Fund SMC em vez de EMA simples |
//+------------------------------------------------------------------+
int CandleRider_DetectTrend(string sym)
{
   return HF_DetectInstitutionalSignal();
}

//+------------------------------------------------------------------+
//| HELPER: Detectar reversÃ£o da vela em formaÃ§Ã£o                    |
//|  Verifica se o preÃ§o reverteu CR_ReversalPoints do extremo       |
//+------------------------------------------------------------------+
bool CandleRider_IsReversal(string sym, int direction, double extremePrice)
{
   double point = SymbolInfoDouble(sym, SYMBOL_POINT);
   double ask   = SymbolInfoDouble(sym, SYMBOL_ASK);
   double bid   = SymbolInfoDouble(sym, SYMBOL_BID);

   if(direction == 1) // Era BUY â€” reversÃ£o = bid caiu X pts do mÃ¡ximo
   {
      if(bid <= extremePrice - (g_CR_ReversalPoints * point))
         return true;
   }
   else if(direction == -1) // Era SELL â€” reversÃ£o = ask subiu X pts do mÃ­nimo
   {
      if(ask >= extremePrice + (g_CR_ReversalPoints * point))
         return true;
   }

   // Verificar tambÃ©m se a vela actual fechou CONTRA a tendÃªncia
   ENUM_TIMEFRAMES tf = CandleRider_GetTF(g_CR_Timeframe);
   double closeArr[], openArr[];
   ArraySetAsSeries(closeArr, true);
   ArraySetAsSeries(openArr, true);
   if(CopyClose(sym, tf, 0, 1, closeArr) > 0 &&
      CopyOpen(sym,  tf, 0, 1, openArr)  > 0)
   {
      double candleBody = closeArr[0] - openArr[0];
      // Vela em formaÃ§Ã£o jÃ¡ mostra corpo contrÃ¡rio forte (> 50% do step)
      double threshold = (g_CR_StepPoints * point) * 0.5;
      if(direction == 1  && candleBody < -threshold) return true;
      if(direction == -1 && candleBody >  threshold) return true;
   }

   return false;
}

//+------------------------------------------------------------------+
//| HELPER: Mitigação de Perdas (Drawdown vs Tendência)              |
//+------------------------------------------------------------------+
bool CandleRider_CheckLossMitigation(string sym, int direction)
{
   if(g_CR_LossLimitPct <= 0) return false;
   
   double point = SymbolInfoDouble(sym, SYMBOL_POINT);
   double limitPoints = g_CR_SL_Points * (g_CR_LossLimitPct / 100.0);
   
   // 1. Verifica se alguma ordem atingiu o limite de perda (30% do SL)
   bool limitReached = false;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0 || !PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != sym) continue;
      if(PositionGetInteger(POSITION_MAGIC) != GetAuraMagic()) continue;
      string comment = PositionGetString(POSITION_COMMENT);
      if(StringFind(comment, "CR_") < 0) continue;
      
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      int posType = (int)PositionGetInteger(POSITION_TYPE);
      double currentPrice = (posType == POSITION_TYPE_BUY) ? SymbolInfoDouble(sym, SYMBOL_BID) : SymbolInfoDouble(sym, SYMBOL_ASK);
      
      double distPoints = 0;
      if(posType == POSITION_TYPE_BUY) distPoints = (openPrice - currentPrice) / point;
      else                             distPoints = (currentPrice - openPrice) / point;
      
      if(distPoints >= limitPoints)
      {
         limitReached = true;
         break;
      }
   }
   
   if(!limitReached) return false; // Nenhuma ordem em perigo
   
   // 2. O limite foi atingido. Avaliamos a tendência (EMA)
   double ema = CandleRider_GetEMA(sym);
   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   double bid = SymbolInfoDouble(sym, SYMBOL_BID);
   double mid = (ask + bid) / 2.0;
   
   bool trendFavorable = true;
   // Lógica: se somos BUY e o preço caiu abaixo da EMA, a tendência inverteu
   if(direction == 1  && mid < ema) trendFavorable = false;
   // Se somos SELL e o preço subiu acima da EMA, a tendência inverteu
   if(direction == -1 && mid > ema) trendFavorable = false;
   
   if(!trendFavorable)
   {
      Print("⚠️ [Loss Mitigation] Ordem atingiu ", g_CR_LossLimitPct, "% de perda e a tendência INVERTEU (Cruzou a EMA). Fecho de segurança!");
      return true; // Fechar grupo
   }
   
   return false; // Manter grupo (Ainda há esperança / Tendência favorável)
}

//+------------------------------------------------------------------+
//| HELPER: Contar ordens do CandleRider abertas                     |
//+------------------------------------------------------------------+
int CandleRider_CountOpenOrders(string sym)
{
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0 || !PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != sym) continue;
      if(PositionGetInteger(POSITION_MAGIC) != GetAuraMagic()) continue;
      string comment = PositionGetString(POSITION_COMMENT);
      if(StringFind(comment, "CR_") >= 0) count++;
   }
   return count;
}

//+------------------------------------------------------------------+
//| HELPER: Fechar TODAS as ordens do grupo CandleRider              |
//+------------------------------------------------------------------+
void CandleRider_CloseGroup(string sym, string reason)
{
   Print("ðŸ”´ [CandleRider] FECHO DO GRUPO | Motivo: ", reason);
   int closed = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0 || !PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != sym) continue;
      if(PositionGetInteger(POSITION_MAGIC) != GetAuraMagic()) continue;
      string comment = PositionGetString(POSITION_COMMENT);
      if(StringFind(comment, "CR_") < 0) continue;

      double profit = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      if(trade.PositionClose(ticket, 50))
      {
         Print("  âœ… Fechado ticket ", ticket, " | P&L: $", DoubleToString(profit, 2));
         closed++;
      }
   }
   Print("ðŸ”´ [CandleRider] ", closed, " ordens fechadas.");
   g_CR_Group.closed    = true;
   g_CR_Group.direction = 0;
}

//+------------------------------------------------------------------+
//| HELPER: Trailing stop global do grupo                            |
//+------------------------------------------------------------------+
void CandleRider_TrailingGroup(string sym)
{
   if(!g_CR_TrailingGroup) return;

   double point    = SymbolInfoDouble(sym, SYMBOL_POINT);
   int    digits   = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   double ask      = SymbolInfoDouble(sym, SYMBOL_ASK);
   double bid      = SymbolInfoDouble(sym, SYMBOL_BID);
   double trailStart = g_CR_TrailingStart   * point;
   double trailDist  = g_CR_TrailingDistance * point;
   double trailStep  = g_CR_TrailingStep    * point;
   int    stopLevel  = (int)SymbolInfoInteger(sym, SYMBOL_TRADE_STOPS_LEVEL);
   double minDist    = MathMax(trailDist, (stopLevel + 5) * point);

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0 || !PositionSelectByTicket(ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL) != sym) continue;
      if(PositionGetInteger(POSITION_MAGIC) != GetAuraMagic()) continue;
      string comment = PositionGetString(POSITION_COMMENT);
      if(StringFind(comment, "CR_") < 0) continue;

      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);
      int    posType   = (int)PositionGetInteger(POSITION_TYPE);

      if(posType == POSITION_TYPE_BUY)
      {
         if(bid - openPrice < trailStart) continue;
         double newSL = NormalizeDouble(bid - minDist, digits);
         if(newSL > currentSL + trailStep)
            SafePositionModify(ticket, newSL, currentTP);
      }
      else
      {
         if(openPrice - ask < trailStart) continue;
         double newSL = NormalizeDouble(ask + minDist, digits);
         if(currentSL == 0 || newSL < currentSL - trailStep)
            SafePositionModify(ticket, newSL, currentTP);
      }
   }
}

//+------------------------------------------------------------------+
//| FUNÃ‡ÃƒO PRINCIPAL â€” chamar em RunInstitutionalCore()              |
//|  Substitui / complementa CounterTrendScalperXAU()               |
//+------------------------------------------------------------------+
void CandleRiderScalperXAU()
{
   if(!g_CR_Enable)       return;
   if(IsFridayFreeze())   return;
   if(DailyLossLock)      return;
   if(DailyTargetReached) return;

   // --- Resolver sÃ­mbolo XAU ---
   string sym = "XAUUSD";
   if(!SymbolSelect(sym, true))
   {
      sym = "XAUUSDm";
      if(!SymbolSelect(sym, true)) return;
   }

   double ask   = SymbolInfoDouble(sym, SYMBOL_ASK);
   double bid   = SymbolInfoDouble(sym, SYMBOL_BID);
   double point = SymbolInfoDouble(sym, SYMBOL_POINT);
   double mid   = (ask + bid) / 2.0;

   if(ask <= 0 || bid <= 0) return;

   // --- Verificar spread ---
   double spread = (ask - bid) / point;
   if(g_SpreadGuardianActive && spread > GetMaxAllowedSpread(sym)) return;

   // --- Hedge Fund Engine Updates ---
   HF_UpdateSpeed(mid);
   HF_UpdateRegime();

   // ================================================================
   // PASSO 1 â€” GESTÃƒO DO GRUPO EXISTENTE
   // ================================================================
   bool hasOpenGroup = (g_CR_Group.direction != 0 && !g_CR_Group.closed);

   if(hasOpenGroup)
   {
      int dir = g_CR_Group.direction;

      // Actualizar extremo do grupo
      if(dir == 1  && mid > g_CR_Group.extremePrice) g_CR_Group.extremePrice = mid;
      if(dir == -1 && mid < g_CR_Group.extremePrice) g_CR_Group.extremePrice = mid;

      // --- DETECÃ‡ÃƒO DE REVERSÃƒO ---
      bool reversal = CandleRider_IsReversal(sym, dir, g_CR_Group.extremePrice);

      // Verificar tambÃ©m se a vela mudou e a nova vela vai contra a tendÃªncia
      ENUM_TIMEFRAMES tf = CandleRider_GetTF(g_CR_Timeframe);
      datetime currentCandleTime = iTime(sym, tf, 0);
      if(currentCandleTime != g_CR_Group.candleTime)
      {
         // Nova vela: re-avaliar tendÃªncia
         int newTrend = CandleRider_DetectTrend(sym);
         if(newTrend != 0 && newTrend != dir)
         {
            // TendÃªncia inverteu na nova vela â†’ fechar grupo
            reversal = true;
         }
         // Actualizar tempo da vela para a nova
         g_CR_Group.candleTime = currentCandleTime;
      }
      
      // --- MITIGAÇÃO DE PERDAS ESTRUTURAL (LOSS LIMIT VS TENDÊNCIA) ---
      if(!reversal)
      {
         reversal = CandleRider_CheckLossMitigation(sym, dir);
      }

      if(reversal)
      {
         CandleRider_CloseGroup(sym, "ReversÃ£o detectada");
         return; // Sai: novo grupo serÃ¡ avaliado no prÃ³ximo tick
      }

      // --- TRAILING GLOBAL DO GRUPO ---
      CandleRider_TrailingGroup(sym);

      // --- ESCALONAMENTO: ABRIR NOVA ORDEM SE O PREÃ‡O AVANÃ‡OU ---
      int openNow = CandleRider_CountOpenOrders(sym);
      if(openNow >= g_CR_MaxOrdersPerCandle) return; // Limite atingido
      if(openNow >= g_MaxOrders)             return; // Limite global

      double stepDist = g_CR_StepPoints * point;
      bool canAdd = false;

      if(dir == 1  && mid >= g_CR_Group.lastEntryPrice + stepDist) canAdd = true;
      if(dir == -1 && mid <= g_CR_Group.lastEntryPrice - stepDist) canAdd = true;

      if(canAdd)
      {
         double entryPrice = (dir == 1) ? ask : bid;
         double sl = (dir == 1)
                     ? NormalizeDouble(entryPrice - (g_CR_SL_Points * point), (int)SymbolInfoInteger(sym, SYMBOL_DIGITS))
                     : NormalizeDouble(entryPrice + (g_CR_SL_Points * point), (int)SymbolInfoInteger(sym, SYMBOL_DIGITS));
         double tp = (dir == 1)
                     ? NormalizeDouble(entryPrice + (g_CR_TP_Points * point), (int)SymbolInfoInteger(sym, SYMBOL_DIGITS))
                     : NormalizeDouble(entryPrice - (g_CR_TP_Points * point), (int)SymbolInfoInteger(sym, SYMBOL_DIGITS));

         double lot = CalculateLot(sym, g_CR_RiskPercent, g_CR_SL_Points * point,
                                   (dir == 1) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL);
         if(lot <= 0) lot = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);

         string comment = "CR_" + IntegerToString(openNow + 1) +
                          "_" + ((dir == 1) ? "BUY" : "SELL");

         trade.SetTypeFillingBySymbol(sym);
         bool ok = false;
         if(dir == 1) ok = trade.Buy(lot,  sym, entryPrice, sl, tp, comment);
         else         ok = trade.Sell(lot, sym, entryPrice, sl, tp, comment);

         if(ok)
         {
            g_CR_Group.lastEntryPrice = mid;
            g_CR_Group.orderCount++;
            Print("ðŸ“ˆ [CandleRider] Ordem ", openNow + 1, "/", g_CR_MaxOrdersPerCandle,
                  " | ", comment,
                  " | PreÃ§o: ", DoubleToString(entryPrice, (int)SymbolInfoInteger(sym, SYMBOL_DIGITS)),
                  " | SL: ", DoubleToString(sl, (int)SymbolInfoInteger(sym, SYMBOL_DIGITS)),
                  " | TP: ", DoubleToString(tp, (int)SymbolInfoInteger(sym, SYMBOL_DIGITS)),
                  " | Lot: ", DoubleToString(lot, 2));
         }
      }
      return; // Grupo activo: nÃ£o avalia novo grupo
   }

   // ================================================================
   // PASSO 2 â€” INICIAR NOVO GRUPO (sem grupo activo)
   // ================================================================

   // Verificar se jÃ¡ existem ordens CR abertas (bot reiniciado)
   if(CandleRider_CountOpenOrders(sym) > 0) return;

   // Detectar tendÃªncia
   int trend = CandleRider_DetectTrend(sym);
   if(trend == 0) return; // Sem sinal claro

   // Limites de ordens
   if(CountAuraPositions() >= g_MaxOrders) return;
   int buys = 0, sells = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t > 0 && PositionSelectByTicket(t) &&
         PositionGetInteger(POSITION_MAGIC) == GetAuraMagic())
      {
         if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)  buys++;
         if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL) sells++;
      }
   }
   if(trend == 1  && buys  >= g_MaxBuys)  return;
   if(trend == -1 && sells >= g_MaxSells) return;

   // Abertura da primeira ordem do grupo
   double entryPrice = (trend == 1) ? ask : bid;
   int    digits     = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   double sl = (trend == 1)
               ? NormalizeDouble(entryPrice - (g_CR_SL_Points * point), digits)
               : NormalizeDouble(entryPrice + (g_CR_SL_Points * point), digits);
   double tp = (trend == 1)
               ? NormalizeDouble(entryPrice + (g_CR_TP_Points * point), digits)
               : NormalizeDouble(entryPrice - (g_CR_TP_Points * point), digits);

   double lot = CalculateLot(sym, g_CR_RiskPercent, g_CR_SL_Points * point,
                             (trend == 1) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL);
   if(lot <= 0) lot = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);

   string comment = "CR_1_" + ((trend == 1) ? "BUY" : "SELL");

   trade.SetTypeFillingBySymbol(sym);
   bool ok = false;
   if(trend == 1) ok = trade.Buy(lot,  sym, entryPrice, sl, tp, comment);
   else           ok = trade.Sell(lot, sym, entryPrice, sl, tp, comment);

   if(ok)
   {
      ENUM_TIMEFRAMES tf = CandleRider_GetTF(g_CR_Timeframe);

      g_CR_Group.candleTime     = iTime(sym, tf, 0);
      g_CR_Group.direction      = trend;
      g_CR_Group.extremePrice   = mid;
      g_CR_Group.lastEntryPrice = mid;
      g_CR_Group.orderCount     = 1;
      g_CR_Group.closed         = false;

      Print("ðŸš€ [CandleRider] NOVO GRUPO INICIADO | ",
            ((trend == 1) ? "BUY â†‘" : "SELL â†“"),
            " | PreÃ§o: ", DoubleToString(entryPrice, digits),
            " | EMA: ", DoubleToString(CandleRider_GetEMA(sym), digits),
            " | SL: ", DoubleToString(sl, digits),
            " | TP: ", DoubleToString(tp, digits));
   }
}

#endif // AURA_CANDLE_RIDER_MQH
