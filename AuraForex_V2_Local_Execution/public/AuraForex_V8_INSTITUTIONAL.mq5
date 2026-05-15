//+------------------------------------------------------------------+
//|                                              AuraForex_SMC_V8 |
//|                                  Copyright 2026, AuraForex Corp  |
//|                                             https://auraforex.pt |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AuraForex Corp"
#property link      "https://auraforex.pt"
#property version   "8.0"
#property strict

//--- INCLUDES ---
#include <Trade\Trade.mqh>

//--- INPUT PARAMETERS ---
input string   InpLicenseKey        = "COLE_SUA_LICENCA_AQUI"; // Chave de Licença (Dashboard)
input string   InpServerUrl         = "https://www.auratradebots.com/api"; // URL do seu VPS (Com /api)
input double   InpRiskPercent       = 1.0;                     // % de Risco por Trade
input int      InpMagicNumber       = 888222;                  // Magic Number das Ordens
input int      InpTimerSeconds      = 2;                       // Intervalo de Checagem (Segundos) — Recomendado: 2 ou 3
input int      InpMaxSLForex        = 1500;                    // Limite SL Forex (Pontos)
input int      InpMaxSLJPY          = 5000;                    // Limite SL JPY/Ouro (Pontos)
input int      InpMaxOrders         = 4;                       // Limite Global de Ordens
input int      InpMaxBuys           = 2;                       // Máximo de Compras Simultâneas
input int      InpMaxSells          = 2;                       // Máximo de Vendas Simultâneas
input int      InpTradeCooldown     = 60;                      // Cooldown entre ordens do mesmo par (seg)

// --- PROFIT LOCK PARAMETERS ---
input double   InpProfitLockMin     = 3.0;   // Lucro mínimo para activar ProfitLock ($)
input double   InpProfitLockDrop    = 30.0;  // % de queda do pico para fechar ordem

// --- TRAILING STOP PARAMETERS ---
input bool   InpTrailingEnabled   = true;      // Trailing Stop Activo
input int    InpTrailingStart     = 50;        // Trailing Start (5.0 pips)
input int    InpTrailingDistance  = 80;        // Trailing Distance (8.0 pips)
input int    InpTrailingStep      = 10;        // Trailing Step (1.0 pip)

input bool   InpManageManualOrders = true;     // Gerir Ordens Manuais (Magic 0)
input double InpDailyTargetPct     = 5.0;      // Meta Diária (% de Lucro)
input double InpMaxDailyLossPct    = 10.0;     // Perda Máxima Diária (%)
input bool   InpSessionFilter      = false;    // Filtrar Horário (Apenas Londres/NY)

struct ProfitLockData {
   ulong    ticket;
   double   peakProfit;   // Pico máximo de lucro atingido
   bool     active;       // ProfitLock activado para este ticket
   datetime activationTime; // Tempo de activação para buffer anti-spike
};

//--- GLOBAL VARIABLES ---
CTrade            trade;
bool              IsAuthorized = false;
datetime          lastCheckTime = 0;
ProfitLockData    ProfitLocks[];   // Array de monitoramento
double            DailyStartBalance  = 0;
double            DailyStartEquity   = 0; 
bool              DailyTargetReached = false;
bool              DailyLossLock      = false; // Bloqueio por perda diária
int               LastTradingDay     = -1;
int               ConsecutiveLosses  = 0; // Contador de perdas consecutivas

// --- CACHE DE INDICADORES ---
struct ATRCache {
   string          symbol;
   ENUM_TIMEFRAMES tf;
   int             handle;
   double          value;
   datetime        lastBar;
};
ATRCache g_atrCache[];

//--- ESTRUTURA PROTEÇÃO ASSÍNCRONA ---
struct PendingProtectionData {
   ulong    ticket;
   double   sl;
   double   tp;
   string   signalId;
   datetime timestamp;
};
PendingProtectionData PendingQueue[]; // Fila de espera para proteção

//--- ESTRUTURA FILA DE SINAIS ---
struct SignalQueueData {
   string   json;
   datetime timestamp;
};
SignalQueueData SignalQueue[]; // Fila de espera para execução
struct PartialCloseData
{
   ulong ticket;
   bool  closed;
};

PartialCloseData PartialCloses[]; // Rastreio de fechos parciais (Dinâmico)
bool            ExecutionBusy = false; // Bloqueio de execução (Semáforo)

//--- Funções Auxiliares de Especialista
bool IsXAU(string sym) { return (StringFind(sym, "XAU") >= 0 || StringFind(sym, "GOLD") >= 0); }

bool IsTradingSession()
{
   if(!InpSessionFilter) return true; // Se o filtro estiver desligado, autoriza sempre

   MqlDateTime tm;
   TimeCurrent(tm);
   int hour = tm.hour;
   
   // Londres + NY (Aproximado 7h às 18h GMT+2/3)
   return (hour >= 7 && hour <= 18);
}

double GetMaxAllowedSpread(string sym)
{
   return IsXAU(sym) ? 35.0 : 15.0; // 35 pips para Ouro, 15 para Forex
}

bool IsVolatilityAbnormal(string sym)
{
   // --- ENGINE ATR DINÂMICO (H1 para Ouro) via Cache ---
   ENUM_TIMEFRAMES atrTF = IsXAU(sym) ? PERIOD_H1 : PERIOD_M15;
   double atrNow = GetATR(sym, atrTF);
   
   if(atrNow <= 0) return false;
   
   double limit = IsXAU(sym) ? 5.0 : 0.0050; // Limites realistas (50 pips FX, $5 XAU)
   return (atrNow > limit && atrNow > 0);
}

long GetAuraMagic()
{
   return InpMagicNumber; // Magic fixo para garantir persistência entre timeframes
}

int CountAuraPositions()
{
   int total = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         if(PositionGetInteger(POSITION_MAGIC) == GetAuraMagic())
            total++;
      }
   }
   return total;
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("🚀 AURA V8 INSTITUCIONAL - Execution Engine");
   
   // Configurações Visuais de Gráfico (Nível Institucional)
   ChartSetInteger(0, CHART_SHOW_TRADE_HISTORY, true);
   ChartSetInteger(0, CHART_SHOW_TRADE_LEVELS, true);
   ChartSetInteger(0, CHART_SHOW_OBJECT_DESCR, true);
   ChartRedraw();

   trade.SetExpertMagicNumber(GetAuraMagic());
   trade.SetDeviationInPoints(30); 
   
   ValidateLicense();
   RecoverState(); 
   EventSetTimer(InpTimerSeconds);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { EventKillTimer(); }

void OnTick()
{
   if(!IsAuthorized) return;

   string sym = _Symbol;
   
   //--- Filtros Institucionais de Elite (Aplicados apenas ao Ouro para não afectar Forex)
   if(IsXAU(sym))
   {
      // 1. Filtro de Sessão (Ouro só opera em alta liquidez: Londres/NY)
      if(!IsTradingSession()) return;
      
      // 2. Filtro de Spread Guard
      double spread = (SymbolInfoDouble(sym, SYMBOL_ASK) - SymbolInfoDouble(sym, SYMBOL_BID)) / _Point;
      if(spread > GetMaxAllowedSpread(sym)) return;
      
      // 3. Filtro de Volatilidade Anormal (Evita "pânico" de mercado)
      if(IsVolatilityAbnormal(sym)) return;
   }

   // Monitorização movida apenas para o Timer para evitar concorrência (Busy Lock)
   // O Timer a 1s é suficiente e muito mais estável institucionalmente
   ProcessPendingProtections();
}

