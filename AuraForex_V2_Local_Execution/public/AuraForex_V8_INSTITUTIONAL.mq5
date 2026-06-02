///+------------------------------------------------------------------+
//|                                              AuraForex_SMC_V8 |
//|                                  Copyright 2026, AuraForex Corp  |
//|                                             https://auraforex.pt |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AuraForex Corp"
#property link      "https://auraforex.pt"
#property version   "8.0"
#property strict
#property tester_everytick_calculate

//--- INCLUDES ---
#include <Trade\Trade.mqh>
#include "JAson.mqh"

//--- INPUT PARAMETERS ---
input string   InpLicenseKey        = "COLE_SUA_LICENCA_AQUI"; // Chave de Licença (Dashboard)
input string   InpServerUrl         = "https://www.auratradebots.com/api"; // URL do seu VPS (Com /api)
input bool     InpIsCentAccount     = false;                   // A Conta é Cent? (Auto-adaptável)
input double   InpRiskPercent       = 1.0;                     // % de Risco por Trade
input int      InpMagicNumber       = 888222;                  // Magic Number das Ordens
input int      InpTimerSeconds      = 2;                       // Intervalo de Checagem (Segundos) — Recomendado: 2 ou 3
input int      InpMaxSLForex        = 1500;                    // Limite SL Forex (Pontos)
input int      InpMaxSLJPY          = 3000;                    // Limite SL JPY/Ouro (Pontos)
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
input double InpMaxSpreadPips        = 5.0;    // Spread Máximo Permitido para Modificações (Pips)
input bool   InpSessionFilter      = false;    // Filtrar Horário (Apenas Londres/NY)

struct ProfitLockData {
   ulong    ticket;
   double   peakProfit;   // Pico máximo de lucro atingido
   bool     active;       // ProfitLock activado para este ticket
   datetime activationTime; // Tempo de activação para buffer anti-spike
};

struct PortfolioProfitLock {
   bool     active;
   double   peakProfit;
   datetime activationTime;
};

//--- GLOBAL VARIABLES ---
double            g_MonetaryMultiplier = 1.0; // Multiplicador para Contas Cent
CTrade            trade;
bool              IsAuthorized = false;
datetime          lastCheckTime = 0;
ProfitLockData    ProfitLocks[];   // Array de monitoramento
PortfolioProfitLock GlobalProfitLockState = {false, 0, 0}; // Estado do ProfitLock Global
double            DailyStartBalance  = 0;
double            DailyStartEquity   = 0; 
double            DailyTargetProfit  = 0; // Meta fixa calculada apenas uma vez
bool              DailyTargetReached = false;
bool              DailyLossLock      = false; // Bloqueio por perda diária
double            DailyPeakPnL       = 0;     // Pico de lucro diário atingido
bool              DailyTargetLockActive = false; // Se a trava diária foi ativada
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
   TimeToStruct(TimeCurrent(), tm);
   int hour = tm.hour;
   
   // Londres + NY (Aproximado 7h às 18h GMT+2/3)
   return (hour >= 7 && hour <= 18);
}

bool ValidateStops(string sym, string dir, double price, double sl, double tp)
{
   double point = SymbolInfoDouble(sym, SYMBOL_POINT);
   int stopLevel = (int)SymbolInfoInteger(sym, SYMBOL_TRADE_STOPS_LEVEL);
   double minDist = stopLevel * point;

   if(dir == "BUY")
   {
      if(price - sl < minDist) return false;
      if(tp > 0 && tp - price < minDist) return false;
   }
   else
   {
      if(sl - price < minDist) return false;
      if(tp > 0 && price - tp < minDist) return false;
   }
   return true;
}

bool SafePositionModify(ulong ticket, double sl, double tp)
{
   if(!PositionSelectByTicket(ticket)) return false;
   string sym = PositionGetString(POSITION_SYMBOL);

   for(int i = 0; i < 5; i++)
   {
      ResetLastError();
      trade.SetTypeFillingBySymbol(sym);

      if(trade.PositionModify(ticket, sl, tp)) return true;

      Print("⚠️ Modify Retry ", i + 1, " | Ticket: ", ticket, " | Error: ", trade.ResultRetcodeDescription());
      if(i < 4) Sleep(500);
   }
   return false;
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
   
   // --- AUTO DETEÇÃO CONTA CENT ---
   g_MonetaryMultiplier = 1.0;
   if(InpIsCentAccount) {
      g_MonetaryMultiplier = 100.0;
      Print("✅ Conta Cent (Forçada pelo Utilizador). Multiplicador = 100x");
   } else {
      string currency = AccountInfoString(ACCOUNT_CURRENCY);
      if(StringFind(currency, "USC") >= 0 || StringFind(currency, "USX") >= 0 || StringFind(currency, "EUC") >= 0 || StringFind(currency, "GBX") >= 0) {
         g_MonetaryMultiplier = 100.0;
         Print("✅ Conta Cent Autodetectada (Moeda: ", currency, "). Multiplicador = 100x");
      }
   }
   
   EventSetTimer(InpTimerSeconds);
   trade.SetTypeFillingBySymbol(_Symbol);
   trade.SetAsyncMode(false);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) 
{ 
   EventKillTimer(); 
   
   // LIBERTAR HANDLES ATR (Institutional Memory Management)
   for(int i = 0; i < ArraySize(g_atrCache); i++)
   {
      if(g_atrCache[i].handle != INVALID_HANDLE)
      {
         IndicatorRelease(g_atrCache[i].handle);
         g_atrCache[i].handle = INVALID_HANDLE;
      }
   }
   ArrayFree(g_atrCache);
   Print("🧹 [CLEANUP] Handles de ATR libertados com sucesso.");
}

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

   // Monitorização removida do OnTick para evitar race conditions.
   // Centralizado no OnTimer sob o semáforo ExecutionBusy.
}