void OnTimer()
{
   // 1. SINCRONISMO DASHBOARD (Sempre ativo para evitar dados "travados")
   ReportBalance();
   UpdateChartVisuals();
   
   // 2. Proteger Ordens Manuais (Prioridade total e independente de autorização)
   ProtectManualOrders();

   // 3. SEMÁFORO DE EXECUÇÃO (Protege contra concorrência em tarefas pesadas)
   if(ExecutionBusy) return;
   ExecutionBusy = true;

   // Validar Licença (anti-spam throttle interno)
   ValidateLicense();

   if(IsAuthorized)
   {
      CheckDailyLoss();
      CheckDailyTarget();
      CheckSignals();
      ProcessSignalQueue();

      // HIERARQUIA INSTITUCIONAL DE GESTÃO
      MonitorTrailingStop();
      MonitorPartialTP();
      MonitorProfitLock();
   }

   ExecutionBusy = false;
}

double GetDailyPnL()
{
   double closedProfit = 0;
   
   // CORRECÇÃO INSTITUCIONAL: Cálculo via estrutura de tempo para evitar falhas do iTime em mercado fechado
   MqlDateTime dt; 
   TimeCurrent(dt);
   dt.hour = 0; dt.min = 0; dt.sec = 0;
   datetime todayStart = StructToTime(dt);
   
   if(HistorySelect(todayStart, TimeCurrent()))
   {
      int total = HistoryDealsTotal();
      for(int i = 0; i < total; i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket > 0)
         {
            long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
            if(magic == GetAuraMagic())
            {
               closedProfit += HistoryDealGetDouble(ticket, DEAL_PROFIT);
               closedProfit += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
               closedProfit += HistoryDealGetDouble(ticket, DEAL_SWAP);
            }
         }
      }
   }
   
   double floatingProfit = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         if(PositionGetInteger(POSITION_MAGIC) == GetAuraMagic())
            floatingProfit += PositionGetDouble(POSITION_PROFIT);
      }
   }
   
   return closedProfit + floatingProfit;
}

void CheckDailyTarget()
{
   MqlDateTime tm;
   TimeCurrent(tm);

   if(tm.day != LastTradingDay)
   {
      LastTradingDay = tm.day;
      DailyTargetReached = false;
      DailyLossLock      = false;
      DailyStartBalance  = AccountInfoDouble(ACCOUNT_BALANCE);
      DailyStartEquity   = AccountInfoDouble(ACCOUNT_EQUITY);
      Print("🌅 [DAILY] Novo dia detectado. Meta/Loss resetados | Equity Inicial: $", DoubleToString(DailyStartEquity, 2));
   }

   // Fallback inicialização (Primeiro run do bot no dia)
   if(DailyStartEquity <= 0)
   {
      DailyStartBalance  = AccountInfoDouble(ACCOUNT_BALANCE);
      DailyStartEquity   = AccountInfoDouble(ACCOUNT_EQUITY);
   }

   if(DailyTargetReached) return;

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double profitPct = 0;
   
   if(DailyStartEquity > 0)
      profitPct = ((equity - DailyStartEquity) / DailyStartEquity) * 100.0;

   if(profitPct >= InpDailyTargetPct)
   {
      DailyTargetReached = true;
      Print("🏆 [DAILY] META ATINGIDA: ", DoubleToString(profitPct, 2), "% | Equity: $", DoubleToString(equity, 2), " | Fechando posições...");
      
      CloseAllPositions();
   }
}

void CheckDailyLoss()
{
   if(DailyLossLock) return;

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   
   // Buffer de inicialização: Não actua nos primeiros 10 segundos para evitar spikes de boot
   static datetime bootTime = 0;
   if(bootTime == 0) bootTime = TimeCurrent();
   if(TimeCurrent() - bootTime < 10) return;

   if(DailyStartEquity <= 0) {
      DailyStartEquity = equity;
      return;
   }

   double lossPct = ((DailyStartEquity - equity) / DailyStartEquity) * 100.0;

   // Só bloqueia se houver uma perda REAL de 10%
   if(lossPct >= InpMaxDailyLossPct)
   {
      DailyLossLock = true;
      Print("🛑 [CIRCUIT-BREAKER] LIMITE DE PERDA DIÁRIA ATINGIDO: ", DoubleToString(lossPct, 2), "% | Equity Inicial: ", DailyStartEquity, " | Equity Actual: ", equity);
      CloseAllPositions();
   }
}

//+------------------------------------------------------------------+
//| PROFIT LOCK - Monitor principal                                  |
//+------------------------------------------------------------------+
void MonitorProfitLock()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      
      long magic = PositionGetInteger(POSITION_MAGIC);
      string sym = PositionGetString(POSITION_SYMBOL);

      // FILTRO INSTITUCIONAL (MULTI-ASSET)
      if(magic != GetAuraMagic() && (!InpManageManualOrders || magic != 0)) continue;

      double profit    = PositionGetDouble(POSITION_PROFIT);
      double currentSL = PositionGetDouble(POSITION_SL);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      long   posType   = PositionGetInteger(POSITION_TYPE);

      // Ignorar posições no negativo
      if(profit <= 0) continue;

      // CONFLITO 1 RESOLVIDO: Se Trailing já moveu o SL para zona de lucro,
      // o ProfitLock não fecha — deixa o SL físico do Trailing fazer o trabalho.
      // Isto evita fechar cedo demais quando o Trailing já está a proteger.
      bool slInProfit = false;
      if(posType == POSITION_TYPE_BUY  && currentSL > openPrice) slInProfit = true;
      if(posType == POSITION_TYPE_SELL && currentSL < openPrice && currentSL > 0) slInProfit = true;

      // Procurar ou criar entrada no array ProfitLocks
      int idx = FindProfitLockIndex(ticket);
      if(idx < 0) idx = CreateProfitLockEntry(ticket);
      if(idx < 0) continue;

      // FASE 1: Verificar se lucro atingiu o mínimo para activar
      if(!ProfitLocks[idx].active)
      {
         double minProfitActivation = (StringFind(sym, "XAU") >= 0) ? 15.0 : InpProfitLockMin;
         
         if(profit >= minProfitActivation)
         {
            ProfitLocks[idx].active         = true;
            ProfitLocks[idx].peakProfit     = profit;
            ProfitLocks[idx].activationTime = TimeCurrent(); // Buffer anti-spike começa agora
            Print("🔒 ProfitLock ACTIVADO (Warmup Concluído) | ", sym,
                  " | Ticket: ", ticket,
                  " | Lucro: $", DoubleToString(profit, 2));
         }
         continue;
      }

      // FASE 2: Actualizar pico máximo (Com filtro de ruído dinâmico % do pico)
      double peak = ProfitLocks[idx].peakProfit;
      double peakUpdateThreshold = (StringFind(sym, "XAU") >= 0) ? (peak * 0.05) : 0.5;
      
      if(profit > peak + peakUpdateThreshold)
      {
         ProfitLocks[idx].peakProfit = profit;
         Print("📈 Novo pico | ", sym,
               " | Ticket: ", ticket,
               " | Pico: $", DoubleToString(profit, 2), 
               " (Avanço: +$", DoubleToString(profit - peak, 2), ")");
      }

      // FASE 3: Verificar queda do pico com Lógica Adaptativa ATR
      // 1. Buffer de Tempo (Anti-Spike)
      int lockDelay = (StringFind(sym, "XAU") >= 0) ? 120 : 30;
      if(TimeCurrent() - ProfitLocks[idx].activationTime < lockDelay) continue;

      // 2. Warmup Zone (Deixar o activo respirar antes de fechar agressivo)
      double protectionStart = (StringFind(sym, "XAU") >= 0) ? 15.0 : 5.0;
      if(peak < protectionStart) continue;

      // 3. Cálculo de Volatilidade Real via Cache
      ENUM_TIMEFRAMES atrTF = IsXAU(sym) ? PERIOD_H1 : PERIOD_M15;
      double atr = GetATR(sym, atrTF);
      
      if(atr <= 0) continue;

      // 3. Conversão ATR para Valor Monetário
      double point    = SymbolInfoDouble(sym, SYMBOL_POINT);
      double tickVal  = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
      double tickSize = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
      
      if(point <= 0 || tickSize <= 0) continue;
      
      double atrInPoints = atr / point;
      double lotSize     = PositionGetDouble(POSITION_VOLUME);
      // Cálculo aproximado do valor monetário do ATR para este lote
      double atrMoney    = (atr / tickSize) * tickVal * lotSize;

      // 4. Factor de Volatilidade por Ativo
      double volatilityFactor = (StringFind(sym, "XAU") >= 0) ? 2.5 : 1.2;
      double allowedDropMoney = MathMax(2.0, atrMoney * volatilityFactor);
      
      double currentDropMoney = ProfitLocks[idx].peakProfit - profit;

      if(currentDropMoney >= allowedDropMoney)
      {
         // CONFLITO 1: Se SL do Trailing já está em lucro, não fechar pelo ProfitLock
         if(slInProfit) continue;

         Print("🛑 ProfitLock ADAPTATIVO DISPARADO | ", sym,
               " | Ticket: ", ticket,
               " | Pico: $",   DoubleToString(peak, 2),
               " | Actual: $", DoubleToString(profit, 2),
               " | Queda: $",  DoubleToString(currentDropMoney, 2), 
               " (Limite ATR: $", DoubleToString(allowedDropMoney, 2), ")");

         if(trade.PositionClose(ticket))
         {
            Print("✅ Ordem fechada com lucro preservado | ", sym,
                  " | Ticket: ", ticket,
                  " | Lucro final: $", DoubleToString(profit, 2));
            RemoveProfitLockEntry(idx);
         }
         else
         {
            Print("⚠️ Falha ao fechar | ", sym, " | Erro: ", GetLastError());
         }
      }
   }

   // Limpar entradas de tickets já fechados
   CleanClosedPositions();
}