void OnTimer()
{
   // 1. SINCRONISMO DASHBOARD (Sempre ativo para evitar dados "travados")
   ReportBalance();
   UpdateChartVisuals();
   
   // 2. Proteger Ordens Manuais (Prioridade total e independente de autorização)
   ProtectManualOrders();

   // 3. SEMÁFORO DE EXECUÇÃO (Protegido por Wrapper para evitar Deadlocks)
   if(ExecutionBusy) return;
   ExecutionBusy = true;

   RunInstitutionalCore();

   ExecutionBusy = false;
}

void RunInstitutionalCore()
{
   // Validar Licença (anti-spam throttle interno)
   ValidateLicense();

   if(IsAuthorized)
   {
      CheckDailyLoss();
      CheckDailyTarget();
      CheckFridaySafeLock();
      ApplyBreakeven();
      
      ProcessPendingProtections(); // Aplica protecções assíncronas (Apex Guardian)
      
      CheckSignals();
      ProcessSignalQueue();

      // HIERARQUIA INSTITUCIONAL DE GESTÃO
      MonitorTrailingStop();
      MonitorPartialTP();
      MonitorProfitLock();
      MonitorGlobalProfitLock();
   }
}

double GetDailyPnL()
{
   double closedProfit = 0;
   
   // CORRECÇÃO INSTITUCIONAL: Cálculo via estrutura de tempo para evitar falhas do iTime em mercado fechado
   MqlDateTime dt; 
   TimeToStruct(TimeCurrent(), dt);
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
            if(magic == GetAuraMagic() || (InpManageManualOrders && magic == 0))
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
         long magic = PositionGetInteger(POSITION_MAGIC);
         if(magic == GetAuraMagic() || (InpManageManualOrders && magic == 0))
            floatingProfit += PositionGetDouble(POSITION_PROFIT);
      }
   }
   
   return closedProfit + floatingProfit;
}