//+------------------------------------------------------------------+
//| PROFIT LOCK - Funções auxiliares                                 |
//+------------------------------------------------------------------+
int FindProfitLockIndex(ulong ticket)
{
   for(int i = 0; i < ArraySize(ProfitLocks); i++)
      if(ProfitLocks[i].ticket == ticket) return i;
   return -1;
}

int CreateProfitLockEntry(ulong ticket)
{
   int s = ArraySize(ProfitLocks);
   ArrayResize(ProfitLocks, s + 1);
   ProfitLocks[s].ticket         = ticket;
   ProfitLocks[s].peakProfit     = 0;
   ProfitLocks[s].active         = false;
   ProfitLocks[s].activationTime = 0;
   return s;
}

void RemoveProfitLockEntry(int idx)
{
   int s = ArraySize(ProfitLocks);
   for(int i = idx; i < s - 1; i++)
      ProfitLocks[i] = ProfitLocks[i + 1];
   ArrayResize(ProfitLocks, s - 1);
}

void CleanClosedPositions()
{
   for(int i = ArraySize(ProfitLocks) - 1; i >= 0; i--)
   {
      if(!PositionSelectByTicket(ProfitLocks[i].ticket))
         RemoveProfitLockEntry(i);
   }
}

//+------------------------------------------------------------------+
//| FECHO PARCIAL INSTITUCIONAL (Garante 50% no bolso + BE)          |
//+------------------------------------------------------------------+
void MonitorPartialTP()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0 || !PositionSelectByTicket(ticket)) continue;
      
      long magic = PositionGetInteger(POSITION_MAGIC);
      string sym = PositionGetString(POSITION_SYMBOL);

      // FILTRO INSTITUCIONAL (MULTI-ASSET)
      if(magic != GetAuraMagic() && (!InpManageManualOrders || magic != 0)) continue;

      double profit = PositionGetDouble(POSITION_PROFIT);
      double vol = PositionGetDouble(POSITION_VOLUME);
      
      // Meta para Fecho Parcial: $25 para Ouro, $10 para Forex
      double partialTarget = IsXAU(sym) ? 25.0 : 10.0;

      // Verificar se já fechamos parcialmente este ticket via array dinâmico
      bool alreadyClosed = false;
      for(int j = 0; j < ArraySize(PartialCloses); j++) 
      { 
         if(PartialCloses[j].ticket == ticket && PartialCloses[j].closed) 
         { 
            alreadyClosed = true; 
            break; 
         } 
      }
      if(alreadyClosed) continue;

      if(profit >= partialTarget)
      {
         double closeVol = NormalizeDouble(vol / 2.0, 2);
         if(closeVol < 0.01) closeVol = vol; // Se muito pequeno, fecha tudo

         Print("💰 META PARCIAL ATINGIDA | ", sym, " | Ticket: ", ticket, " | Fechando 50% (", closeVol, ")");
         
         if(trade.PositionClosePartial(ticket, closeVol))
         {
            // Registar fecho parcial no array dinâmico
            RegisterPartialClose(ticket);
            
            // Mover para Break Even
            double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            double currentTP = PositionGetDouble(POSITION_TP);
            trade.PositionModify(ticket, openPrice, currentTP);
            Print("🛡️ BREAK EVEN ACTIVADO para Ticket: ", ticket);
         }
      }
   }
   // Limpar tickets órfãos do array de parciais
   CleanPartialCloses();
}

//+------------------------------------------------------------------+
//| GESTÃO DINÂMICA DE FECHOS PARCIAIS                               |
//+------------------------------------------------------------------+
void RegisterPartialClose(ulong ticket)
{
   int s = ArraySize(PartialCloses);
   for(int i = 0; i < s; i++)
   {
      if(PartialCloses[i].ticket == ticket)
      {
         PartialCloses[i].closed = true;
         return;
      }
   }
   ArrayResize(PartialCloses, s + 1);
   PartialCloses[s].ticket = ticket;
   PartialCloses[s].closed = true;
}

void CleanPartialCloses()
{
   for(int i = ArraySize(PartialCloses) - 1; i >= 0; i--)
   {
      if(!PositionSelectByTicket(PartialCloses[i].ticket))
      {
         int s = ArraySize(PartialCloses);
         for(int j = i; j < s - 1; j++)
            PartialCloses[j] = PartialCloses[j + 1];
         ArrayResize(PartialCloses, s - 1);
      }
   }
}