void CheckDailyTarget()
{
   MqlDateTime tm;
   TimeCurrent(tm);

   if(tm.day_of_year != LastTradingDay)
   {
      double currentBal = AccountInfoDouble(ACCOUNT_BALANCE);
      double currentEq  = AccountInfoDouble(ACCOUNT_EQUITY);
      if(currentBal > 10 && currentEq > 10)
      {
         LastTradingDay = tm.day_of_year;
         DailyTargetReached = false;
         DailyLossLock      = false;
         DailyStartBalance  = currentBal;
         DailyStartEquity   = currentEq;
         DailyTargetProfit  = DailyStartEquity * (InpDailyTargetPct / 100.0);
         
         GlobalVariableSet("Aura_DailyTarget", DailyTargetProfit);
         GlobalVariableSet("Aura_DailyEquity", DailyStartEquity);
         GlobalVariableSet("Aura_TradingDay", tm.day_of_year);
         
         Print("🌅 [DAILY] Novo dia detectado. Meta/Loss resetados | Balance Inicial: $", DoubleToString(DailyStartBalance, 2), " | Equity Inicial: $", DoubleToString(DailyStartEquity, 2), " | Meta do Dia: $", DoubleToString(DailyTargetProfit, 2));
      }
   }

   // Fallback inicialização (Primeiro run do bot no dia ou após reboot)
   if(DailyTargetProfit <= 0 && DailyStartEquity <= 10)
   {
      if(GlobalVariableCheck("Aura_DailyTarget") && GlobalVariableCheck("Aura_TradingDay") && GlobalVariableGet("Aura_TradingDay") == tm.day_of_year)
      {
         DailyTargetProfit = GlobalVariableGet("Aura_DailyTarget");
         DailyStartEquity  = GlobalVariableGet("Aura_DailyEquity");
         DailyStartBalance = DailyStartEquity;
         LastTradingDay    = tm.day_of_year;
         Print("🔄 [RESTORE] Meta Diária recuperada da memória global: $", DoubleToString(DailyTargetProfit, 2));
      }
      else
      {
         double currentBal = AccountInfoDouble(ACCOUNT_BALANCE);
         double currentEq  = AccountInfoDouble(ACCOUNT_EQUITY);
         if(currentBal > 10 && currentEq > 10)
         {
            DailyStartBalance  = currentBal;
            DailyStartEquity   = currentEq;
            DailyTargetProfit  = DailyStartEquity * (InpDailyTargetPct / 100.0);
            
            GlobalVariableSet("Aura_DailyTarget", DailyTargetProfit);
            GlobalVariableSet("Aura_DailyEquity", DailyStartEquity);
            GlobalVariableSet("Aura_TradingDay", tm.day_of_year);
            
            Print("🌅 [BOOT] Saldo inicial definido: Balance = $", DoubleToString(DailyStartBalance, 2), " | Equity = $", DoubleToString(DailyStartEquity, 2), " | Meta do Dia: $", DoubleToString(DailyTargetProfit, 2));
         }
      }
   }

   if(DailyStartEquity <= 10) return; // Não calcular meta se saldo inicial não foi definido
   if(DailyTargetReached) return;

   // CÁLCULO PRECISO DO LUCRO DIÁRIO (via Histórico Fechado + Flutuante - Imune a depósitos/levantamentos)
   double dailyPnL = GetDailyPnL();

   // 1. Meta 100% atingida de imediato
   if(dailyPnL >= DailyTargetProfit && DailyTargetProfit > 0)
   {
      DailyTargetReached = true;
      Print("🏆 [DAILY] META ATINGIDA PELO BOT: $", DoubleToString(dailyPnL, 2), " >= Meta: $", DoubleToString(DailyTargetProfit, 2), " | Fechando posições...");
      
      CloseAllPositions();
      DailyTargetLockActive = false;
      DailyPeakPnL = 0;
      return;
   }

   // 2. Lógica da Trava de Segurança Diária (Daily Target Profit Lock)
   if(InpDailyTargetLockActive)
   {
      double activationThreshold = DailyTargetProfit * (InpDailyTargetLockPct / 100.0);
      double floorProfit         = DailyTargetProfit * (InpDailyTargetFloorPct / 100.0);

      // Ativar trava ao alcançar o gatilho (ex: 80% da meta)
      if(!DailyTargetLockActive && dailyPnL >= activationThreshold && DailyTargetProfit > 0)
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
   }
}

void CheckDailyLoss()
{
   if(DailyLossLock) return;
   if(DailyStartEquity <= 10) return; // Não calcular perda se saldo inicial não foi definido

   // Buffer de inicialização: Não actua nos primeiros 10 segundos para evitar spikes de boot
   static datetime bootTime = 0;
   if(bootTime == 0) bootTime = TimeCurrent();
   if(TimeCurrent() - bootTime < 10) return;

   double dailyPnL = GetDailyPnL();
   double lossPct = (dailyPnL < 0) ? (MathAbs(dailyPnL) / DailyStartEquity) * 100.0 : 0.0;

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);

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
         double minProfitActivation = InpProfitLockMin * g_MonetaryMultiplier;
         
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
      double protectionStart = InpProfitLockMin;
      if(peak < protectionStart) continue;

      // 3. Cálculo de Volatilidade Real via Cache
      ENUM_TIMEFRAMES atrTF = IsXAU(sym) ? PERIOD_H1 : PERIOD_M15;
      // double atr = GetATR(sym, atrTF);
      
      // if(atr <= 0) continue;

      // 3. Conversão ATR para Valor Monetário
      double point    = SymbolInfoDouble(sym, SYMBOL_POINT);
      double tickVal  = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
      double tickSize = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
      
      if(point <= 0 || tickSize <= 0) continue;
      
      // double atrInPoints = atr / point;
      // double lotSize     = PositionGetDouble(POSITION_VOLUME);
      // Cálculo aproximado do valor monetário do ATR para este lote
      // double atrMoney    = (atr / tickSize) * tickVal * lotSize;

      // 4. Factor de Volatilidade por Ativo
      // double volatilityFactor = (StringFind(sym, "XAU") >= 0) ? 2.5 : 1.2;
      double allowedDropMoney = peak * (InpProfitLockDrop / 100.0);
      if(allowedDropMoney < 0.5) allowedDropMoney = 0.5; // Garante limite mínimo viável
      
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
//| BREAKEVEN INTELIGENTE + CUSTOS                                   |
//+------------------------------------------------------------------+
double GetBreakevenPrice(ulong ticket, double openPrice, int posType, double volume, string sym)
{
   double point    = SymbolInfoDouble(sym, SYMBOL_POINT);
   double tickVal  = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
   double tickSize = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
   
   if(point <= 0 || tickSize <= 0 || tickVal <= 0 || volume <= 0) 
      return openPrice;
      
   double commission = 0;
   long pos_id = PositionGetInteger(POSITION_IDENTIFIER);
   if(HistorySelectByPosition(pos_id))
   {
      int deals = HistoryDealsTotal();
      for(int d = 0; d < deals; d++)
      {
         ulong deal_ticket = HistoryDealGetTicket(d);
         if(deal_ticket > 0)
            commission += HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
      }
   }
   
   double swap = PositionGetDouble(POSITION_SWAP);
   
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
      double minGlobalActivation = InpProfitLockMin * g_MonetaryMultiplier;
      
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
      double partialTarget = (IsXAU(sym) ? 25.0 : 10.0) * g_MonetaryMultiplier;

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

      if(sym == "" || !SymbolSelect(sym, true))
      {
         Print("⚠️ Símbolo inválido no trailing.");
         continue;
      }

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
      // ENUM_TIMEFRAMES atrTF = IsXAU(sym) ? PERIOD_H1 : PERIOD_M15;
      // double atr = GetATR(sym, atrTF);

      // SPREAD SPIKE GUARDIAN CHECK
      if(InpSpreadGuardianActive)
      {
         double spread = (ask - bid) / point;
         if(spread > InpMaxSpreadPips) continue; // Pular se o spread estiver alargado (notícia)
      }

      double trailStart = InpTrailingStart    * point;
      double trailStep  = InpTrailingStep     * point;
      double trailDist  = InpTrailingDistance * point;

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
            if(SafePositionModify(ticket, newSL, currentTP))
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
            if(SafePositionModify(ticket, newSL, currentTP))
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

   if(StringFind(res, "\"status\":\"success\"") >= 0 || StringFind(res, "\"status\":\"OK\"") >= 0) {
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

   // Processamento Profissional via JAson.mqh
   CJAVal root;
   if(!root.Deserialize(result)) {
      Print("❌ [JSON] Erro ao deserializar resposta do servidor.");
      return;
   }
   
   CJAVal signals = root["signals"];
   for(int i = 0; i < signals.Size(); i++)
   {
      CJAVal signal = signals[i];
      string signalId = signal["id"].ToStr();
      
      if(signalId == "") continue;

      // Verificação de segurança (Anti-duplicação na FILA e no HISTÓRICO)
      if(IsProcessed(signalId) || GlobalVariableCheck("SQ_" + signalId)) continue;

      // Serializa o objecto individual do sinal para a fila
      string signalJson = signal.Serialize();
      AddToSignalQueue(signalJson);
   }
}

void AddToSignalQueue(string json) {
   int s = ArraySize(SignalQueue);
   ArrayResize(SignalQueue, s + 1);
   SignalQueue[s].json = json;
   SignalQueue[s].timestamp = TimeCurrent();
   
   string signalId = "";
   CJAVal j;
   if(j.Deserialize(json)) signalId = j["id"].ToStr();
   
   GlobalVariableSet("SQ_" + signalId, (double)TimeCurrent()); // Persistência na fila
}

void ProcessSignalQueue()
{
   if(ArraySize(SignalQueue) == 0) return;

   string json = SignalQueue[0].json;
   CJAVal jParser;
   jParser.Deserialize(json);
   string sigId = jParser["id"].ToStr();

   if(ExecuteSignal(json))
   {
      GlobalVariableDel("SQ_" + sigId);
      RemoveSignalQueueIndex(0);
      Print("🗑️ Sinal ", sigId, " removido da fila (Sucesso/Inválido)");
   }
   else
   {
      Print("⏳ Sinal ", sigId, " manteve-se na fila para nova tentativa.");
   }
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
   if(!GlobalVariableCheck(gvName)) return true;
   return (TimeCurrent() >= (datetime)GlobalVariableGet(gvName));
}

ulong FindPositionBySymbol(string sym)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t > 0 && PositionSelectByTicket(t))
      {
         if(PositionGetString(POSITION_SYMBOL) == sym &&
            PositionGetInteger(POSITION_MAGIC) == GetAuraMagic())
         {
            return t;
         }
      }
   }
   return 0;
}

void SetSymbolCooldown(string sym)
{
   GlobalVariableSet("CD_" + sym, (double)TimeCurrent());
}