//+------------------------------------------------------------------+
//| TRAILING STOP - Monitor principal                                |
//+------------------------------------------------------------------+
void MonitorTrailingStop()
{
   if(!InpTrailingEnabled) return;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      
      long magic = PositionGetInteger(POSITION_MAGIC);
      string sym = PositionGetString(POSITION_SYMBOL);

      // FILTRO INSTITUCIONAL (MULTI-ASSET)
      if(magic != GetAuraMagic() && (!InpManageManualOrders || magic != 0)) continue;

      double point     = SymbolInfoDouble(sym, SYMBOL_POINT);
      int    digits    = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      double ask       = SymbolInfoDouble(sym, SYMBOL_ASK);
      double bid       = SymbolInfoDouble(sym, SYMBOL_BID);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP); // preservar TP original

      // CÁLCULO ATR DINÂMICO PARA TRAILING via Cache
      ENUM_TIMEFRAMES atrTF = IsXAU(sym) ? PERIOD_H1 : PERIOD_M15;
      double atr = GetATR(sym, atrTF);

      double trailStart = (atr > 0) ? (atr * 1.0) : (InpTrailingStart    * point);
      double trailStep  = InpTrailingStep     * point;
      double trailDist  = (atr > 0) ? (IsXAU(sym) ? atr * 2.5 : atr * 1.5) : (InpTrailingDistance * point);

      double stopLevel = SymbolInfoInteger(sym, SYMBOL_TRADE_STOPS_LEVEL) * point;
      if(trailDist < stopLevel * 1.1) trailDist = stopLevel * 1.1;

      // CONFLITO 2 RESOLVIDO: Se ProfitLock está prestes a fechar esta posição
      // (queda >= 90% do limiar), Trailing não interfere para não gerar ordens duplas
      int plIdx = FindProfitLockIndex(ticket);
      if(plIdx >= 0 && ProfitLocks[plIdx].active)
      {
         double profit  = PositionGetDouble(POSITION_PROFIT);
         double peak    = ProfitLocks[plIdx].peakProfit;
         double dropPct = (peak > 0) ? ((peak - profit) / peak) * 100.0 : 0;
         if(dropPct >= InpProfitLockDrop * 0.9) // 90% do limiar = iminente
         {
            Print("ℹ️ Trailing pausado (ProfitLock iminente) | ", sym, " | Ticket: ", ticket);
            continue;
         }
      }

      if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
      {
         if(bid - openPrice < trailStart) continue;

         double newSL = NormalizeDouble(bid - trailDist, digits);

         if(newSL > currentSL + trailStep)
         {
            // CONFLITO 3: Manter TP original do ApplyProtection — não passar 0
            if(trade.PositionModify(ticket, newSL, currentTP))
               Print("📊 Trailing BUY | ", sym,
                     " | Ticket: ", ticket,
                     " | SL: ", DoubleToString(currentSL, digits),
                     " → ",     DoubleToString(newSL, digits));
         }
      }
      else // SELL
      {
         if(openPrice - ask < trailStart) continue;

         double newSL = NormalizeDouble(ask + trailDist, digits);

         if((currentSL == 0 || newSL < currentSL - trailStep) && (newSL - ask > stopLevel))
         {
            if(trade.PositionModify(ticket, newSL, currentTP))
               Print("📊 Trailing SELL | ", sym, " | Ticket: ", ticket, " | SL: ", newSL);
         }
      }
   }
}

// --- CORE FUNCTIONS ---

void ValidateLicense()
{
   static datetime lastValidate = 0;
   if(TimeCurrent() - lastValidate < 300 && IsAuthorized)  return; // Re-valida a cada 5 min
   if(TimeCurrent() - lastValidate < 30  && !IsAuthorized) return; // Tenta a cada 30s se falhou

   lastValidate = TimeCurrent();
   
   // CORRECÇÃO INSTITUCIONAL v2
   string url = InpServerUrl + "/ea/validate";
   string payload = "{\"licenseKey\":\"" + InpLicenseKey + "\",\"mtAccount\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\"}";
   string res = SendPost(url, payload);

   if(StringFind(res, "\"status\":\"OK\"") >= 0) {
      if(!IsAuthorized) Print("✅ LICENÇA VALIDADA COM SUCESSO!");
      IsAuthorized = true;
   } else {
      IsAuthorized = false;
      if(res == "") Print("❌ ERRO DE CONEXÃO: Servidor Offline ou URL Inválida.");
      else          Print("❌ FALHA NA LICENÇA: ", res);
   }
}

void CheckSignals()
{
   if(DailyTargetReached)
   {
      static datetime lastLockMsg = 0;
      if(TimeCurrent() - lastLockMsg > 3600) {
         Print("🛑 [DAILY] Meta diária atingida. Trading bloqueado até amanhã.");
         lastLockMsg = TimeCurrent();
      }
      return;
   }

   if(DailyLossLock)
   {
      static datetime lastLossMsg = 0;
      if(TimeCurrent() - lastLossMsg > 3600) {
         Print("🛑 [DAILY] Limite de perda diária atingido. Trading bloqueado até amanhã.");
         lastLossMsg = TimeCurrent();
      }
      return;
   }

   // Anti-flood: Evita sobrecarregar a API
   if(TimeCurrent() - lastCheckTime < 5) return;
   
   lastCheckTime = TimeCurrent();

   string url = InpServerUrl + "/ea/signals?licenseKey=" + InpLicenseKey;
   string result = SendGet(url);
   
   if(result == "") return; 
   if(StringFind(result, "\"signals\":[]") >= 0) return;

   // VERIFICAÇÃO DE LIMITE DE ORDENS
   int openCount = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t > 0 && PositionSelectByTicket(t))
      {
         if(PositionGetInteger(POSITION_MAGIC) == GetAuraMagic())
            openCount++;
      }
   }

   if(openCount >= InpMaxOrders)
   {
      // Apenas avisa uma vez para não inundar o log
      static datetime lastLimitMsg = 0;
      if(TimeCurrent() - lastLimitMsg > 60)
      {
         Print("⚠️ Limite de ordens atingido (", openCount, "/", InpMaxOrders, "). Ignorando novos sinais.");
         lastLimitMsg = TimeCurrent();
      }
      return;
   }

   // Silent Polling - Apenas logamos se houver acção real

   int pos = 0;
   while(true)
   {
      // Procura o próximo ID no JSON
      int idPos = StringFind(result, "\"id\":\"", pos);
      if(idPos < 0) break;

      int start = idPos + 6;
      int end   = StringFind(result, "\"", start);
      if(end < 0) break;

      string signalId = StringSubstr(result, start, end - start);

      // Verificação persistente (Anti-duplicação via GlobalVariable)
      if(IsProcessed(signalId))
      {
         pos = end;
         continue;
      }

      // Print("🎯 NOVO SINAL DETECTADO: ", signalId); // Removido para silêncio institucional

      // Extrair o bloco JSON completo deste sinal { ... }
      int objStart = StringFind(result, "{", idPos - 10); // Volta um pouco para pegar o {
      int objEnd   = StringFind(result, "}", objStart);
      
      if(objStart < 0 || objEnd < 0)
      {
         pos = end;
         continue;
      }

      string signalJson = StringSubstr(result, objStart, objEnd - objStart + 1);
      
      // Adicionar à fila e marcar como processado imediatamente (anti-duplicação crash-safe)
      AddToSignalQueue(signalJson);
      AddProcessed(signalId); // Marcar ANTES da execução — evita duplicação em crash
      
      pos = objEnd;
   }
}

void AddToSignalQueue(string json) {
   int s = ArraySize(SignalQueue);
   ArrayResize(SignalQueue, s + 1);
   SignalQueue[s].json = json;
   SignalQueue[s].timestamp = TimeCurrent();
   
   string signalId = ExtractValue(json, "id");
   GlobalVariableSet("SQ_" + signalId, (double)TimeCurrent()); // Persistência na fila
}

void ProcessSignalQueue()
{
   if(ArraySize(SignalQueue) == 0) return;

   // Processar apenas o sinal mais antigo (Index 0)
   string json = SignalQueue[0].json;
   ExecuteSignal(json);

   // Remover o sinal processado da fila
   string signalId = ExtractValue(json, "id");
   GlobalVariableDel("SQ_" + signalId);

   RemoveSignalQueueIndex(0);
}

void RemoveSignalQueueIndex(int idx)
{
   int s = ArraySize(SignalQueue);
   if(s == 0 || idx >= s) return;

   for(int i = idx; i < s - 1; i++)
      SignalQueue[i] = SignalQueue[i + 1];

   ArrayResize(SignalQueue, s - 1);
}

void RemovePendingQueueIndex(int idx)
{
   int s = ArraySize(PendingQueue);
   if(s == 0 || idx >= s) return;

   for(int i = idx; i < s - 1; i++)
      PendingQueue[i] = PendingQueue[i + 1];

   ArrayResize(PendingQueue, s - 1);
}