bool ExecuteSignal(string json)
{
   Print("🔍 [DEBUG] JSON recebido: ", json);
   CJAVal jParser;
   if(!jParser.Deserialize(json)) return true; // JSON invalido, removemos da fila para nao travar
   
   string sigId = jParser["id"].ToStr();
   
   // Mapeamento Flexível (Suporta 'pair' ou 'symbol' e 'direction' ou 'type')
   string pairRaw = jParser["pair"].ToStr(); 
   if(pairRaw == "") pairRaw = jParser["symbol"].ToStr();
   
   string pair = GetBrokerSymbol(pairRaw);
   
   string dir = jParser["direction"].ToStr();
   if(dir == "") dir = jParser["type"].ToStr();

   if(pair == "" || StringLen(pair) < 3)
   {
      Print("❌ [SIGNAL] Símbolo inválido (", pairRaw, ") recebido no JSON. Pulando sinal.");
      if(sigId != "") AddProcessed(sigId);
      return true;
   }
   
   string type = jParser["order_type"].ToStr();
   if(type == "") type = "MARKET"; // Padrão institucional se omitido
   double entry = jParser["entry"].ToDbl();
   double sl    = jParser["sl"].ToDbl();
   double tp    = jParser["tp"].ToDbl();
   
   // --- FILTRO DE SESSÃO INSTITUCIONAL (XAU só opera em Londres/NY) ---
   if(IsXAU(pair) && !IsTradingSession())
   {
      Print("⏰ Fora de sessão institucional para ", pair, " | Entrada Rejeitada");
      return true; // Rejeitado por regra, removemos da fila
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
   if(!SymbolSelect(pair, true)) { Print("❌ Par não encontrado no Market Watch: " + pair); return false; } // Tentará novamente

   // --- SYMBOL SYNC WARMUP (Institutional Fix for Zero Prices) ---
   Sleep(500);
   if(!SymbolIsSynchronized(pair)) {
      Print("⏳ Aguardando sincronismo de dados para ", pair, "...");
      for(int i = 0; i < 5; i++) {
         if(SymbolIsSynchronized(pair)) break;
         Sleep(200);
      }
   }

   // --- GLOBAL ORDER LIMIT (Institutional Safety) ---
   if(CountAuraPositions() >= InpMaxOrders)
   {
      Print("🛑 Limite global de ordens atingido (", InpMaxOrders, "). Ignorando sinal ", sigId);
      return true; // Ignorado por gestão, removemos da fila
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
      return true;
   }
   if(dir == "SELL" && currentSells >= InpMaxSells) {
      Print("⚠️ Limite de SELL atingido (", currentSells, "/", InpMaxSells, "). Ignorando sinal.");
      return true;
   }

   // --- SYMBOL COOLDOWN ---
   if(!CanTradeSymbol(pair)) {
      Print("⏳ Cooldown activo para ", pair, " | Aguardando intervalo de segurança.");
      return false; // Esperar
   }

   double point  = SymbolInfoDouble(pair, SYMBOL_POINT);
   int digits    = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   double ask    = SymbolInfoDouble(pair, SYMBOL_ASK);
   double bid    = SymbolInfoDouble(pair, SYMBOL_BID);
   
   if(ask <= 0 || bid <= 0) {
      Print("❌ [TICK-ERROR] Preços inválidos para ", pair, " (Ask: ", ask, ", Bid: ", bid, "). Rejeitando sinal.");
      return false;
   }
   double entryPrice = (dir == "BUY") ? ask : bid;
   
   if(entry <= 0) entry = entryPrice;
   
   if(IsXAU(pair)) {
      if(entry < 1000 || entry > 10000) entry = entryPrice;
   } else {
      if(entry < 0.01 || entry > 10) entry = entryPrice;
   }

   if(sl <= 0 || MathAbs(entry - sl) < (10 * point)) {
      sl = (dir == "BUY") ? entry - (300 * point) : entry + (300 * point);
   }

   if(tp <= 0 || MathAbs(entry - tp) < (10 * point)) {
      tp = (dir == "BUY") ? entry + (500 * point) : entry - (500 * point);
   }
   
    double slDist = (sl > 0) ? MathAbs(entry - sl) : 0;
    double tpDist = (tp > 0) ? MathAbs(entry - tp) : 0;
    
    if(slDist <= 0) {
       double structureSL = (dir == "BUY") ? GetLastLow(pair, PERIOD_M15, 10) : GetLastHigh(pair, PERIOD_M15, 10);
       
       if(structureSL > 0 && MathAbs(entry - structureSL) > (10 * point)) {
          slDist = MathAbs(entry - structureSL);
       } else {
          double atr = GetATR(pair, IsXAU(pair) ? PERIOD_H1 : PERIOD_M15);
          slDist = (atr > 0) ? (atr * 1.5) : (300 * point); 
       }
    }
    if(tpDist <= 0) {
       tpDist = slDist * 1.5; 
    }
    
    int hardMaxSL = (IsXAU(pair) || (StringFind(pair, "JPY") >= 0)) ? InpMaxSLJPY : InpMaxSLForex;
    
    int slPoints = (int)(slDist / point);
    
    double currentATR = GetATR(pair, IsXAU(pair) ? PERIOD_H1 : PERIOD_M15);
    int atrLimitPoints = (int)((currentATR * 2.0) / point);
    
    if(slPoints > atrLimitPoints && atrLimitPoints > 0) {
       slPoints = atrLimitPoints;
    }
    
    if(slPoints > hardMaxSL) {
       slPoints = hardMaxSL;
    }
    
    int stopLevel = (int)SymbolInfoInteger(pair, SYMBOL_TRADE_STOPS_LEVEL);
    slPoints = (int)MathMax(slPoints, stopLevel + 10);
    
    int tpPoints = (int)(tpDist / point);
    if(tpPoints <= 0) tpPoints = (int)(slPoints * 1.5);
    
    tpPoints = (int)MathMax(tpPoints, stopLevel + 10);

   double nSL = 0, nTP = 0;
   if(dir == "BUY") {
      nSL = NormalizeDouble(entry - (slPoints * point), digits);
      nTP = NormalizeDouble(entry + (tpPoints * point), digits);
   } else {
      nSL = NormalizeDouble(entry + (slPoints * point), digits);
      nTP = NormalizeDouble(entry - (tpPoints * point), digits);
   }

   MqlTick lastTick;
   if(!SymbolInfoTick(pair, lastTick)) return false;
   
   double marketPrice = (dir == "BUY") ? lastTick.ask : lastTick.bid;
   double tickSize    = SymbolInfoDouble(pair, SYMBOL_TRADE_TICK_SIZE);

   if(type != "LIMIT") {
      if(dir == "BUY") {
         nSL = marketPrice - (slPoints * point);
         nTP = (tpPoints > 0) ? marketPrice + (tpPoints * point) : 0;
      } else {
         nSL = marketPrice + (slPoints * point);
         nTP = (tpPoints > 0) ? marketPrice - (tpPoints * point) : 0;
      }
   }

   if(tickSize > 0) {
      nSL = MathRound(nSL / tickSize) * tickSize;
      if(nTP > 0) nTP = MathRound(nTP / tickSize) * tickSize;
   }
   
   nSL = NormalizeDouble(nSL, digits);
   if(nTP > 0) nTP = NormalizeDouble(nTP, digits);

   double freezeLevel = SymbolInfoInteger(pair, SYMBOL_TRADE_FREEZE_LEVEL) * point;
   double brokerMin   = MathMax(stopLevel * point, freezeLevel);
   
   double minDistance = MathMax(
      brokerMin + (20 * point), 
      IsXAU(pair) ? (150 * point) : (30 * point)
   );

   if(dir == "BUY") {
      if(marketPrice - nSL < minDistance) nSL = NormalizeDouble(marketPrice - minDistance, digits);
      if(nTP > 0 && nTP - marketPrice < minDistance) nTP = NormalizeDouble(marketPrice + minDistance, digits);
   } else {
      if(nSL - marketPrice < minDistance) nSL = NormalizeDouble(marketPrice + minDistance, digits);
      if(nTP > 0 && marketPrice - nTP < minDistance) nTP = NormalizeDouble(marketPrice - minDistance, digits);
   }

   // --- HARMONIZAÇÃO INSTITUCIONAL DE PREÇOS ---
   // Se o sinal for MARKET, ignoramos o entry do JSON e usamos o preço actual de mercado
   if(type == "MARKET") entry = marketPrice;

   bool invalid = false;
   if(dir == "BUY") {
      if(nTP > 0 && nTP <= entry) nTP = NormalizeDouble(entry + minDistance, digits);
      if(nSL >= entry) nSL = NormalizeDouble(entry - minDistance, digits);
   } else {
      if(nTP > 0 && nTP >= entry) nTP = NormalizeDouble(entry - minDistance, digits);
      if(nSL <= entry) nSL = NormalizeDouble(entry + minDistance, digits);
   }
   
   // Verificação final
   if(dir == "BUY" && (entry <= 0 || (nTP > 0 && nTP <= entry))) invalid = true;
   if(dir == "SELL" && (entry <= 0 || (nTP > 0 && nTP >= entry))) invalid = true;

   if(invalid) return true; // Sinal inválido, removemos da fila

   double risk = GetDynamicRisk((double)slPoints);
   double lot  = CalculateLot(pair, risk, MathAbs(entry - nSL), (dir == "BUY") ? ORDER_TYPE_BUY : ORDER_TYPE_SELL);

   if(lot > 0) {
      trade.SetDeviationInPoints(GetDynamicDeviation(pair));
      trade.SetTypeFillingBySymbol(pair);

      if(!ValidateStops(pair, dir, entryPrice, nSL, nTP))
      {
         Print("❌ [EXECUTION-ABORT] Stops inválidos após normalização para ", pair);
         return true; // Erro fatal de stops, removemos
      }

      bool success = false;
      if(type == "LIMIT") {
         if(dir == "BUY") success = trade.BuyLimit(lot, entry, pair, nSL, nTP);
         else             success = trade.SellLimit(lot, entry, pair, nSL, nTP);
      } else {
         if(dir == "BUY") success = trade.Buy(lot, pair);
         else             success = trade.Sell(lot, pair);
      }

      if(success) {
         Print("✅ Ordem executada com sucesso!");
         SetSymbolCooldown(pair);
         
         if(sigId != "") {
            Sleep(500); 
            ulong ticket = FindPositionBySymbol(pair);
            
            if(ticket > 0) AddToPendingQueue(ticket, nSL, nTP, sigId);
            else Print("⚠️ [WARNING] Posição aberta mas não encontrada para proteção imediata. Tentará no próximo ciclo.");
            
            AddProcessed(sigId);
         }
         return true; // SUCESSO!
      } else {
         Print("❌ Erro ao executar ", type, " | ", trade.ResultRetcodeDescription());
         return false; // FALHA TEMPORÁRIA, TENTAR NOVAMENTE
      }
   }
   return false;
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

   if(SafePositionModify(ticket, sl, tp))
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
         if(SafePositionModify(ticket, sl, tp))
            Print("✅ Manual Protected (INSTITUTIONAL): ", ticket, " | SL: ", sl, " | TP: ", tp);
      }
   }
}