void RecoverState()
{
   Print("🔍 Iniciando Recuperação de Estado (Institutional Recovery)...");
   
   // 1. Recuperar Proteções Pendentes
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         if(PositionGetInteger(POSITION_MAGIC) == InpMagicNumber && PositionGetDouble(POSITION_SL) == 0)
         {
            string slKey = "PSL_" + (string)ticket;
            string tpKey = "PTP_" + (string)ticket;
            
            if(GlobalVariableCheck(slKey))
            {
               double sl = GlobalVariableGet(slKey);
               double tp = GlobalVariableGet(tpKey);
               AddToPendingQueue(ticket, sl, tp, "RECOVERED");
               Print("✅ Proteção Recuperada para Ticket: ", ticket);
            }
         }
      }
   }
   
   // 2. Limpeza de GVs órfãs (tickets já fechados)
   int totalGv = GlobalVariablesTotal();
   for(int i = totalGv - 1; i >= 0; i--)
   {
      string name = GlobalVariableName(i);
      if(StringFind(name, "PSL_") == 0 || StringFind(name, "PTP_") == 0)
      {
         ulong ticket = (ulong)StringToInteger(StringSubstr(name, 4));
         if(!PositionSelectByTicket(ticket)) GlobalVariableDel(name);
      }
   }
}

int GetDynamicDeviation(string sym)
{
   double point = SymbolInfoDouble(sym, SYMBOL_POINT);
   if(point <= 0) return 30;

   double spread = (SymbolInfoDouble(sym, SYMBOL_ASK) - SymbolInfoDouble(sym, SYMBOL_BID)) / point;

   if(StringFind(sym, "XAU") >= 0)
      return (int)MathMin(150, spread * 1.5);

   if(StringFind(sym, "JPY") >= 0)
      return (int)MathMin(50, spread * 1.3);

   return (int)MathMin(30, spread * 1.2);
}

bool CanTradeSymbol(string sym)
{
   string gvName = "CD_" + sym;
   if(GlobalVariableCheck(gvName))
   {
      datetime lastTrade = (datetime)GlobalVariableGet(gvName);
      if(TimeCurrent() - lastTrade < InpTradeCooldown) return false;
   }
   return true;
}

void SetSymbolCooldown(string sym)
{
   GlobalVariableSet("CD_" + sym, (double)TimeCurrent());
}

void ExecuteSignal(string json)
{
    string pair  = ExtractValue(json, "pair");
    string dir   = ExtractValue(json, "direction");
    string type  = ExtractValue(json, "orderType");
    double entry = StringToDouble(ExtractValue(json, "entry"));
    double sl    = StringToDouble(ExtractValue(json, "sl"));
    double tp    = StringToDouble(ExtractValue(json, "tp"));
    string sigId = ExtractValue(json, "id");
    
    // --- FILTRO DE SESSÃO INSTITUCIONAL (XAU só opera em Londres/NY) ---
    if(IsXAU(pair) && !IsTradingSession())
    {
       Print("⏰ Fora de sessão institucional para ", pair, " | Entrada Rejeitada");
       return;
    }
    
    if(!SymbolSelect(pair, true))
    {
       for(int s = 0; s < SymbolsTotal(false); s++)
       {
          string sym = SymbolName(s, false);
          string upperSym  = sym; StringToUpper(upperSym);
          string upperPair = pair; StringToUpper(upperPair);

          if(StringFind(upperSym, upperPair) >= 0 || (IsXAU(pair) && (StringFind(upperSym, "XAU") >= 0 || StringFind(upperSym, "GOLD") >= 0)))
          {
             pair = sym;
             SymbolSelect(pair, true);
             break;
          }
       }
    }
    if(!SymbolSelect(pair, true)) { Print("❌ Par não encontrado no Market Watch: " + pair); return; }

    // --- GLOBAL ORDER LIMIT (Institutional Safety) ---
    if(CountAuraPositions() >= InpMaxOrders)
    {
       Print("🛑 Limite global de ordens atingido (", InpMaxOrders, "). Ignorando sinal ", sigId);
       return;
    }

    // --- EXPOSURE CONTROL (HEDGE SAFETY) ---
    int currentBuys = 0, currentSells = 0;
    for(int i = PositionsTotal() - 1; i >= 0; i--) {
       ulong t = PositionGetTicket(i);
       if(t > 0 && PositionSelectByTicket(t)) {
          if(PositionGetInteger(POSITION_MAGIC) == GetAuraMagic()) {
             if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) currentBuys++;
             if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL) currentSells++;
          }
       }
    }

    if(dir == "BUY" && currentBuys >= InpMaxBuys) {
       Print("⚠️ Limite de BUY atingido (", currentBuys, "/", InpMaxBuys, "). Ignorando sinal.");
       return;
    }
    if(dir == "SELL" && currentSells >= InpMaxSells) {
       Print("⚠️ Limite de SELL atingido (", currentSells, "/", InpMaxSells, "). Ignorando sinal.");
       return;
    }

   // --- SYMBOL COOLDOWN ---
   if(!CanTradeSymbol(pair)) {
      Print("⏳ Cooldown activo para ", pair, " | Aguardando intervalo de segurança.");
      return;
   }

   double point  = SymbolInfoDouble(pair, SYMBOL_POINT);
   int digits    = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   double ask    = SymbolInfoDouble(pair, SYMBOL_ASK);
   double bid    = SymbolInfoDouble(pair, SYMBOL_BID);
   double entryPrice = (dir == "BUY") ? ask : bid;
   
   // Fallback se JSON vier zerado
   if(entry <= 0) entry = entryPrice;
   
    // 1. CÁLCULO DE PONTOS (Normalização Institucional)
    double slDist = (sl > 0) ? MathAbs(entry - sl) : 0;
    double tpDist = (tp > 0) ? MathAbs(entry - tp) : 0;
    
    // Fallback Inteligente (Hierarquia: Estrutura de Mercado > ATR > Pontos Fixos)
    if(slDist <= 0) {
       // Tenta buscar o último swing de estrutura (10 velas no M15)
       double structureSL = (dir == "BUY") ? GetLastLow(pair, PERIOD_M15, 10) : GetLastHigh(pair, PERIOD_M15, 10);
       
       if(structureSL > 0 && MathAbs(entry - structureSL) > (10 * point)) {
          slDist = MathAbs(entry - structureSL);
       } else {
          // Fallback de volatilidade se a estrutura falhar ou for demasiado curta
          double atr = GetATR(pair, IsXAU(pair) ? PERIOD_H1 : PERIOD_M15);
          slDist = (atr > 0) ? (atr * 2.2) : (300 * point); 
       }
    }
    if(tpDist <= 0) {
       tpDist = slDist * 1.5; // Alvo padrão RR 1:1.5
    }
    
    // --- SOLUÇÃO DEFINITIVA SL/TP (ENGINE DE PROTEÇÃO) ---
    
    // 1. Determinar o Limite de Segurança baseado no Ativo
    int hardMaxSL = (IsXAU(pair) || (StringFind(pair, "JPY") >= 0)) ? InpMaxSLJPY : InpMaxSLForex;
    
    // 2. Cálculo Base dos Pontos
    int slPoints = (int)(slDist / point);
    
    // 3. Sanity Check contra ATR (Proteção contra Swings Gigantes/Errados)
    double currentATR = GetATR(pair, IsXAU(pair) ? PERIOD_H1 : PERIOD_M15);
    int atrLimitPoints = (int)((currentATR * 3.5) / point); // 3.5x ATR é o limite técnico de sanidade
    
    if(slPoints > atrLimitPoints && atrLimitPoints > 0) {
       Print("⚠️ [SMC-GUARD] SL de Estrutura (", slPoints, ") excessivo. Ajustando para Sanidade ATR (", atrLimitPoints, ")");
       slPoints = atrLimitPoints;
    }
    
    // 4. Aplicação do Hard Limit do Utilizador (O que tu definiste nos Inputs)
    if(slPoints > hardMaxSL) {
       Print("⚠️ [HARD-LIMIT] SL Reduzido de ", slPoints, " para ", hardMaxSL, " (Limite de Segurança)");
       slPoints = hardMaxSL;
    }
    
    // 5. Garantir Distância Mínima e Broker Compliance (StopLevel)
    int stopLevel = (int)SymbolInfoInteger(pair, SYMBOL_TRADE_STOPS_LEVEL);
    slPoints = (int)MathMax(slPoints, stopLevel + 10); // Mínimo de StopLevel + 10 pontos de buffer
    
    // 6. Cálculo do TP Proporcional
    int tpPoints = (int)(tpDist / point);
    if(tpPoints <= 0) tpPoints = (int)(slPoints * 1.5); // Fallback RR 1:1.5 se TP vier zerado
    
    // Garantir que o TP também respeita o StopLevel
    tpPoints = (int)MathMax(tpPoints, stopLevel + 10);

   // 2. RE-CÁLCULO SEGURO (Fórmula solicitada pelo utilizador)
   double nSL = 0, nTP = 0;
   if(dir == "BUY") {
      nSL = NormalizeDouble(entry - (slPoints * point), digits);
      nTP = NormalizeDouble(entry + (tpPoints * point), digits);
   } else {
      nSL = NormalizeDouble(entry + (slPoints * point), digits);
      nTP = NormalizeDouble(entry - (tpPoints * point), digits);
   }

   // 3. VALIDAÇÃO DE STOP LEVEL (FBS/Broker Enforcement)
   double minDistance = (stopLevel + 10) * point; // Buffer de 10 pontos

   if(dir == "BUY") {
      if(entry - nSL < minDistance) nSL = NormalizeDouble(entry - minDistance, digits);
      if(nTP > 0 && nTP - entry < minDistance) nTP = NormalizeDouble(entry + minDistance, digits);
   } else {
      if(nSL - entry < minDistance) nSL = NormalizeDouble(entry + minDistance, digits);
      if(nTP > 0 && entry - nTP < minDistance) nTP = NormalizeDouble(entry - minDistance, digits);
   }

   // 4. DEBUG DE SEGURANÇA (Solicitado pelo utilizador)
   Print("------------------------------------------");
   Print("🚀 EXECUTANDO SINAL: ", sigId, " | ", pair);
   Print("ENTRY: ", entry);
   Print("SL: ", nSL);
   Print("TP: ", nTP);
   Print("POINT: ", point);
   Print("DIGITS: ", digits);
   Print("STOPLEVEL: ", stopLevel);
   
   // 5. VALIDAÇÃO DE LADO (Invalid Checks)
   bool invalid = false;
   if(dir == "BUY") {
      if(nTP > 0 && nTP <= entry) { Print("❌ TP INVÁLIDO (BUY): TP <= ENTRY"); invalid = true; }
      if(nSL >= entry) { Print("❌ SL INVÁLIDO (BUY): SL >= ENTRY"); invalid = true; }
   } else {
      if(nTP > 0 && nTP >= entry) { Print("❌ TP INVÁLIDO (SELL): TP >= ENTRY"); invalid = true; }
      if(nSL <= entry) { Print("❌ SL INVÁLIDO (SELL): SL <= ENTRY"); invalid = true; }
   }

   if(invalid) return;

   double risk = GetDynamicRisk((double)slPoints);
   double lot  = CalculateLot(pair, risk, MathAbs(entry - nSL), (dir == "BUY") ? ORDER_TYPE_BUY : ORDER_TYPE_SELL);

   if(lot > 0) {
      trade.SetDeviationInPoints(GetDynamicDeviation(pair));

      bool success = false;
      if(type == "LIMIT") {
         if(dir == "BUY") success = trade.BuyLimit(lot, entry, pair, nSL, nTP);
         else             success = trade.SellLimit(lot, entry, pair, nSL, nTP);
      } else {
         if(dir == "BUY") success = trade.Buy(lot, pair, 0, nSL, nTP);
         else             success = trade.Sell(lot, pair, 0, nSL, nTP);
      }

      if(success) {
         Print("✅ Ordem ", type, " Enviada | ", pair, " | Lote: ", lot);
         SetSymbolCooldown(pair);
         
         // Adicionar à fila de protecção assíncrona (Apex Guardian)
         if(sigId != "") {
            ulong ticket = trade.ResultOrder();
            if(ticket > 0) AddToPendingQueue(ticket, nSL, nTP, sigId);
         }
      } else {
         Print("❌ Erro ao executar ", type, " | ", trade.ResultRetcodeDescription());
      }
   }
}

void AddToPendingQueue(ulong ticket, double sl, double tp, string signalId) {
   int s = ArraySize(PendingQueue);
   ArrayResize(PendingQueue, s + 1);
   PendingQueue[s].ticket = ticket;
   PendingQueue[s].sl = sl;
   PendingQueue[s].tp = tp;
   PendingQueue[s].signalId = signalId;
   PendingQueue[s].timestamp = TimeCurrent();
   
   // Persistência em GlobalVariables
   GlobalVariableSet("PSL_" + (string)ticket, sl);
   GlobalVariableSet("PTP_" + (string)ticket, tp);
}

void ProcessPendingProtections() {
   for(int i = ArraySize(PendingQueue) - 1; i >= 0; i--) {
      if(TimeCurrent() - PendingQueue[i].timestamp > 60) {
         RemovePendingQueueIndex(i);
         continue;
      }

      ulong ticket = PendingQueue[i].ticket;
      if(ticket > 0 && PositionSelectByTicket(ticket)) {
         double sl = PositionGetDouble(POSITION_SL);
         if(sl <= 0 || sl == EMPTY_VALUE) {
            ApplyAsyncProtection(ticket, PendingQueue[i]);
         } else {
            // Já tem proteção (ou aplicada com sucesso)
            GlobalVariableDel("PSL_" + (string)ticket);
            GlobalVariableDel("PTP_" + (string)ticket);
            RemovePendingQueueIndex(i);
         }
      }
   }
}

bool ApplyAsyncProtection(ulong ticket, PendingProtectionData &data)
{
   if(!PositionSelectByTicket(ticket)) return false;

   string pair      = PositionGetString(POSITION_SYMBOL);
   double sl        = data.sl;
   double tp        = data.tp;
   double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
   int digits       = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   double point     = SymbolInfoDouble(pair, SYMBOL_POINT);
   double stopLevel = SymbolInfoInteger(pair, SYMBOL_TRADE_STOPS_LEVEL) * point;

   ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);

   // Verificação de Stop Level (Buffer de 5.0 pontos para segurança extra)
   double minDistance = (stopLevel + 5.0) * point;

   if(posType == POSITION_TYPE_BUY)
   {
      if(openPrice - sl < minDistance) sl = NormalizeDouble(openPrice - minDistance, digits);
      if(tp > 0 && tp - openPrice < minDistance) tp = NormalizeDouble(openPrice + minDistance, digits);
      
      if(sl >= openPrice) sl = NormalizeDouble(openPrice - minDistance, digits);
      if(tp > 0 && tp <= openPrice) tp = NormalizeDouble(openPrice + minDistance, digits);
   }
   else
   {
      if(sl - openPrice < minDistance) sl = NormalizeDouble(openPrice + minDistance, digits);
      if(tp > 0 && openPrice - tp < minDistance) tp = NormalizeDouble(openPrice - minDistance, digits);

      if(sl <= openPrice) sl = NormalizeDouble(openPrice + minDistance, digits);
      if(tp > 0 && tp >= openPrice) tp = NormalizeDouble(openPrice - minDistance, digits);
   }

   sl = NormalizeDouble(sl, digits);
   tp = NormalizeDouble(tp, digits);

   if(trade.PositionModify(ticket, sl, tp))
   {
      Print("🛡️ Protecção OK | Ticket: ", ticket);
      SendPost(InpServerUrl + "/ea/report", "{\"signalId\":\"" + data.signalId + "\",\"status\":\"EXECUTED\"}");
      return true;
   }
   return false;
}