void ReportBalance()
{
   int interval = (PositionsTotal() > 0) ? 5 : 60;
   static datetime lastReport = 0;
   if(TimeCurrent() - lastReport < interval) return; // Reportar a cada 5 segundos se tiver ordens abertas, senão 60 segundos
   lastReport = TimeCurrent();

   double balance     = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity      = AccountInfoDouble(ACCOUNT_EQUITY);
   double freeMargin  = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double margin      = AccountInfoDouble(ACCOUNT_MARGIN);
   double floatingPnL = CalculateAuraFloatingPnL();

   double marginLevel = 0;
   if(margin > 0) marginLevel = (equity / margin) * 100.0;

   double drawdown = 0;
   if(balance > 0) drawdown = ((balance - equity) / balance) * 100.0;

   // 🛡️ CONSISTÊNCIA VISUAL ABSOLUTA: O Dashboard deve mostrar exatamente o PnL calculado para a Trava (Equity Atual - Start Equity)
   double dailyPnl = (DailyStartEquity > 0) ? (equity - DailyStartEquity) : 0;
   
   string openTradesJson = "[";
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--) {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket)) {
         long magic = PositionGetInteger(POSITION_MAGIC);
         if(magic == GetAuraMagic() || (InpManageManualOrders && magic == 0)) {
            string sym = PositionGetString(POSITION_SYMBOL);
            long type = PositionGetInteger(POSITION_TYPE);
            string dir = (type == POSITION_TYPE_BUY) ? "BUY" : "SELL";
            double profit = PositionGetDouble(POSITION_PROFIT);
            double lot = PositionGetDouble(POSITION_VOLUME);
            double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            
            if(count > 0) openTradesJson += ",";
            openTradesJson += "{\\\"id\\\":\\\"" + IntegerToString(ticket) + "\\\",\\\"pair\\\":\\\"" + sym + "\\\",\\\"direction\\\":\\\"" + dir + "\\\",\\\"profit\\\":" + DoubleToString(profit, 2) + ",\\\"lotSize\\\":" + DoubleToString(lot, 2) + ",\\\"openPrice\\\":" + DoubleToString(openPrice, 5) + "}";
            count++;
         }
      }
   }
   openTradesJson += "]";
   
   string payload = "{"
      "\"licenseKey\":\"" + InpLicenseKey + "\","
      "\"balance\":" + DoubleToString(balance, 2) + ","
      "\"equity\":" + DoubleToString(equity, 2) + ","
      "\"freeMargin\":" + DoubleToString(freeMargin, 2) + ","
      "\"floatingPnL\":" + DoubleToString(floatingPnL, 2) + ","
      "\"marginLevel\":" + DoubleToString(marginLevel, 2) + ","
      "\"drawdown\":" + DoubleToString(drawdown, 2) + ","
      "\"dailyPnl\":" + DoubleToString(dailyPnl, 2) + ","
      "\"dailyProfitTarget\":" + DoubleToString(InpDailyTargetPct, 2) + ","
      "\"dailyLossLimit\":" + DoubleToString(InpMaxDailyLossPct, 2) + ","
      "\"isLocked\":" + (DailyTargetReached || DailyLossLock ? "true" : "false") + ","
      "\"isProfitLocked\":" + (DailyTargetReached ? "true" : "false") + ","
      "\"isLossLocked\":" + (DailyLossLock ? "true" : "false") + ","
      "\"openTrades\":" + openTradesJson +
   "}";

   string url = InpServerUrl + "/ea/report-balance";
   string response = SendPost(url, payload);

   if(response == "") {
      Print("❌ [SYNC] Falha ao reportar saldo para o Dashboard.");
      return;
   }
   
   // --- SINCRONIZAÇÃO INSTITUCIONAL DE TRAVAS DO SERVIDOR ---
   CJAVal root;
   if(root.Deserialize(response))
   {
      bool isProfitLocked = root["isProfitLocked"].ToBool();
      bool isLossLocked   = root["isLossLocked"].ToBool();
      double serverStartBalance = root["dailyStartBalance"].ToDbl();
      
      if(serverStartBalance > 10)
      {
         DailyStartBalance = serverStartBalance;
         if(DailyStartEquity <= 0) DailyStartEquity = serverStartBalance;
      }
      
      if(isProfitLocked && !DailyTargetReached)
       {
          DailyTargetReached = true;
          Print("🏆 [SERVER-SYNC] Meta Diária Atingida no Servidor! Fechando todas as posições...");
          CloseAllPositions();
       }
       else if(!isProfitLocked && DailyTargetReached)
       {
          DailyTargetReached = false;
          Print("🌅 [SERVER-SYNC] Reset de Meta Diária no Servidor detectado. Desbloqueando...");
       }
       
       if(isLossLocked && !DailyLossLock)
       {
          DailyLossLock = true;
          Print("🛑 [SERVER-SYNC] Limite de Perda Diária Atingido no Servidor! Fechando todas as posições...");
          CloseAllPositions();
       }
       else if(!isLossLocked && DailyLossLock)
       {
          DailyLossLock = false;
          Print("🌅 [SERVER-SYNC] Reset de Perda Diária no Servidor detectado. Desbloqueando...");
       }
   }
   
   UpdateChartVisuals(); // Visual Gráfico (Real-time)
}