struct SymbolSpecs {
   int    digits;
   double point;
   double pip;
   int    minStopPips;
   int    maxStopPips;
};

SymbolSpecs GetInstitutionalSpecs(string sym) {
   SymbolSpecs s;
   s.digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   s.point  = SymbolInfoDouble(sym, SYMBOL_POINT);
   
   if(IsXAU(sym)) {
      s.pip = 0.1; // 1 pip = $0.10
      s.minStopPips = 50;
      s.maxStopPips = 500;
   } else if(StringFind(sym, "JPY") >= 0) {
      s.pip = 0.01; // 1 pip = 0.01
      s.minStopPips = 10;
      s.maxStopPips = 100;
   } else {
      s.pip = 0.0001;
      s.minStopPips = 10;
      s.maxStopPips = 100;
   }
   return s;
}

double CalculateInstitutionalSL(double entry, double atr, ENUM_POSITION_TYPE type, string sym) {
   SymbolSpecs specs = GetInstitutionalSpecs(sym);
   double atrPips = atr / specs.pip;
   
   // Clamp
   atrPips = MathMax(specs.minStopPips, atrPips);
   atrPips = MathMin(specs.maxStopPips, atrPips);
   
   double stopDist = atrPips * specs.pip;
   double sl = (type == POSITION_TYPE_BUY) ? (entry - stopDist) : (entry + stopDist);
   return NormalizeDouble(sl, specs.digits);
}

void ProtectManualOrders()
{
   if(!InpManageManualOrders) return;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0 || !PositionSelectByTicket(ticket)) continue;

      if(PositionGetInteger(POSITION_MAGIC) != 0) continue;

      string sym = PositionGetString(POSITION_SYMBOL);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);

      if(currentSL > 0 && currentTP > 0) continue;

      ENUM_POSITION_TYPE type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      double entry = PositionGetDouble(POSITION_PRICE_OPEN);
      
      double atr = GetATR(sym, IsXAU(sym) ? PERIOD_H1 : PERIOD_M15);
      if(atr <= 0) atr = IsXAU(sym) ? 3.5 : 0.0015;

      double sl = currentSL;
      double tp = currentTP;

      if(currentSL <= 0) sl = CalculateInstitutionalSL(entry, atr * 2.0, type, sym);
      if(currentTP <= 0) {
         double tpDist = MathAbs(entry - sl) * 2.0;
         tp = (type == POSITION_TYPE_BUY) ? (entry + tpDist) : (entry - tpDist);
      }

      sl = NormalizeDouble(sl, (int)SymbolInfoInteger(sym, SYMBOL_DIGITS));
      tp = NormalizeDouble(tp, (int)SymbolInfoInteger(sym, SYMBOL_DIGITS));

      if(sl != currentSL || tp != currentTP) {
         if(trade.PositionModify(ticket, sl, tp))
            Print("✅ Manual Protected (INSTITUTIONAL): ", ticket, " | SL: ", sl, " | TP: ", tp);
      }
   }
}

void ReportBalance()
{
   static datetime lastReport = 0;
   if(TimeCurrent() - lastReport < 60) return; // Reportar a cada 60 segundos (1 minuto)
   lastReport = TimeCurrent();

   double balance     = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity      = AccountInfoDouble(ACCOUNT_EQUITY);
   double freeMargin  = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double margin      = AccountInfoDouble(ACCOUNT_MARGIN);
   double floatingPnL = equity - balance;

   double marginLevel = 0;
   if(margin > 0) marginLevel = (equity / margin) * 100.0;

   double drawdown = 0;
   if(balance > 0) drawdown = ((balance - equity) / balance) * 100.0;

   double dailyPnl = GetDailyPnL();
   
   string payload = "{"
      "\"licenseKey\":\"" + InpLicenseKey + "\","
      "\"balance\":" + DoubleToString(balance, 2) + ","
      "\"equity\":" + DoubleToString(equity, 2) + ","
      "\"freeMargin\":" + DoubleToString(freeMargin, 2) + ","
      "\"floatingPnL\":" + DoubleToString(floatingPnL, 2) + ","
      "\"marginLevel\":" + DoubleToString(marginLevel, 2) + ","
      "\"drawdown\":" + DoubleToString(drawdown, 2) + ","
      "\"dailyPnl\":" + DoubleToString(dailyPnl, 2) +
   "}";

   string url = InpServerUrl + "/ea/report-balance";
   string response = SendPost(url, payload);

   if(response == "") {
      Print("❌ [SYNC] Falha ao reportar saldo para o Dashboard.");
   }
   
   UpdateChartVisuals(); // Visual Gráfico (Real-time)
}





void UpdateChartVisuals()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   double floating = equity - balance;
   double margin  = AccountInfoDouble(ACCOUNT_MARGIN);
   double marginLevel = (margin > 0) ? (equity / margin) * 100.0 : 0;

   int totalPositions = PositionsTotal();

   string status = DailyTargetReached ? "LOCKED" : "RUNNING";

   string panel = 
      "============================\n" +
      "      AURAFOREX V8\n" +
      "============================\n" +
      "ACCOUNT : " + IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN)) + "\n" +
      "BALANCE : $" + DoubleToString(balance,2) + "\n" +
      "EQUITY  : $" + DoubleToString(equity,2) + "\n" +
      "FLOATING: $" + DoubleToString(floating,2) + "\n" +
      "MARGIN% : " + DoubleToString(marginLevel,1) + "%\n" +
      "ORDERS  : " + IntegerToString(totalPositions) + "\n" +
      "STATUS  : " + status + "\n" +
      "TIME    : " + TimeToString(TimeCurrent(), TIME_SECONDS);

   Comment(panel);
}

string SendPost(string url, string payload)
{
   uchar post[], res[];
   string headers = "Content-Type: application/json\r\n";
   string rh;

   StringToCharArray(payload, post);
   ResetLastError();

   int code = WebRequest("POST", url, headers, 5000, post, res, rh);

   if(code == -1)
   {
      Print("❌ WebRequest ERROR: ", GetLastError(), " | URL: ", url);
      return "";
   }

   // Print("🌐 HTTP ", code, " | ", url); // Debug opcional
   return CharArrayToString(res);
}

string SendGet(string url)
{
   uchar res[], data[];
   string rh;
   string headers = "";

   ResetLastError();

   int code = WebRequest("GET", url, headers, 5000, data, res, rh);

   if(code == -1)
   {
      Print("❌ WebRequest (GET) ERROR: ", GetLastError(), " | URL: ", url);
      return "";
   }

   return CharArrayToString(res);
}