double CalculateAuraFloatingPnL()
{
   double total = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         if(PositionGetInteger(POSITION_MAGIC) == GetAuraMagic())
            total += PositionGetDouble(POSITION_PROFIT);
      }
   }
   return total;
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

   int code = WebRequest("POST", url, headers, 10000, post, res, rh);

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

   int code = WebRequest("GET", url, headers, 10000, data, res, rh);

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
   lot = NormalizeDouble(MathMax(minL, MathFloor(lot / step) * step), 2);
   
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

// --- FUNÇÃO DE HARMONIZAÇÃO DE SÍMBOLOS (SUFIXOS) ---
string GetBrokerSymbol(string baseSym)
{
   if(baseSym == "") return "";
   
   // 1. Tentar correspondência exacta
   if(SymbolInfoInteger(baseSym, SYMBOL_VISIBLE)) return baseSym;
   
   // 2. Procurar por sufixos (.ecn, .pro, etc)
   int total = SymbolsTotal(false);
   for(int i = 0; i < total; i++)
   {
      string sym = SymbolName(i, false);
      if(StringFind(sym, baseSym) == 0) // Começa com o nome base
      {
         SymbolSelect(sym, true);
         return sym;
      }
   }
   
   return baseSym; // Fallback
}

// ExtractValue removido em favor da biblioteca JAson.mqh

double GetATR(string sym, ENUM_TIMEFRAMES tf)
{
   // --- PROTEÇÃO CRÍTICA ---
   if(sym == "" || StringLen(sym) < 3)
   {
      Print("❌ [ATR] Símbolo inválido.");
      return 0;
   }

   if(!SymbolSelect(sym, true))
   {
      Print("❌ [ATR] Falha ao selecionar símbolo: ", sym);
      return 0;
   }

   datetime currentBar = iTime(sym, tf, 0);

   if(currentBar <= 0)
   {
      Print("❌ [ATR] Sem barras disponíveis para ", sym);
      return 0;
   }

   // --- CACHE ---
   int size = ArraySize(g_atrCache);

   for(int i = 0; i < size; i++)
   {
      if(g_atrCache[i].symbol == sym &&
         g_atrCache[i].tf == tf)
      {
         if(g_atrCache[i].lastBar == currentBar &&
            g_atrCache[i].value > 0)
         {
            return g_atrCache[i].value;
         }

         double atrBuf[];
         ArraySetAsSeries(atrBuf, true);

         if(CopyBuffer(g_atrCache[i].handle, 0, 0, 1, atrBuf) > 0)
         {
            g_atrCache[i].value   = atrBuf[0];
            g_atrCache[i].lastBar = currentBar;
         }

         return g_atrCache[i].value;
      }
   }

   // --- NOVO HANDLE ---
   int handle = iATR(sym, tf, 14);

   if(handle == INVALID_HANDLE)
   {
      Print("❌ [ATR-ERROR] Handle inválido para ", sym,
            " | TF=", EnumToString(tf),
            " | Erro=", GetLastError());

      return 0;
   }

   ArrayResize(g_atrCache, size + 1);

   g_atrCache[size].symbol  = sym;
   g_atrCache[size].tf      = tf;
   g_atrCache[size].handle  = handle;
   g_atrCache[size].lastBar = currentBar;
   g_atrCache[size].value   = 0;

   double atrBuf2[];
   ArraySetAsSeries(atrBuf2, true);

   if(CopyBuffer(handle, 0, 0, 1, atrBuf2) > 0)
   {
      g_atrCache[size].value = atrBuf2[0];
   }

   return g_atrCache[size].value;
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

         long magic = PositionGetInteger(POSITION_MAGIC);
         if(magic != GetAuraMagic() && (!InpManageManualOrders || magic != 0))
            continue;

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