int GetConsecutiveLosses()
{
   int losses = 0;
   int total  = HistoryDealsTotal();
   
   // Ler as últimas 10 operações fechadas (mais recentes primeiro)
   for(int i = total - 1; i >= MathMax(0, total - 10); i--)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;
      
      // Apenas entradas reais (não abertura)
      if(HistoryDealGetInteger(dealTicket, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;
      
      // Apenas ordens do nosso EA
      long dealMagic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
      if(dealMagic != InpMagicNumber) continue;
      
      double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
      
      if(profit < 0)
         losses++;
      else
         break; // Sequência de perdas interrompida por um lucro
      
      if(losses >= 3) break; // Só precisamos saber se chegou a 3
   }
   
   return losses;
}

double GetDynamicRisk(double pts)
{
   double risk = InpRiskPercent;
   
   // RISCO ADAPTATIVO: Se 3+ perdas consecutivas → corta risco a metade
   int losses = GetConsecutiveLosses();
   if(losses >= 3)
   {
      risk *= 0.5;
      static datetime lastWarn = 0;
      if(TimeCurrent() - lastWarn > 3600) {
         Print("⚠️ [RISK] ", losses, " perdas consecutivas | Risco reduzido para ", DoubleToString(risk, 2), "%");
         lastWarn = TimeCurrent();
      }
   }
   
   return risk;
}

double CalculateLot(string sym, double riskPercent, double slDist, ENUM_ORDER_TYPE type) {
   double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskVal  = balance * (riskPercent / 100.0);
   double tVal     = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
   double tSize    = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
   if(slDist <= 0 || tSize <= 0 || tVal <= 0) return 0;
   
   double lot  = riskVal / ((slDist / tSize) * tVal);
   double minL = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   lot = MathMax(minL, MathFloor(lot / step) * step);
   
   double margin = 0;
   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   double bid = SymbolInfoDouble(sym, SYMBOL_BID);
   double p = (type == ORDER_TYPE_BUY) ? ask : bid;

   if(OrderCalcMargin(type, sym, lot, p, margin)) {
      double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
      if(margin > freeMargin * 0.80) {
         double minMargin = 0;
         if(OrderCalcMargin(type, sym, minL, p, minMargin)) {
            if(minMargin > freeMargin * 0.80) {
               Print("⚠️ Sem margem para " + sym);
               return 0;
            }
            Print("ℹ️ Margem apertada para " + sym);
            return minL;
         }
      }
   }
   return NormalizeDouble(lot, 2);
}

double GetLastLow(string sym, ENUM_TIMEFRAMES tf, int bars) {
   double lows[]; ArraySetAsSeries(lows, true);
   if(CopyLow(sym, tf, 1, bars, lows) > 0) {
      double m = lows[0]; for(int i=1; i<ArraySize(lows); i++) if(lows[i] < m) m = lows[i]; return m;
   } return 0;
}

double GetLastHigh(string sym, ENUM_TIMEFRAMES tf, int bars) {
   double highs[]; ArraySetAsSeries(highs, true);
   if(CopyHigh(sym, tf, 1, bars, highs) > 0) {
      double m = highs[0]; for(int i=1; i<ArraySize(highs); i++) if(highs[i] > m) m = highs[i]; return m;
   } return 0;
}

bool IsProcessed(string id) 
{
   // Encurtar o prefixo para evitar limites de caracteres do MT5 (máx 63)
   string key = "A_" + id;
   return GlobalVariableCheck(key);
}

void AddProcessed(string id) 
{
   string key = "A_" + id;
   GlobalVariableSet(key, (double)TimeCurrent());
}

string ExtractValue(string json, string key) {
   // 1. Procurar a chave com aspas
   string searchKey = "\"" + key + "\"";
   int keyPos = StringFind(json, searchKey);
   if(keyPos < 0) return "";

   // 2. Encontrar o início do valor após os dois pontos ":"
   int colonPos = StringFind(json, ":", keyPos + StringLen(searchKey));
   if(colonPos < 0) return "";

   int valueStart = colonPos + 1;
   
   // Ignorar espaços em branco iniciais
   while(valueStart < StringLen(json) && 
         ((short)StringGetCharacter(json, valueStart) == ' ' || (short)StringGetCharacter(json, valueStart) == '\t' || (short)StringGetCharacter(json, valueStart) == '\n' || (short)StringGetCharacter(json, valueStart) == '\r'))
      valueStart++;

   string result = "";
   short firstChar = (short)StringGetCharacter(json, valueStart);

   if(firstChar == '\"') {
      // Caso seja STRING: pegar tudo entre as próximas aspas
      int endQuote = StringFind(json, "\"", valueStart + 1);
      if(endQuote > valueStart) result = StringSubstr(json, valueStart + 1, endQuote - (valueStart + 1));
   } else {
      // Caso seja NÚMERO/BOOLEAN: pegar até a próxima vírgula ou fecho de chaveta
      int commaPos = StringFind(json, ",", valueStart);
      int bracePos = StringFind(json, "}", valueStart);
      int endPos = -1;
      
      if(commaPos > 0 && bracePos > 0) endPos = MathMin(commaPos, bracePos);
      else if(commaPos > 0) endPos = commaPos;
      else if(bracePos > 0) endPos = bracePos;
      
      if(endPos > valueStart) result = StringSubstr(json, valueStart, endPos - valueStart);
      else result = StringSubstr(json, valueStart); // Último valor
   }

   // Limpeza final de espaços
   StringTrimLeft(result);
   StringTrimRight(result);
   return result;
}

double GetATR(string sym, ENUM_TIMEFRAMES tf)
{
   datetime currentBar = iTime(sym, tf, 0);
   
   // 1. Procurar no Cache
   int size = ArraySize(g_atrCache);
   for(int i = 0; i < size; i++) {
      if(g_atrCache[i].symbol == sym && g_atrCache[i].tf == tf) {
         if(g_atrCache[i].lastBar == currentBar && g_atrCache[i].value > 0) 
            return g_atrCache[i].value;
            
         // Atualizar valor se a barra mudou
         double atrBuf[];
         ArraySetAsSeries(atrBuf, true);
         if(CopyBuffer(g_atrCache[i].handle, 0, 0, 1, atrBuf) > 0) {
            g_atrCache[i].value = atrBuf[0];
            g_atrCache[i].lastBar = currentBar;
         }
         return g_atrCache[i].value;
      }
   }
   
   // 2. Se não existir, criar novo handle
   int newIdx = ArrayResize(g_atrCache, size + 1) - 1;
   g_atrCache[newIdx].symbol = sym;
   g_atrCache[newIdx].tf = tf;
   g_atrCache[newIdx].handle = iATR(sym, tf, 14);
   g_atrCache[newIdx].lastBar = currentBar;
   g_atrCache[newIdx].value = 0;
   
   double atrBuf2[];
   ArraySetAsSeries(atrBuf2, true);
   if(CopyBuffer(g_atrCache[newIdx].handle, 0, 0, 1, atrBuf2) > 0)
      g_atrCache[newIdx].value = atrBuf2[0];
      
   return g_atrCache[newIdx].value;
}

void CloseAllPositions()
{
   Print("🚨 [ACTION] Fechando TODAS as posições para garantir lucro diário...");
   
   for(int retry=0; retry<3; retry++)
   {
      bool stillOpen=false;

      for(int i=PositionsTotal()-1; i>=0; i--)
      {
         ulong ticket=PositionGetTicket(i);
         if(ticket<=0) continue;
         if(!PositionSelectByTicket(ticket)) continue;

         ResetLastError();
         bool closed = trade.PositionClose(ticket);

         if(!closed)
         {
            Print("❌ Failed close: ", ticket, " | ", trade.ResultRetcodeDescription());
            stillOpen=true;
         }
         else
         {
            Print("✅ Closed: ", ticket);
         }

         Sleep(200);
      }

      if(!stillOpen) break;
      Print("🔄 Tentativa ", retry+2, " de fecho total...");
      Sleep(1000); // Esperar 1s entre retries
   }
}
