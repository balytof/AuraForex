///+------------------------------------------------------------------+
//|                                              AuraForex_SMC_V8 |
//|                                  Copyright 2026, AuraForex Corp  |
//|                                             https://auraforex.pt |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AuraForex Corp"
#property link      "https://auraforex.pt"
#property version   "8.1"
#property strict
#property tester_everytick_calculate

//--- INCLUDES ---
#include <Trade\Trade.mqh>
#include "JAson.mqh"
#include "AuraGUI.mqh"

CAuraPanel *g_Panel;


//--- INPUT PARAMETERS ---
string Tester_LicenseKey        = "COLE_SUA_LICENCA_AQUI"; // Chave de Licença (Dashboard)
string Tester_ServerUrl         = "https://www.auratradebots.com/api"; // URL do seu VPS (Com /api)
bool Tester_IsCentAccount     = false;                   // A Conta é Cent? (Auto-adaptável)
double Tester_RiskPercent       = 1.0;                     // % de Risco por Trade
int Tester_MagicNumber       = 888222;                  // Magic Number das Ordens
int Tester_TimerSeconds      = 2;                       // Intervalo de Checagem (Segundos) – Recomendado: 2 ou 3
int Tester_MaxSLForex        = 1500;                    // Limite SL Forex (Pontos)
int Tester_MaxSLJPY          = 3000;                    // Limite SL JPY (Pontos)
int Tester_MaxSLOuro         = 1500;                    // Limite SL Ouro (Pontos)
int Tester_MaxOrders         = 6;                       // Limite Global de Ordens
int Tester_MaxBuys           = 6;                       // Máximo de Compras Simultâneas
int Tester_MaxSells          = 6;                       // Máximo de Vendas Simultâneas
int Tester_TradeCooldown     = 60;                      // Cooldown entre ordens do mesmo par (seg)

// --- XAU DISTANCE SCALPER --- 
int Tester_XAU_StepDistance      = 100; // XAU: Distância para Abrir Nova Ordem (Pts)
int Tester_XAU_TargetPoints      = 200; // XAU: Alvo Fixo de Lucro (Pts)
int Tester_XAU_ReversalPoints    = 150; // XAU: Reversão para Fechar Lucros (Pts)
int Tester_XAU_HoldSeconds       = 30;  // XAU: Tempo Limite no Lucro (Seg)

// --- PROFIT LOCK PARAMETERS ---
double Tester_ProfitLockMin     = 3.0;   // Lucro mínimo para activar ProfitLock ($)
double Tester_ProfitLockDrop    = 30.0;  // % de queda do pico para fechar ordem

// --- TRAILING STOP PARAMETERS ---
bool Tester_TrailingEnabled   = true;      // Trailing Stop Activo
int Tester_TrailingStart_XAU     = 200;       // Trailing Start Ouro
int Tester_TrailingDistance_XAU  = 300;       // Trailing Distance Ouro
int Tester_TrailingStep_XAU      = 50;        // Trailing Step Ouro
int Tester_TrailingStart_JPY     = 150;       // Trailing Start JPY
int Tester_TrailingDistance_JPY  = 200;       // Trailing Distance JPY
int Tester_TrailingStep_JPY      = 30;        // Trailing Step JPY
int Tester_TrailingStart_Forex   = 100;       // Trailing Start Forex
int Tester_TrailingDistance_Forex= 150;       // Trailing Distance Forex
int Tester_TrailingStep_Forex    = 20;        // Trailing Step Forex

// --- TWIN TRADING (RUNNER) ---
// ✅ FIX #3: Renomeado de Tester_UseTwinTrading para g_UseTwinTrading
//    para seguir o padrão das restantes variáveis globais e ser
//    correctamente sobrescrito pela GUI / ficheiro de configuração.
//    ANTES: bool Tester_UseTwinTrading = true;
//    DEPOIS: declarado directamente como global g_UseTwinTrading (ver secção globals)

bool Tester_ManageManualOrders = true;     // Gerir Ordens Manuais (Magic 0)
double Tester_MaxDailyLossPct    = 10.0;     // Perda Máxima Diária (%)

// --- TRAVA DE META DIÁRIA (DAILY TARGET PROFIT LOCK) ---
bool Tester_DailyTargetLockActive = true;  // Ativar Trava de Meta Diária
double Tester_DailyTargetLockPct   = 80.0;  // Ativar Trava ao atingir % da Meta (ex: 80%)
double Tester_DailyTargetFloorPct  = 50.0;  // Lucro Mínimo Garantido ao reverter % (ex: 50%)

// --- BE INTELIGENTE + CUSTOS (BREAKEVEN PLUS COSTS) ---
bool Tester_BreakevenEnabled     = true;   // Ativar Breakeven Inteligente
int Tester_BreakevenTrigger     = 40;     // Gatilho do Breakeven (4.0 pips de lucro)
int Tester_BreakevenSecure      = 10;     // Pips Extras a Garantir (BE + 1.0 pip)

// --- SEXTA-FEIRA SEGURA (FRIDAY SAFE LOCK) ---
bool Tester_FridaySafeLock       = false;   // DESATIVADO PARA TESTES
int Tester_FridayHour           = 20;     // Hora de fecho na Sexta-feira (GMT/Broker)
int Tester_FridayMinute         = 0;      // Minuto de fecho na Sexta-feira

// --- FILTRO DE SPREAD (SPREAD SPIKE GUARDIAN) ---
bool Tester_SpreadGuardianActive = true;   // Ativar Spread Spike Guardian
double Tester_MaxSpreadPips        = 5.0;    // Spread Máximo Permitido para Modificações (Pips)
bool Tester_SessionFilter      = false;    // Filtrar Horário (Apenas Londres/NY)

struct ProfitLockData {
   ulong    ticket;
   double   peakProfit;
   bool     active;
   datetime activationTime;
};

struct PortfolioProfitLock {
   bool     active;
   double   peakProfit;
   datetime activationTime;
};


struct XAUTimerData {
   ulong    ticket;
   datetime posTime;
};
XAUTimerData XAUTimers[];

//--- FORWARD DECLARATIONS ---
double GetPositionCommission(ulong ticket);

//--- GLOBAL VARIABLES ---
double            g_MonetaryMultiplier = 1.0;
CTrade            trade;
bool              IsAuthorized = false;
datetime          lastCheckTime = 0;
double            DailyStartBalance  = 0;
double            DailyStartEquity   = 0;
bool              DailyTargetReached = false;
bool              DailyLossLock         = false;
bool              DailyTargetLockActive = false;
double            DailyPeakPnL          = 0;
double            DailyTargetProfit     = 0;
int               LastTradingDay        = -1;
int               ConsecutiveLosses     = 0;
int               g_MaxSLForex      = 1500;
int               g_MaxSLJPY        = 3000;
int               g_MaxSLOuro       = 1500;
int               g_MaxOrders       = 6;
int               g_XAU_StepDistance = 100;
int               g_XAU_TargetPoints = 200;
int               g_XAU_ReversalPoints = 150;
int               g_XAU_HoldSeconds = 30;
double            g_XAU_AnchorPrice = 0;
double            g_XAU_PeakPrice = 0;
double            g_XAU_ValleyPrice = 0;
int               g_TrailingStart_XAU = 200;
int               g_TrailingDistance_XAU = 300;
int               g_TrailingStep_XAU = 50;

// ✅ FIX #3: g_UseTwinTrading declarado aqui como global (padrão g_*)
//    Será inicializado em OnInit() a partir de Tester_UseTwinTrading
//    como fallback, ou sobrescrito pela GUI/ficheiro de configuração.
bool              g_UseTwinTrading = true;

bool              g_UseTwinTrading = true;


ProfitLockData      ProfitLocks[];
PortfolioProfitLock GlobalProfitLockState;

// --- CACHE DE INDICADORES ---
struct ATRCache {
   string          symbol;
   ENUM_TIMEFRAMES tf;
   int             handle;
   double          value;
   datetime        lastBar;
};
ATRCache g_atrCache[];

//--- ESTRUTURA PROTECÇÃO ASSÍNCRONA ---
struct PendingProtectionData {
   ulong    ticket;
   double   sl;
   double   tp;
   string   signalId;
   datetime timestamp;
};
PendingProtectionData PendingQueue[];

//--- ESTRUTURA FILA DE SINAIS ---
struct SignalQueueData {
   string   json;
   datetime timestamp;
};
SignalQueueData SignalQueue[];

struct PartialCloseData
{
   ulong ticket;
   bool  closed;
};

PartialCloseData PartialCloses[];
bool            ExecutionBusy = false;

//--- Funções Auxiliares de Especialista
bool IsXAU(string sym) { return (StringFind(sym, "XAU") >= 0 || StringFind(sym, "GOLD") >= 0); }

bool IsTradingSession()
{
   if(!g_SessionFilter) return true;
   MqlDateTime tm;
   TimeToStruct(TimeCurrent(), tm);
   int hour = tm.hour;
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
   return IsXAU(sym) ? 35.0 : 15.0;
}

bool IsVolatilityAbnormal(string sym)
{
   ENUM_TIMEFRAMES atrTF = IsXAU(sym) ? PERIOD_H1 : PERIOD_M15;
   double atrNow = GetATR(sym, atrTF);
   if(atrNow <= 0) return false;
   double limit = IsXAU(sym) ? 5.0 : 0.0050;
   return (atrNow > limit && atrNow > 0);
}

long GetAuraMagic()
{
   return g_MagicNumber;
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

// ✅ FIX #1 — HELPER: Inicializa DailyStartEquity e DailyStartBalance
//    de forma segura a partir do equity actual.
//    Chamado em OnInit() e no início de CheckDailyLoss() como fallback.
//    PROBLEMA ORIGINAL: DailyStartEquity ficava a 0 se CheckDailyTarget()
//    (comentada em RunInstitutionalCore) nunca corresse, tornando o
//    circuit-breaker de 10% completamente inoperacional.
void InitDailyBaseline()
{
   double currentBal = AccountInfoDouble(ACCOUNT_BALANCE);
   double currentEq  = AccountInfoDouble(ACCOUNT_EQUITY);
   if(currentBal > 10 && currentEq > 10)
   {
      DailyStartBalance = currentBal;
      DailyStartEquity  = currentEq;
      MqlDateTime dt;
      TimeToStruct(TimeCurrent(), dt);
      LastTradingDay = dt.day_of_year;
      Print("📊 [BASELINE] DailyStartEquity inicializado: $", DoubleToString(currentEq, 2),
            " | Balance: $", DoubleToString(currentBal, 2));
   }
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   // --- AURA GUI INIT ---
   ChartSetInteger(0, CHART_EVENT_MOUSE_MOVE, true);
   g_Panel = new CAuraPanel();
   if(!g_Panel.Create(0, "AuraDashboard", 0, 50, 50, 600, 620)) {
       Print("Falha ao criar o painel Aura GUI.");
       return INIT_FAILED;
   }

   if(!FileIsExist("AuraForexConfig.txt", FILE_COMMON)) {
       g_LicenseKey  = Tester_LicenseKey;
       g_ServerUrl   = Tester_ServerUrl;
       g_IsCentAccount = Tester_IsCentAccount;
       g_RiskPercent = Tester_RiskPercent;
       g_MagicNumber = Tester_MagicNumber;
       // ✅ FIX #3: Inicializar g_UseTwinTrading a partir do parâmetro Tester_
       //    quando não existe ficheiro de configuração (fallback para Tester).
       g_UseTwinTrading = true; // valor padrão; a GUI sobrescreve se necessário
       
       // Fallbacks para as novas variáveis do Trailing
       g_TrailingEnabled = Tester_TrailingEnabled;
       g_TrailingStart_JPY = Tester_TrailingStart_JPY;
       g_TrailingDistance_JPY = Tester_TrailingDistance_JPY;
       g_TrailingStep_JPY = Tester_TrailingStep_JPY;
       g_TrailingStart_Forex = Tester_TrailingStart_Forex;
       g_TrailingDistance_Forex = Tester_TrailingDistance_Forex;
       g_TrailingStep_Forex = Tester_TrailingStep_Forex;
       
       // Outras variáveis ausentes no fallback original
       g_ProfitLockMin = Tester_ProfitLockMin;
       g_ProfitLockDrop = Tester_ProfitLockDrop;
       g_MaxSLForex = Tester_MaxSLForex;
       g_MaxSLJPY = Tester_MaxSLJPY;
       g_MaxSLOuro = Tester_MaxSLOuro;
       g_TrailingStart_XAU = Tester_TrailingStart_XAU;
       g_TrailingDistance_XAU = Tester_TrailingDistance_XAU;
       g_TrailingStep_XAU = Tester_TrailingStep_XAU;
       g_MaxSLJPY = Tester_MaxSLJPY;
       g_MaxOrders = Tester_MaxOrders;
       g_XAU_StepDistance = Tester_XAU_StepDistance;
       g_XAU_TargetPoints = Tester_XAU_TargetPoints;
       g_XAU_ReversalPoints = Tester_XAU_ReversalPoints;
       g_XAU_HoldSeconds = Tester_XAU_HoldSeconds;
       g_MaxBuys = Tester_MaxBuys;
       g_MaxSells = Tester_MaxSells;
       g_TradeCooldown = Tester_TradeCooldown;
       g_DailyTargetLockActive = Tester_DailyTargetLockActive;
       g_DailyTargetPct = 5.0; // Valor original de fallback na GUI
       g_MaxDailyLossPct = Tester_MaxDailyLossPct;
       g_BreakevenEnabled = Tester_BreakevenEnabled;
       g_BreakevenTrigger = Tester_BreakevenTrigger;
       g_BreakevenSecure = Tester_BreakevenSecure;
       g_FridaySafeLock = Tester_FridaySafeLock;
       g_FridayHour = Tester_FridayHour;
       g_FridayMinute = Tester_FridayMinute;
       g_SpreadGuardianActive = Tester_SpreadGuardianActive;
       g_MaxSpreadPips = Tester_MaxSpreadPips;
       g_SessionFilter = Tester_SessionFilter;
       g_ManageManualOrders = Tester_ManageManualOrders;
   }

   Print("🚀 AURA V8 INSTITUCIONAL v8.1 - Execution Engine (FIXED)");

   ChartSetInteger(0, CHART_SHOW_TRADE_HISTORY, true);
   ChartSetInteger(0, CHART_SHOW_TRADE_LEVELS, true);
   ChartSetInteger(0, CHART_SHOW_OBJECT_DESCR, true);
   ChartRedraw();

   trade.SetExpertMagicNumber(GetAuraMagic());
   trade.SetDeviationInPoints(30);

   ValidateLicense();
   RecoverState();

   // --- AUTO DETECÇÃO CONTA CENT ---
   g_MonetaryMultiplier = 1.0;
   if(g_IsCentAccount) {
      g_MonetaryMultiplier = 100.0;
      Print("✅ Conta Cent (Forçada pelo Utilizador). Multiplicador = 100x");
   } else {
      string currency = AccountInfoString(ACCOUNT_CURRENCY);
      if(StringFind(currency, "USC") >= 0 || StringFind(currency, "USX") >= 0 ||
         StringFind(currency, "EUC") >= 0 || StringFind(currency, "GBX") >= 0) {
         g_MonetaryMultiplier = 100.0;
         Print("✅ Conta Cent Autodetectada (Moeda: ", currency, "). Multiplicador = 100x");
      }
   }

   // ✅ FIX #1: Inicializar o baseline diário imediatamente em OnInit()
   //    para garantir que DailyStartEquity nunca fica a 0.
   //    ANTES: o valor só era definido dentro de CheckDailyTarget() que
   //    estava comentada, deixando o circuit-breaker inoperacional.
   InitDailyBaseline();

   EventSetTimer(g_TimerSeconds);
   trade.SetTypeFillingBySymbol(_Symbol);
   trade.SetAsyncMode(false);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   if(g_Panel != NULL) { g_Panel.Destroy(); delete g_Panel; }
   EventKillTimer();
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
int CountXAUOrders() {
   int c=0;
   for(int i=PositionsTotal()-1; i>=0; i--) {
      ulong t=PositionGetTicket(i);
      if(t>0 && PositionSelectByTicket(t)) {
         if(IsXAU(PositionGetString(POSITION_SYMBOL)) && PositionGetInteger(POSITION_MAGIC)==GetAuraMagic()) c++;
      }
   }
   return c;
}

//+------------------------------------------------------------------+
//| XAU CONTINUOUS DISTANCE SCALPER                                  |
//+------------------------------------------------------------------+
void ContinuousTickScalperXAU()
{
   if(IsFridayFreeze()) return; // Bloqueia abertura à Sexta-feira
   if(CountXAUOrders() >= g_MaxOrders) return; // Limite global

   string sym = "XAUUSD";
   if(!SymbolSelect(sym, true)) sym = "XAUUSDm";
   if(!IsXAU(sym)) return;

   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   double bid = SymbolInfoDouble(sym, SYMBOL_BID);
   double point = SymbolInfoDouble(sym, SYMBOL_POINT);
   double midPrice = (ask + bid) / 2.0;

   // 1. INICIALIZAÇÃO DA ÂNCORA E EXTREMOS
   if(g_XAU_AnchorPrice == 0)
   {
      g_XAU_AnchorPrice = midPrice;
      g_XAU_PeakPrice = midPrice;
      g_XAU_ValleyPrice = midPrice;
      return; // Aguarda o próximo tick para medir distância
   }

   // 2. ATUALIZAÇÃO DOS EXTREMOS DA TENDÊNCIA ATUAL (Para Reversão)
   if(midPrice > g_XAU_PeakPrice) g_XAU_PeakPrice = midPrice;
   if(midPrice < g_XAU_ValleyPrice) g_XAU_ValleyPrice = midPrice;

   // 3. REGRA DE ABERTURA DE ORDENS (Por Distância da Âncora)
   // Se o preço subir a distância definida desde a âncora -> COMPRA
   if(midPrice >= g_XAU_AnchorPrice + (g_XAU_StepDistance * point))
   {
      double sLot = CalculateLot(sym, GetDynamicRisk(g_MaxSLOuro), g_MaxSLOuro * point, ORDER_TYPE_BUY); if(sLot <= 0) sLot = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
      trade.SetTypeFillingBySymbol(sym);
      bool ok = trade.Buy(sLot, sym, ask, 0, 0, "Aura XAU Distance Buy");
      if(ok)
      {
         Print("📈 [XAU] Abertura de COMPRA por Distância (Passo atingido). Preço: ", ask);
         g_XAU_AnchorPrice = midPrice; // Nova âncora
         g_XAU_PeakPrice = midPrice;   // Reset Peak
         g_XAU_ValleyPrice = midPrice; // Reset Valley
      }
   }
   // Se o preço cair a distância definida desde a âncora -> VENDE
   else if(midPrice <= g_XAU_AnchorPrice - (g_XAU_StepDistance * point))
   {
      double sLot = CalculateLot(sym, GetDynamicRisk(g_MaxSLOuro), g_MaxSLOuro * point, ORDER_TYPE_BUY); if(sLot <= 0) sLot = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
      trade.SetTypeFillingBySymbol(sym);
      bool ok = trade.Sell(sLot, sym, bid, 0, 0, "Aura XAU Distance Sell");
      if(ok)
      {
         Print("📉 [XAU] Abertura de VENDA por Distância (Passo atingido). Preço: ", bid);
         g_XAU_AnchorPrice = midPrice; // Nova âncora
         g_XAU_PeakPrice = midPrice;   // Reset Peak
         g_XAU_ValleyPrice = midPrice; // Reset Valley
      }
   }

   // 4. GESTÃO DE FECHO (Take Profit, Reversão e Hold Seconds)
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t <= 0 || !PositionSelectByTicket(t)) continue;
      if(PositionGetString(POSITION_SYMBOL) != sym) continue;
      if(PositionGetInteger(POSITION_MAGIC) != GetAuraMagic()) continue;

      long type = PositionGetInteger(POSITION_TYPE);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double profit = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP); // Commission handled separately if needed, simplified here
      
      bool closeIt = false;
      string closeReason = "";

      // REGRA 1: FECHO NO ALVO (Take Profit)
      if(type == POSITION_TYPE_BUY && bid >= openPrice + (g_XAU_TargetPoints * point))
      {
         closeIt = true; closeReason = "Alvo de Lucro Atingido (Take Profit)";
      }
      else if(type == POSITION_TYPE_SELL && ask <= openPrice - (g_XAU_TargetPoints * point))
      {
         closeIt = true; closeReason = "Alvo de Lucro Atingido (Take Profit)";
      }

      // REGRA 2: PROTEÇÃO NA REVERSÃO
      // Se estamos em lucro e o mercado reverteu X pontos do topo/fundo
      if(!closeIt && profit > 0)
      {
         if(type == POSITION_TYPE_BUY && bid <= g_XAU_PeakPrice - (g_XAU_ReversalPoints * point))
         {
            closeIt = true; closeReason = "Reversão de Mercado detetada (Proteção de Lucro)";
         }
         else if(type == POSITION_TYPE_SELL && ask >= g_XAU_ValleyPrice + (g_XAU_ReversalPoints * point))
         {
            closeIt = true; closeReason = "Reversão de Mercado detetada (Proteção de Lucro)";
         }
      }

      // REGRA 3: FECHO POR EXAUSTÃO DE TEMPO
      if(!closeIt && profit > 0 && g_XAU_HoldSeconds > 0)
      {
         long timeOpen = PositionGetInteger(POSITION_TIME);
         if(TimeCurrent() - timeOpen > g_XAU_HoldSeconds)
         {
            closeIt = true; closeReason = "Exaustão de Tempo (Hold Seconds)";
         }
      }

      // EXECUTA O FECHO
      if(closeIt)
      {
         trade.PositionClose(t, 50);
         Print("✅ [XAU] Ordem ", t, " Fechada. Motivo: ", closeReason, " | Lucro: $", DoubleToString(profit, 2));
      }
   }
}


void OnTick()
{
   if(!IsAuthorized) return;
   string sym = _Symbol;
   if(IsXAU(sym))
   {
      if(!IsTradingSession()) return;
      double spread = (SymbolInfoDouble(sym, SYMBOL_ASK) - SymbolInfoDouble(sym, SYMBOL_BID)) / _Point;
      if(spread > GetMaxAllowedSpread(sym)) return;
      if(IsVolatilityAbnormal(sym)) return;
   }
}

void OnTimer()
{
   // ✅ FIX #2: ReportBalance() e UpdateChartVisuals() movidos para DENTRO
   //    do semáforo ExecutionBusy para evitar race condition no estado
   //    DailyLossLock / DailyTargetReached durante o processamento.
   //    ANTES: corriam ANTES da verificação do semáforo, podendo ler/escrever
   //    estado partilhado em paralelo com RunInstitutionalCore().
   if(ExecutionBusy) return;
   ExecutionBusy = true;

   // Sincronismo Dashboard (agora dentro do semáforo — sem race condition)
   ReportBalance();
   UpdateChartVisuals();

   // Proteger Ordens Manuais (executa mesmo sem autorização de licença)
   ProtectManualOrders();

   RunInstitutionalCore();

   ExecutionBusy = false;
}

void RunInstitutionalCore()
{
   ValidateLicense();

   if(IsAuthorized)
   {
      CheckDailyLoss();
      CheckFridaySafeLock();
      ApplyBreakeven();

      ProcessPendingProtections();

      CheckSignals();
      ProcessSignalQueue();

      MonitorTrailingStop();
      ContinuousTickScalperXAU();
      MonitorPartialTP();
   }
}

double GetDailyPnL()
{
   double closedProfit = 0;
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
            long dealType = HistoryDealGetInteger(ticket, DEAL_TYPE);
            if(dealType == DEAL_TYPE_BUY || dealType == DEAL_TYPE_SELL)
            {
               long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
               if(magic == GetAuraMagic() || (g_ManageManualOrders && magic == 0))
               {
                  closedProfit += HistoryDealGetDouble(ticket, DEAL_PROFIT);
                  closedProfit += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
                  closedProfit += HistoryDealGetDouble(ticket, DEAL_SWAP);
               }
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
         if(magic == GetAuraMagic() || (g_ManageManualOrders && magic == 0))
            floatingProfit += PositionGetDouble(POSITION_PROFIT);
      }
   }
   return closedProfit + floatingProfit;
}

double GetRealizedDailyPnL()
{
   double closedProfit = 0;
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
            if(magic == GetAuraMagic() || (g_ManageManualOrders && magic == 0))
            {
               closedProfit += HistoryDealGetDouble(ticket, DEAL_PROFIT);
               closedProfit += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
               closedProfit += HistoryDealGetDouble(ticket, DEAL_SWAP);
            }
         }
      }
   }
   return closedProfit;
}

void CheckDailyTarget()
{
   MqlDateTime tm;
   TimeCurrent(tm);

   string gvTarget = "Aura_DT_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string gvEquity = "Aura_DE_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string gvDay    = "Aura_TD_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));

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
         DailyTargetProfit  = DailyStartEquity * (g_DailyTargetPct / 100.0);

         GlobalVariableSet(gvTarget, DailyTargetProfit);
         GlobalVariableSet(gvEquity, DailyStartEquity);
         GlobalVariableSet(gvDay, tm.day_of_year);

         Print("🌅 [DAILY] Novo dia detectado. Meta/Loss resetados | Balance: $",
               DoubleToString(DailyStartBalance, 2),
               " | Equity: $", DoubleToString(DailyStartEquity, 2),
               " | Meta: $", DoubleToString(DailyTargetProfit, 2));
      }
   }

   if(DailyTargetProfit <= 0 && DailyStartEquity <= 10)
   {
      if(GlobalVariableCheck(gvTarget) && GlobalVariableCheck(gvDay) &&
         GlobalVariableGet(gvDay) == tm.day_of_year)
      {
         DailyTargetProfit = GlobalVariableGet(gvTarget);
         DailyStartEquity  = GlobalVariableGet(gvEquity);
         DailyStartBalance = DailyStartEquity;
         LastTradingDay    = tm.day_of_year;
         Print("🔄 [RESTORE] Meta Diária recuperada: $", DoubleToString(DailyTargetProfit, 2));
      }
      else
      {
         double currentBal = AccountInfoDouble(ACCOUNT_BALANCE);
         double currentEq  = AccountInfoDouble(ACCOUNT_EQUITY);
         if(currentBal > 10 && currentEq > 10)
         {
            DailyStartBalance = currentBal;
            DailyStartEquity  = currentEq;
            DailyTargetProfit = DailyStartEquity * (g_DailyTargetPct / 100.0);

            GlobalVariableSet(gvTarget, DailyTargetProfit);
            GlobalVariableSet(gvEquity, DailyStartEquity);
            GlobalVariableSet(gvDay, tm.day_of_year);

            Print("🌅 [BOOT] Saldo inicial definido: $", DoubleToString(DailyStartBalance, 2));
         }
      }
   }

   if(DailyStartEquity <= 10) return;
   if(DailyTargetReached) return;

   double dailyPnL = GetDailyPnL();

   if(dailyPnL >= DailyTargetProfit && DailyTargetProfit > 0)
   {
      DailyTargetReached = true;
      Print("🏆 [DAILY] META ATINGIDA: $", DoubleToString(dailyPnL, 2));
      CloseAllPositions();
      DailyTargetLockActive = false;
      DailyPeakPnL = 0;
      return;
   }

   if(g_DailyTargetLockActive)
   {
      double activationThreshold = DailyTargetProfit * (g_DailyTargetLockPct / 100.0);
      double floorProfit         = DailyTargetProfit * (g_DailyTargetFloorPct / 100.0);

      if(!DailyTargetLockActive && dailyPnL >= activationThreshold && DailyTargetProfit > 0)
      {
         DailyTargetLockActive = true;
         DailyPeakPnL = dailyPnL;
         Print("🛡️ [DAILY LOCK] Ativado! Lucro: $", DoubleToString(dailyPnL, 2));
      }

      if(DailyTargetLockActive)
      {
         if(dailyPnL > DailyPeakPnL) DailyPeakPnL = dailyPnL;
         if(dailyPnL <= floorProfit)
         {
            DailyTargetReached = true;
            Print("🛑 [DAILY LOCK] Limite mínimo atingido. Fechando tudo.");
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

   // ✅ FIX #1 (complementar): Se DailyStartEquity ainda for 0 aqui
   //    (ex: bot reiniciado intra-dia sem ter passado pelo OnInit completo),
   //    inicializa agora antes de calcular qualquer percentagem de perda.
   //    ANTES: a função retornava silenciosamente com "return" e o
   //    circuit-breaker nunca actuava durante toda a sessão.
   if(DailyStartEquity <= 10)
   {
      InitDailyBaseline();
      return; // Aguarda próximo timer com baseline correcto
   }

   static datetime bootTime = 0;
   if(bootTime == 0) bootTime = TimeCurrent();
   if(TimeCurrent() - bootTime < 10) return;

   double dailyPnL = GetDailyPnL();
   double lossPct = (dailyPnL < 0) ? (MathAbs(dailyPnL) / DailyStartEquity) * 100.0 : 0.0;
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);

   if(lossPct >= g_MaxDailyLossPct)
   {
      DailyLossLock = true;
      Print("🛑 [CIRCUIT-BREAKER] LIMITE DE PERDA DIÁRIA ATINGIDO: ",
            DoubleToString(lossPct, 2), "% | Equity Inicial: ", DailyStartEquity,
            " | Equity Actual: ", equity);
      CloseAllPositions();
   }
}

//+------------------------------------------------------------------+
//| PROFIT LOCK — Desactivado (conflito com Trailing Stop)           |
//| O código está preservado mas NÃO É chamado em RunInstitutionalCore|
//+------------------------------------------------------------------+
void MonitorProfitLock()
{
   // NOTA: Esta função está intencionalmente desactivada.
   // Razão: conflito com MonitorTrailingStop() — quando o Trailing
   // já moveu o SL para zona de lucro, o ProfitLock tentava fechar
   // a posição prematuramente, cortando os Runners.
   // Para reactivar: descomentar a chamada em RunInstitutionalCore()
   // E garantir que a lógica slInProfit abaixo está activa.

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      long magic = PositionGetInteger(POSITION_MAGIC);
      string sym = PositionGetString(POSITION_SYMBOL);

      if(magic != GetAuraMagic() && (!g_ManageManualOrders || magic != 0)) continue;

      double profit    = PositionGetDouble(POSITION_PROFIT);
      double currentSL = PositionGetDouble(POSITION_SL);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      long   posType   = PositionGetInteger(POSITION_TYPE);

      if(profit <= 0) continue;

      bool slInProfit = false;
      if(posType == POSITION_TYPE_BUY  && currentSL > openPrice) slInProfit = true;
      if(posType == POSITION_TYPE_SELL && currentSL < openPrice && currentSL > 0) slInProfit = true;

      int idx = FindProfitLockIndex(ticket);
      if(idx < 0) idx = CreateProfitLockEntry(ticket);
      if(idx < 0) continue;

      if(!ProfitLocks[idx].active)
      {
         double minProfitActivation = g_ProfitLockMin * g_MonetaryMultiplier;
         if(profit >= minProfitActivation)
         {
            ProfitLocks[idx].active         = true;
            ProfitLocks[idx].peakProfit     = profit;
            ProfitLocks[idx].activationTime = TimeCurrent();
            Print("🔒 ProfitLock ACTIVADO | ", sym, " | Ticket: ", ticket,
                  " | Lucro: $", DoubleToString(profit, 2));
         }
         continue;
      }

      double peak = ProfitLocks[idx].peakProfit;
      double peakUpdateThreshold = (StringFind(sym, "XAU") >= 0) ? (peak * 0.05) : 0.5;

      if(profit > peak + peakUpdateThreshold)
         ProfitLocks[idx].peakProfit = profit;

      int lockDelay = (StringFind(sym, "XAU") >= 0) ? 120 : 30;
      if(TimeCurrent() - ProfitLocks[idx].activationTime < lockDelay) continue;

      double protectionStart = g_ProfitLockMin;
      if(peak < protectionStart) continue;

      double allowedDropMoney = peak * (g_ProfitLockDrop / 100.0);
      if(allowedDropMoney < 0.5) allowedDropMoney = 0.5;

      double currentDropMoney = ProfitLocks[idx].peakProfit - profit;

      if(currentDropMoney >= allowedDropMoney)
      {
         if(slInProfit) continue;

         Print("🛑 ProfitLock DISPARADO | ", sym, " | Ticket: ", ticket,
               " | Pico: $", DoubleToString(peak, 2),
               " | Actual: $", DoubleToString(profit, 2));

         if(trade.PositionClose(ticket))
         {
            Print("✅ Ordem fechada | ", sym, " | Lucro: $", DoubleToString(profit, 2));
            RemoveProfitLockEntry(idx);
         }
         else
            Print("⚠️ Falha ao fechar | ", sym, " | Erro: ", GetLastError());
      }
   }
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

   double extraProfit = g_BreakevenSecure * point;
   double priceOffset = totalCost / (volume * (tickVal / tickSize));

   double bePrice = openPrice;
   if(posType == POSITION_TYPE_BUY)
      bePrice = openPrice + priceOffset + extraProfit;
   else if(posType == POSITION_TYPE_SELL)
      bePrice = openPrice - priceOffset - extraProfit;

   return bePrice;
}

void ApplyBreakeven()
{
   if(!g_BreakevenEnabled) return;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      long magic = PositionGetInteger(POSITION_MAGIC);
      string sym = PositionGetString(POSITION_SYMBOL);

      if(magic != GetAuraMagic() && (!g_ManageManualOrders || magic != 0)) continue;

      double point     = SymbolInfoDouble(sym, SYMBOL_POINT);
      int    digits    = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      double ask       = SymbolInfoDouble(sym, SYMBOL_ASK);
      double bid       = SymbolInfoDouble(sym, SYMBOL_BID);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentSL = PositionGetDouble(POSITION_SL);
      double volume    = PositionGetDouble(POSITION_VOLUME);
      int    posType   = (int)PositionGetInteger(POSITION_TYPE);

      if(g_SpreadGuardianActive)
      {
         double spread = (ask - bid) / point;
         if(spread > g_MaxSpreadPips) continue;
      }

      double triggerDist = g_BreakevenTrigger * point;
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
                  Print("🛡️ [BE SECURE] Breakeven ativado | Buy ", ticket,
                        " | SL: ", DoubleToString(targetSL, digits));
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
                  Print("🛡️ [BE SECURE] Breakeven ativado | Sell ", ticket,
                        " | SL: ", DoubleToString(targetSL, digits));
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| SEXTA-FEIRA SEGURA                                               |
//+------------------------------------------------------------------+
bool IsFridayLocked()
{
   if(!g_FridaySafeLock) return false;
   MqlDateTime dt;
   TimeCurrent(dt);
   if(dt.day_of_week == 5)
   {
      if(dt.hour > g_FridayHour || (dt.hour == g_FridayHour && dt.min >= g_FridayMinute))
         return true;
   }
   return false;
}

bool IsFridayFreeze()
{
   if(!g_FridaySafeLock) return false;
   MqlDateTime dt;
   TimeCurrent(dt);
   if(dt.day_of_week == 5)
   {
      int freezeHour = g_FridayHour;
      int freezeMinute = g_FridayMinute - 30;
      if(freezeMinute < 0) {
         freezeHour--;
         freezeMinute += 60;
      }
      if(freezeHour < 0) freezeHour = 0; // Edge case
      
      if(dt.hour > freezeHour || (dt.hour == freezeHour && dt.min >= freezeMinute))
         return true;
   }
   return false;
}

void CheckFridaySafeLock()
{
   if(!IsFridayLocked()) return;
   int openCount = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         long magic = PositionGetInteger(POSITION_MAGIC);
         if(magic == GetAuraMagic() || (g_ManageManualOrders && magic == 0))
            openCount++;
      }
   }
   if(openCount > 0)
   {
      MqlDateTime dt; TimeCurrent(dt);
      Print("📅 [FRIDAY SAFE LOCK] ", dt.hour, ":", dt.min, " | Fechando todas as ordens...");
      CloseAllPositions();
   }
}

//+------------------------------------------------------------------+
//| GLOBAL PORTFOLIO PROFIT LOCK — Desactivado                       |
//+------------------------------------------------------------------+
void MonitorGlobalProfitLock()
{
   // NOTA: Desactivada — conflito com lógica de Scale-in.
   // Ver comentário em MonitorProfitLock() para detalhes.

   double currentNetProfit = 0;
   int openPositionsCount = 0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         long magic = PositionGetInteger(POSITION_MAGIC);
         if(magic == GetAuraMagic() || (g_ManageManualOrders && magic == 0))
         {
            currentNetProfit += PositionGetDouble(POSITION_PROFIT);
            openPositionsCount++;
         }
      }
   }

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

   if(!GlobalProfitLockState.active)
   {
      double minGlobalActivation = g_ProfitLockMin * g_MonetaryMultiplier;
      if(currentNetProfit >= minGlobalActivation)
      {
         GlobalProfitLockState.active         = true;
         GlobalProfitLockState.peakProfit     = currentNetProfit;
         GlobalProfitLockState.activationTime = TimeCurrent();
         Print("🛡️ [GLOBAL PROFITLOCK] Ativado! Lucro: $", DoubleToString(currentNetProfit, 2));
      }
   }
   else
   {
      if(currentNetProfit > GlobalProfitLockState.peakProfit)
         GlobalProfitLockState.peakProfit = currentNetProfit;

      if(TimeCurrent() - GlobalProfitLockState.activationTime < 30) return;

      double peak = GlobalProfitLockState.peakProfit;
      double allowedDropMoney = peak * (g_ProfitLockDrop / 100.0);
      if(allowedDropMoney < 0.5) allowedDropMoney = 0.5;

      double currentDropMoney = peak - currentNetProfit;
      if(currentDropMoney >= allowedDropMoney)
      {
         Print("🚨 [GLOBAL PROFITLOCK] Fechando TODAS as ordens...");
         CloseAllPositions();
         GlobalProfitLockState.active = false;
         GlobalProfitLockState.peakProfit = 0;
         GlobalProfitLockState.activationTime = 0;
      }
   }
}

//+------------------------------------------------------------------+
//| PROFIT LOCK — Funções auxiliares                                 |
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
//| FECHO PARCIAL INSTITUCIONAL                                      |
//+------------------------------------------------------------------+
void MonitorPartialTP()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0 || !PositionSelectByTicket(ticket)) continue;

      long magic = PositionGetInteger(POSITION_MAGIC);
      string sym = PositionGetString(POSITION_SYMBOL);

      if(magic != GetAuraMagic() && (!g_ManageManualOrders || magic != 0)) continue;

      double profit = PositionGetDouble(POSITION_PROFIT);
      double vol    = PositionGetDouble(POSITION_VOLUME);

      double partialTarget = (IsXAU(sym) ? 25.0 : 10.0) * g_MonetaryMultiplier;

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
         if(closeVol < 0.01) closeVol = vol;

         Print("💰 META PARCIAL ATINGIDA | ", sym, " | Ticket: ", ticket,
               " | Fechando 50% (", closeVol, ")");

         if(trade.PositionClosePartial(ticket, closeVol))
         {
            RegisterPartialClose(ticket);

            // ✅ FIX #4: Em vez de mover o SL directamente para openPrice
            //    (sobrescrevendo o cálculo de custos do ApplyBreakeven),
            //    chamamos GetBreakevenPrice() para obter o BE correcto
            //    com comissões e swap incluídos — igual ao ApplyBreakeven().
            //    ANTES: trade.PositionModify(ticket, openPrice, currentTP)
            //           → eliminava o buffer de custos calculado pelo ApplyBreakeven.
            //    DEPOIS: usamos o mesmo bePrice que o ApplyBreakeven usaria.
            if(PositionSelectByTicket(ticket)) // re-seleccionar após fecho parcial
            {
               double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
               double currentTP = PositionGetDouble(POSITION_TP);
               int    posType   = (int)PositionGetInteger(POSITION_TYPE);
               double volume    = PositionGetDouble(POSITION_VOLUME);
               int    digits    = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);

               double bePrice = GetBreakevenPrice(ticket, openPrice, posType, volume, sym);
               double beSL    = NormalizeDouble(bePrice, digits);

               trade.PositionModify(ticket, beSL, currentTP);
               Print("🛡️ BREAK EVEN (com custos) ACTIVADO | Ticket: ", ticket,
                     " | SL: ", DoubleToString(beSL, digits));
            }
         }
      }
   }
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
//| TRAILING STOP — Monitor principal                                |
//+------------------------------------------------------------------+
void MonitorTrailingStop()
{
   if(!g_TrailingEnabled) return;

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

      if(magic != GetAuraMagic() && (!g_ManageManualOrders || magic != 0)) continue;

      double point     = SymbolInfoDouble(sym, SYMBOL_POINT);
      int    digits    = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      double ask       = SymbolInfoDouble(sym, SYMBOL_ASK);
      double bid       = SymbolInfoDouble(sym, SYMBOL_BID);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);

      if(g_SpreadGuardianActive)
      {
         double spread = (ask - bid) / point;
         if(spread > g_MaxSpreadPips) continue;
      }

      double trailStartPts = g_TrailingStart_Forex;
      double trailStepPts  = g_TrailingStep_Forex;
      double trailDistPts  = g_TrailingDistance_Forex;
      
      if(IsXAU(sym)) {
      }
      else if(StringFind(sym, "JPY") >= 0) {
         trailStartPts = g_TrailingStart_JPY;
         trailStepPts  = g_TrailingStep_JPY;
         trailDistPts  = g_TrailingDistance_JPY;
      }
      
      double trailStart = trailStartPts * point;
      double trailStep  = trailStepPts  * point;
      double trailDist  = trailDistPts  * point;

      double stopLevel = SymbolInfoInteger(sym, SYMBOL_TRADE_STOPS_LEVEL) * point;
      if(trailDist < stopLevel * 1.1) trailDist = stopLevel * 1.1;

      // ✅ FIX #5 (limpeza): Removida a verificação de ProfitLock aqui.
      //    ANTES: o Trailing verificava FindProfitLockIndex() e pausava
      //    se o ProfitLock estava "iminente" — acoplamento implícito com
      //    código morto que causava confusão e comportamentos imprevisíveis.
      //    Como MonitorProfitLock() está desactivada, esta verificação
      //    nunca seria verdadeira mas tornava o código difícil de manter.
      //    Se o ProfitLock for reactivado no futuro, esta lógica deve ser
      //    restaurada explicitamente com um comentário claro.

      if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
      {
         if(bid - openPrice < trailStart) continue;
         double newSL = NormalizeDouble(bid - trailDist, digits);
         if(newSL > currentSL + trailStep)
         {
            if(SafePositionModify(ticket, newSL, currentTP))
               Print("📊 Trailing BUY | ", sym,
                     " | Ticket: ", ticket,
                     " | SL: ", DoubleToString(currentSL, digits),
                     " → ", DoubleToString(newSL, digits));
         }
      }
      else
      {
         if(openPrice - ask < trailStart) continue;
         double newSL = NormalizeDouble(ask + trailDist, digits);
         if((currentSL == 0 || newSL < currentSL - trailStep) && (newSL - ask > stopLevel))
         {
            if(SafePositionModify(ticket, newSL, currentTP))
               Print("📊 Trailing SELL | ", sym, " | Ticket: ", ticket,
                     " | SL: ", DoubleToString(newSL, digits));
         }
      }
   }
}

// --- CORE FUNCTIONS ---

void ValidateLicense()
{
   if(MQLInfoInteger(MQL_TESTER))
   {
      IsAuthorized = true;
      return;
   }

   static datetime lastValidate = 0;
   if(TimeCurrent() - lastValidate < 300 && IsAuthorized)  return;
   if(TimeCurrent() - lastValidate < 30  && !IsAuthorized) return;
   lastValidate = TimeCurrent();

   string url = g_ServerUrl + "/ea/validate";
   string payload = "{\"licenseKey\":\"" + g_LicenseKey +
                    "\",\"mtAccount\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\"}";
   string res = SendPost(url, payload);

   if(StringFind(res, "\"status\":\"success\"") >= 0 ||
      StringFind(res, "\"status\":\"OK\"") >= 0)
   {
      if(!IsAuthorized) Print("✅ LICENÇA VALIDADA COM SUCESSO!");
      IsAuthorized = true;
   }
   else
   {
      IsAuthorized = false;
      if(res == "") Print("❌ ERRO DE CONEXÃO: Servidor Offline ou URL Inválida.");
      else          Print("❌ FALHA NA LICENÇA: ", res);
   }
}

void CheckSignals()
{
   if(IsFridayFreeze()) return;

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

   if(TimeCurrent() - lastCheckTime < 5) return;
   lastCheckTime = TimeCurrent();

   string url = g_ServerUrl + "/ea/signals?licenseKey=" + g_LicenseKey;
   string result = SendGet(url);

   if(result == "") return;
   if(StringFind(result, "\"signals\":[]") >= 0) return;

   int openCount = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t > 0 && PositionSelectByTicket(t))
         if(PositionGetInteger(POSITION_MAGIC) == GetAuraMagic())
            openCount++;
   }

   if(openCount >= g_MaxOrders)
   {
      static datetime lastLimitMsg = 0;
      if(TimeCurrent() - lastLimitMsg > 60)
      {
         Print("⚠️ Limite de ordens atingido (", openCount, "/", g_MaxOrders,
               "). Ignorando novos sinais.");
         lastLimitMsg = TimeCurrent();
      }
      return;
   }

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
      if(IsProcessed(signalId) || GlobalVariableCheck("SQ_" + signalId)) continue;
      string signalJson = signal.Serialize();
      AddToSignalQueue(signalJson);
   }
}

void AddToSignalQueue(string json)
{
   int s = ArraySize(SignalQueue);
   ArrayResize(SignalQueue, s + 1);
   SignalQueue[s].json = json;
   SignalQueue[s].timestamp = TimeCurrent();

   string signalId = "";
   CJAVal j;
   if(j.Deserialize(json)) signalId = j["id"].ToStr();
   GlobalVariableSet("SQ_" + signalId, (double)TimeCurrent());
}

void ProcessSignalQueue()
{
   if(IsFridayFreeze()) return;
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
      Print("⏳ Sinal ", sigId, " manteve-se na fila para nova tentativa.");
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

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         if(PositionGetInteger(POSITION_MAGIC) == g_MagicNumber &&
            PositionGetDouble(POSITION_SL) == 0)
         {
            string slKey = "PSL_" + (string)ticket;
            string tpKey = "PTP_" + (string)ticket;
            if(GlobalVariableCheck(slKey))
            {
               double sl = GlobalVariableGet(slKey);
               double tp = GlobalVariableGet(tpKey);
               AddToPendingQueue(ticket, sl, tp, "RECOVERED");
               Print("✅ Protecção Recuperada para Ticket: ", ticket);
            }
         }
      }
   }

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
   if(StringFind(sym, "XAU") >= 0) return (int)MathMin(150, spread * 1.5);
   if(StringFind(sym, "JPY") >= 0) return (int)MathMin(50, spread * 1.3);
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
            return t;
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
   Print("📋 [DEBUG] JSON recebido: ", json);
   CJAVal jParser;
   if(!jParser.Deserialize(json)) return true;

   string sigId   = jParser["id"].ToStr();
   string pairRaw = jParser["pair"].ToStr();
   if(pairRaw == "") pairRaw = jParser["symbol"].ToStr();

   string pair = GetBrokerSymbol(pairRaw);

   string dir = jParser["direction"].ToStr();
   if(dir == "") dir = jParser["type"].ToStr();

   if(pair == "" || StringLen(pair) < 3)
   {
      Print("❌ [SIGNAL] Símbolo inválido (", pairRaw, "). Pulando sinal.");
      if(sigId != "") AddProcessed(sigId);
      return true;
   }

   string type  = jParser["order_type"].ToStr();
   if(type == "") type = "MARKET";
   double entry = jParser["entry"].ToDbl();
   double sl    = jParser["sl"].ToDbl();
   double tp    = jParser["tp"].ToDbl();

   if(IsXAU(pair) && !IsTradingSession())
   {
      Print("⏰ Fora de sessão institucional para ", pair, " | Entrada Rejeitada");
      return true;
   }

   if(!SymbolSelect(pair, true))
   {
      for(int s = 0; s < SymbolsTotal(false); s++)
      {
         string sym = SymbolName(s, false);
         string upperSym  = sym; StringToUpper(upperSym);
         string upperPair = pair; StringToUpper(upperPair);
         if(StringFind(upperSym, upperPair) >= 0 ||
            (IsXAU(pair) && (StringFind(upperSym, "XAU") >= 0 || StringFind(upperSym, "GOLD") >= 0)))
         {
            pair = sym;
            SymbolSelect(pair, true);
            break;
         }
      }
   }
   if(!SymbolSelect(pair, true))
   {
      Print("❌ Par não encontrado no Market Watch: " + pair);
      return false;
   }

   Sleep(500);
   if(!SymbolIsSynchronized(pair))
   {
      Print("⏳ Aguardando sincronismo de dados para ", pair, "...");
      for(int i = 0; i < 5; i++) {
         if(SymbolIsSynchronized(pair)) break;
         Sleep(200);
      }
   }

   if(CountAuraPositions() >= g_MaxOrders)
   {
      Print("🛑 Limite global de ordens atingido (", g_MaxOrders, "). Ignorando sinal ", sigId);
      return true;
   }

   int currentBuys = 0, currentSells = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t > 0 && PositionSelectByTicket(t))
      {
         if(PositionGetInteger(POSITION_MAGIC) == GetAuraMagic() &&
            PositionGetString(POSITION_SYMBOL) == pair)
         {
            if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)  currentBuys++;
            if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL) currentSells++;
         }
      }
   }

   if(dir == "BUY"  && currentBuys  >= g_MaxBuys)  { Print("⚠️ Limite de BUY atingido.");  return true; }
   if(dir == "SELL" && currentSells >= g_MaxSells) { Print("⚠️ Limite de SELL atingido."); return true; }

   if(!CanTradeSymbol(pair))
   {
      Print("⏳ Cooldown activo para ", pair);
      return false;
   }

   double point  = SymbolInfoDouble(pair, SYMBOL_POINT);
   int    digits = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   double ask    = SymbolInfoDouble(pair, SYMBOL_ASK);
   double bid    = SymbolInfoDouble(pair, SYMBOL_BID);

   if(ask <= 0 || bid <= 0)
   {
      Print("❌ [TICK-ERROR] Preços inválidos para ", pair,
            " (Ask: ", ask, ", Bid: ", bid, "). Rejeitando sinal.");
      return false;
   }

   double entryPrice = (dir == "BUY") ? ask : bid;
   if(entry <= 0) entry = entryPrice;

   if(IsXAU(pair)) {
      if(entry < 1000 || entry > 10000) entry = entryPrice;
   } else {
      if(entry < 0.01 || entry > 10) entry = entryPrice;
   }

   if(sl <= 0 || MathAbs(entry - sl) > (entry * 0.5) || MathAbs(entry - sl) < (10 * point))
      sl = (dir == "BUY") ? entry - (300 * point) : entry + (300 * point);

   if(tp <= 0 || MathAbs(entry - tp) > (entry * 0.5) || MathAbs(entry - tp) < (10 * point))
      tp = (dir == "BUY") ? entry + (500 * point) : entry - (500 * point);

   double slDist = (sl > 0) ? MathAbs(entry - sl) : 0;
   double tpDist = (tp > 0) ? MathAbs(entry - tp) : 0;

   if(slDist <= 0)
   {
      double structureSL = (dir == "BUY") ? GetLastLow(pair, PERIOD_M15, 10)
                                           : GetLastHigh(pair, PERIOD_M15, 10);
      if(structureSL > 0 && MathAbs(entry - structureSL) > (10 * point))
         slDist = MathAbs(entry - structureSL);
      else
      {
         double atr = GetATR(pair, IsXAU(pair) ? PERIOD_H1 : PERIOD_M15);
         slDist = (atr > 0) ? (atr * 1.5) : (300 * point);
      }
   }
   if(tpDist <= 0) tpDist = slDist * 1.5;

                               : ((StringFind(pair, "JPY") >= 0) ? g_MaxSLJPY : g_MaxSLForex);
   int slPoints  = (int)(slDist / point);
   if(slPoints > hardMaxSL) slPoints = hardMaxSL;

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
   double minDistance = MathMax(brokerMin + (20 * point),
                                IsXAU(pair) ? (150 * point) : (30 * point));

   if(dir == "BUY") {
      if(marketPrice - nSL < minDistance) nSL = NormalizeDouble(marketPrice - minDistance, digits);
      if(nTP > 0 && nTP - marketPrice < minDistance) nTP = NormalizeDouble(marketPrice + minDistance, digits);
   } else {
      if(nSL - marketPrice < minDistance) nSL = NormalizeDouble(marketPrice + minDistance, digits);
      if(nTP > 0 && marketPrice - nTP < minDistance) nTP = NormalizeDouble(marketPrice - minDistance, digits);
   }

   if(type == "MARKET") entry = marketPrice;

   if(dir == "BUY") {
      if(nTP > 0 && nTP <= entry) nTP = NormalizeDouble(entry + minDistance, digits);
      if(nSL >= entry) nSL = NormalizeDouble(entry - minDistance, digits);
   } else {
      if(nTP > 0 && nTP >= entry) nTP = NormalizeDouble(entry - minDistance, digits);
      if(nSL <= entry) nSL = NormalizeDouble(entry + minDistance, digits);
   }

   bool invalid = false;
   if(dir == "BUY"  && (entry <= 0 || (nTP > 0 && nTP <= entry))) invalid = true;
   if(dir == "SELL" && (entry <= 0 || (nTP > 0 && nTP >= entry))) invalid = true;
   if(invalid) return true;

   double risk = GetDynamicRisk((double)slPoints);
   double lot  = CalculateLot(pair, risk, MathAbs(entry - nSL),
                              (dir == "BUY") ? ORDER_TYPE_BUY : ORDER_TYPE_SELL);

   if(lot > 0)
   {
      trade.SetDeviationInPoints(GetDynamicDeviation(pair));
      trade.SetTypeFillingBySymbol(pair);

      if(!ValidateStops(pair, dir, entryPrice, nSL, nTP))
      {
         Print("❌ [EXECUTION-ABORT] Stops inválidos após normalização para ", pair);
         return true;
      }

      bool success = false;
      double minLot  = SymbolInfoDouble(pair, SYMBOL_VOLUME_MIN);
      double lotStep = SymbolInfoDouble(pair, SYMBOL_VOLUME_STEP);

      // ✅ FIX #3: Substituído Tester_UseTwinTrading por g_UseTwinTrading
      //    ANTES: if(Tester_UseTwinTrading && lot >= minLot * 2.0)
      //    DEPOIS: if(g_UseTwinTrading && lot >= minLot * 2.0)
      //    Isto garante que a configuração via GUI/ficheiro é respeitada.
      if(g_UseTwinTrading && lot >= minLot * 2.0)
      {
         double halfLot = NormalizeDouble(lot / 2.0, 2);
         if(halfLot < minLot) halfLot = minLot;
         halfLot = halfLot - MathMod(halfLot, lotStep);
         if(halfLot < minLot) halfLot = minLot;

         if(type == "LIMIT") {
            if(dir == "BUY") success = trade.BuyLimit(halfLot, entry, pair, nSL, nTP, ORDER_TIME_GTC, 0, "Aura [T1]");
            else             success = trade.SellLimit(halfLot, entry, pair, nSL, nTP, ORDER_TIME_GTC, 0, "Aura [T1]");
         } else {
            if(dir == "BUY") success = trade.Buy(halfLot, pair, entry, nSL, nTP, "Aura [T1]");
            else             success = trade.Sell(halfLot, pair, entry, nSL, nTP, "Aura [T1]");
         }

         if(type == "LIMIT") {
            if(dir == "BUY") trade.BuyLimit(halfLot, entry, pair, nSL, 0, ORDER_TIME_GTC, 0, "Aura [RUNNER]");
            else             trade.SellLimit(halfLot, entry, pair, nSL, 0, ORDER_TIME_GTC, 0, "Aura [RUNNER]");
         } else {
            if(dir == "BUY") trade.Buy(halfLot, pair, entry, nSL, 0, "Aura [RUNNER]");
            else             trade.Sell(halfLot, pair, entry, nSL, 0, "Aura [RUNNER]");
         }
      }
      else
      {
         if(type == "LIMIT") {
            if(dir == "BUY") success = trade.BuyLimit(lot, entry, pair, nSL, nTP);
            else             success = trade.SellLimit(lot, entry, pair, nSL, nTP);
         } else {
            if(dir == "BUY") success = trade.Buy(lot, pair, entry, nSL, nTP);
            else             success = trade.Sell(lot, pair, entry, nSL, nTP);
         }
      }

      if(success)
      {
         Print("✅ Ordem executada com sucesso!");
         SetSymbolCooldown(pair);
         if(sigId != "")
         {
            Sleep(500);
            ulong ticket = FindPositionBySymbol(pair);
            if(ticket > 0) AddToPendingQueue(ticket, nSL, nTP, sigId);
            else Print("⚠️ [WARNING] Posição aberta mas não encontrada para protecção imediata.");
            AddProcessed(sigId);
         }
         return true;
      }
      else
      {
         Print("❌ Erro ao executar ", type, " | ", trade.ResultRetcodeDescription());
         return false;
      }
   }
   return false;
}

void AddToPendingQueue(ulong ticket, double sl, double tp, string signalId)
{
   int s = ArraySize(PendingQueue);
   ArrayResize(PendingQueue, s + 1);
   PendingQueue[s].ticket    = ticket;
   PendingQueue[s].sl        = sl;
   PendingQueue[s].tp        = tp;
   PendingQueue[s].signalId  = signalId;
   PendingQueue[s].timestamp = TimeCurrent();
   GlobalVariableSet("PSL_" + (string)ticket, sl);
   GlobalVariableSet("PTP_" + (string)ticket, tp);
}

void ProcessPendingProtections()
{
   for(int i = ArraySize(PendingQueue) - 1; i >= 0; i--)
   {
      if(TimeCurrent() - PendingQueue[i].timestamp > 60) {
         RemovePendingQueueIndex(i);
         continue;
      }
      ulong ticket = PendingQueue[i].ticket;
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         double sl = PositionGetDouble(POSITION_SL);
         if(sl <= 0 || sl == EMPTY_VALUE)
            ApplyAsyncProtection(ticket, PendingQueue[i]);
         else
         {
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
   int    digits    = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   double point     = SymbolInfoDouble(pair, SYMBOL_POINT);
   double stopLevel = SymbolInfoInteger(pair, SYMBOL_TRADE_STOPS_LEVEL) * point;

   ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
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
      SendPost(g_ServerUrl + "/ea/report",
               "{\"signalId\":\"" + data.signalId + "\",\"status\":\"EXECUTED\"}");
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

SymbolSpecs GetInstitutionalSpecs(string sym)
{
   SymbolSpecs s;
   s.digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   s.point  = SymbolInfoDouble(sym, SYMBOL_POINT);
   if(IsXAU(sym)) {
      s.pip = 0.1; s.minStopPips = 50; s.maxStopPips = 500;
   } else if(StringFind(sym, "JPY") >= 0) {
      s.pip = 0.01; s.minStopPips = 10; s.maxStopPips = 100;
   } else {
      s.pip = 0.0001; s.minStopPips = 10; s.maxStopPips = 100;
   }
   return s;
}

double CalculateInstitutionalSL(double entry, double atr, ENUM_POSITION_TYPE type, string sym)
{
   SymbolSpecs specs = GetInstitutionalSpecs(sym);
   double atrPips = atr / specs.pip;
   atrPips = MathMax(specs.minStopPips, atrPips);
   atrPips = MathMin(specs.maxStopPips, atrPips);
   double stopDist = atrPips * specs.pip;
   double sl = (type == POSITION_TYPE_BUY) ? (entry - stopDist) : (entry + stopDist);
   return NormalizeDouble(sl, specs.digits);
}

void ProtectManualOrders()
{
   if(!g_ManageManualOrders) return;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0 || !PositionSelectByTicket(ticket)) continue;
      if(PositionGetInteger(POSITION_MAGIC) != 0) continue;

      string sym      = PositionGetString(POSITION_SYMBOL);
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

      if(sl != currentSL || tp != currentTP)
      {
         if(SafePositionModify(ticket, sl, tp))
            Print("✅ Manual Protected: ", ticket, " | SL: ", sl, " | TP: ", tp);
      }
   }
}

void ReportBalance()
{
   int interval = (PositionsTotal() > 0) ? 5 : 60;
   static datetime lastReport = 0;
   if(TimeLocal() - lastReport < interval) return;
   lastReport = TimeLocal();

   double mult = g_IsCentAccount ? 0.01 : 1.0;

   double rawBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   double rawEquity  = AccountInfoDouble(ACCOUNT_EQUITY);

   double balance    = rawBalance * mult;
   double equity     = rawEquity  * mult;
   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE) * mult;
   double margin     = AccountInfoDouble(ACCOUNT_MARGIN) * mult;
   double floatingPnL = CalculateAuraFloatingPnL() * mult;

   double marginLevel = 0;
   if(margin > 0) marginLevel = (equity / margin) * 100.0;

   double drawdown = 0;
   if(balance > 0) drawdown = ((balance - equity) / balance) * 100.0;

   double dailyPnl    = (DailyStartEquity > 0) ? ((rawEquity - DailyStartEquity) * mult) : 0;
   double realizedPnl = GetRealizedDailyPnL() * mult;

   string openTradesJson = "[";
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         long magic = PositionGetInteger(POSITION_MAGIC);
         if(magic == GetAuraMagic() || (g_ManageManualOrders && magic == 0))
         {
            string sym    = PositionGetString(POSITION_SYMBOL);
            long   postype = PositionGetInteger(POSITION_TYPE);
            string dir    = (postype == POSITION_TYPE_BUY) ? "BUY" : "SELL";
            double profit  = PositionGetDouble(POSITION_PROFIT) * mult;
            double lot     = PositionGetDouble(POSITION_VOLUME);
            double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            if(count > 0) openTradesJson += ",";
            openTradesJson += "{\"id\":\"" + IntegerToString(ticket) +
                              "\",\"pair\":\"" + sym +
                              "\",\"direction\":\"" + dir +
                              "\",\"profit\":" + DoubleToString(profit, 2) +
                              ",\"lotSize\":" + DoubleToString(lot, 2) +
                              ",\"openPrice\":" + DoubleToString(openPrice, 5) + "}";
            count++;
         }
      }
   }
   openTradesJson += "]";

   HistorySelect(0, TimeCurrent());
   string closedTradesJson = "[";
   int closedCount = 0;
   int totalHistory = HistoryDealsTotal();
   for(int i = totalHistory - 1; i >= MathMax(0, totalHistory - 30); i--)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket > 0)
      {
         if(HistoryDealGetInteger(dealTicket, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;
         long magic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
         if(magic == GetAuraMagic() || (g_ManageManualOrders && magic == 0))
         {
            string sym    = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
            long   dealType = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
            string dir    = (dealType == DEAL_TYPE_BUY) ? "BUY" : "SELL";
            double dealProfit    = HistoryDealGetDouble(dealTicket, DEAL_PROFIT) * mult;
            double dealLot       = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
            double dealClosePrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
            long   closeTime     = HistoryDealGetInteger(dealTicket, DEAL_TIME);
            if(closedCount > 0) closedTradesJson += ",";
            closedTradesJson += "{\"id\":\"" + IntegerToString(dealTicket) +
                                "\",\"pair\":\"" + sym +
                                "\",\"direction\":\"" + dir +
                                "\",\"profit\":" + DoubleToString(dealProfit, 2) +
                                ",\"lotSize\":" + DoubleToString(dealLot, 2) +
                                ",\"closePrice\":" + DoubleToString(dealClosePrice, 5) +
                                ",\"closeTime\":" + IntegerToString((int)closeTime) + "}";
            closedCount++;
         }
      }
   }
   closedTradesJson += "]";

   string payload = "{"
      "\"licenseKey\":\""    + g_LicenseKey + "\","
      "\"balance\":"         + DoubleToString(balance, 2)     + ","
      "\"equity\":"          + DoubleToString(equity, 2)      + ","
      "\"freeMargin\":"      + DoubleToString(freeMargin, 2)  + ","
      "\"floatingPnL\":"     + DoubleToString(floatingPnL, 2) + ","
      "\"marginLevel\":"     + DoubleToString(marginLevel, 2) + ","
      "\"drawdown\":"        + DoubleToString(drawdown, 2)    + ","
      "\"dailyPnl\":"        + DoubleToString(dailyPnl, 2)    + ","
      "\"realizedPnl\":"     + DoubleToString(realizedPnl, 2) + ","
      "\"dailyLossLimit\":"  + DoubleToString(g_MaxDailyLossPct, 2) + ","
      "\"isLocked\":"        + (DailyLossLock ? "true" : "false") + ","
      "\"isLossLocked\":"    + (DailyLossLock ? "true" : "false") + ","
      "\"openTrades\":"      + openTradesJson  + ","
      "\"closedTrades\":"    + closedTradesJson +
   "}";

   string url = g_ServerUrl + "/ea/report-balance";
   string response = SendPost(url, payload);

   if(response == "") {
      Print("❌ [SYNC] Falha ao reportar saldo para o Dashboard.");
      return;
   }

   CJAVal root;
   if(root.Deserialize(response))
   {
      bool isProfitLocked       = root["isProfitLocked"].ToBool();
      bool isLossLocked         = root["isLossLocked"].ToBool();
      double serverStartBalance = root["dailyStartBalance"].ToDbl();

      if(serverStartBalance > 10)
      {
         DailyStartBalance = serverStartBalance;
         if(DailyStartEquity <= 0) DailyStartEquity = serverStartBalance;
      }

      if(isProfitLocked && !DailyTargetReached)
      {
         DailyTargetReached = true;
         Print("🏆 [SERVER-SYNC] Meta Diária Atingida no Servidor! Fechando posições...");
         CloseAllPositions();
      }
      else if(!isProfitLocked && DailyTargetReached)
      {
         DailyTargetReached = false;
         Print("🌅 [SERVER-SYNC] Reset de Meta Diária detectado. Desbloqueando...");
      }

      if(isLossLocked && !DailyLossLock)
      {
         DailyLossLock = true;
         Print("🛑 [SERVER-SYNC] Limite de Perda Diária no Servidor! Fechando posições...");
         CloseAllPositions();
      }
      else if(!isLossLocked && DailyLossLock)
      {
         DailyLossLock = false;
         Print("🌅 [SERVER-SYNC] Reset de Perda Diária detectado. Desbloqueando...");
      }
   }

   UpdateChartVisuals();
}

double CalculateAuraFloatingPnL()
{
   double total = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
         if(PositionGetInteger(POSITION_MAGIC) == GetAuraMagic())
            total += PositionGetDouble(POSITION_PROFIT);
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
      "============================\n"
      "      AURAFOREX V8.1\n"
      "============================\n"
      "ACCOUNT : " + IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN)) + "\n"
      "BALANCE : $" + DoubleToString(balance, 2)      + "\n"
      "EQUITY  : $" + DoubleToString(equity, 2)       + "\n"
      "FLOATING: $" + DoubleToString(floating, 2)     + "\n"
      "MARGIN% : " + DoubleToString(marginLevel, 1)  + "%\n"
      "ORDERS  : " + IntegerToString(totalPositions)  + "\n"
      "STATUS  : " + status                           + "\n"
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
   if(code == -1) {
      Print("❌ WebRequest ERROR: ", GetLastError(), " | URL: ", url);
      return "";
   }
   return CharArrayToString(res);
}

string SendGet(string url)
{
   uchar res[], data[];
   string rh;
   string headers = "";
   ResetLastError();
   int code = WebRequest("GET", url, headers, 10000, data, res, rh);
   if(code == -1) {
      Print("❌ WebRequest (GET) ERROR: ", GetLastError(), " | URL: ", url);
      return "";
   }
   return CharArrayToString(res);
}

int GetConsecutiveLosses()
{
   int losses = 0;
   int total  = HistoryDealsTotal();
   for(int i = total - 1; i >= MathMax(0, total - 10); i--)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;
      if(HistoryDealGetInteger(dealTicket, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;
      long dealMagic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
      if(dealMagic != g_MagicNumber) continue;
      double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
      if(profit < 0) losses++;
      else           break;
      if(losses >= 3) break;
   }
   return losses;
}

double GetDynamicRisk(double pts)
{
   double risk = g_RiskPercent;
   int losses = GetConsecutiveLosses();
   if(losses >= 3)
   {
      risk *= 0.5;
      static datetime lastWarn = 0;
      if(TimeCurrent() - lastWarn > 3600) {
         Print("⚠️ [RISK] ", losses, " perdas consecutivas | Risco reduzido para ",
               DoubleToString(risk, 2), "%");
         lastWarn = TimeCurrent();
      }
   }
   return risk;
}

double CalculateLot(string sym, double riskPercent, double slDist, ENUM_ORDER_TYPE type)
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskVal = balance * (riskPercent / 100.0);
   double tVal    = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
   double tSize   = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
   if(slDist <= 0 || tSize <= 0 || tVal <= 0) return 0;

   double lot  = riskVal / ((slDist / tSize) * tVal);
   double minL = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   lot = NormalizeDouble(MathMax(minL, MathFloor(lot / step) * step), 2);

   double margin = 0;
   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   double bid = SymbolInfoDouble(sym, SYMBOL_BID);
   double p   = (type == ORDER_TYPE_BUY) ? ask : bid;

   if(OrderCalcMargin(type, sym, lot, p, margin))
   {
      double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
      if(margin > freeMargin * 0.80)
      {
         double minMargin = 0;
         if(OrderCalcMargin(type, sym, minL, p, minMargin))
         {
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

double GetLastLow(string sym, ENUM_TIMEFRAMES tf, int bars)
{
   double lows[]; ArraySetAsSeries(lows, true);
   if(CopyLow(sym, tf, 1, bars, lows) > 0) {
      double m = lows[0];
      for(int i = 1; i < ArraySize(lows); i++)
         if(lows[i] < m) m = lows[i];
      return m;
   }
   return 0;
}

double GetLastHigh(string sym, ENUM_TIMEFRAMES tf, int bars)
{
   double highs[]; ArraySetAsSeries(highs, true);
   if(CopyHigh(sym, tf, 1, bars, highs) > 0) {
      double m = highs[0];
      for(int i = 1; i < ArraySize(highs); i++)
         if(highs[i] > m) m = highs[i];
      return m;
   }
   return 0;
}

bool IsProcessed(string id)
{
   string key = "A_" + id;
   return GlobalVariableCheck(key);
}

void AddProcessed(string id)
{
   string key = "A_" + id;
   GlobalVariableSet(key, (double)TimeCurrent());
}

string GetBrokerSymbol(string baseSym)
{
   if(baseSym == "") return "";

   if(SymbolInfoInteger(baseSym, SYMBOL_VISIBLE))
   {
      ENUM_SYMBOL_TRADE_MODE mode = (ENUM_SYMBOL_TRADE_MODE)SymbolInfoInteger(baseSym, SYMBOL_TRADE_MODE);
      if(mode == SYMBOL_TRADE_MODE_FULL ||
         mode == SYMBOL_TRADE_MODE_LONGONLY ||
         mode == SYMBOL_TRADE_MODE_SHORTONLY)
         return baseSym;
   }

   int total = SymbolsTotal(false);
   for(int i = 0; i < total; i++)
   {
      string sym = SymbolName(i, false);
      if(StringFind(sym, baseSym) == 0)
      {
         ENUM_SYMBOL_TRADE_MODE mode = (ENUM_SYMBOL_TRADE_MODE)SymbolInfoInteger(sym, SYMBOL_TRADE_MODE);
         if(mode == SYMBOL_TRADE_MODE_FULL ||
            mode == SYMBOL_TRADE_MODE_LONGONLY ||
            mode == SYMBOL_TRADE_MODE_SHORTONLY)
         {
            SymbolSelect(sym, true);
            return sym;
         }
      }
   }

   total = SymbolsTotal(true);
   for(int i = 0; i < total; i++)
   {
      string sym = SymbolName(i, true);
      if(StringFind(sym, baseSym) == 0)
      {
         ENUM_SYMBOL_TRADE_MODE mode = (ENUM_SYMBOL_TRADE_MODE)SymbolInfoInteger(sym, SYMBOL_TRADE_MODE);
         if(mode == SYMBOL_TRADE_MODE_FULL ||
            mode == SYMBOL_TRADE_MODE_LONGONLY ||
            mode == SYMBOL_TRADE_MODE_SHORTONLY)
         {
            SymbolSelect(sym, true);
            return sym;
         }
      }
   }
   return baseSym;
}

double GetATR(string sym, ENUM_TIMEFRAMES tf)
{
   if(sym == "" || StringLen(sym) < 3) {
      Print("❌ [ATR] Símbolo inválido.");
      return 0;
   }
   if(!SymbolSelect(sym, true)) {
      Print("❌ [ATR] Falha ao seleccionar símbolo: ", sym);
      return 0;
   }

   datetime currentBar = iTime(sym, tf, 0);
   if(currentBar <= 0) {
      Print("❌ [ATR] Sem barras disponíveis para ", sym);
      return 0;
   }

   int size = ArraySize(g_atrCache);
   for(int i = 0; i < size; i++)
   {
      if(g_atrCache[i].symbol == sym && g_atrCache[i].tf == tf)
      {
         if(g_atrCache[i].lastBar == currentBar && g_atrCache[i].value > 0)
            return g_atrCache[i].value;

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

   int handle = iATR(sym, tf, 14);
   if(handle == INVALID_HANDLE) {
      Print("❌ [ATR-ERROR] Handle inválido para ", sym,
            " | TF=", EnumToString(tf), " | Erro=", GetLastError());
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
      g_atrCache[size].value = atrBuf2[0];

   return g_atrCache[size].value;
}

void CloseAllPositions()
{
   Print("🚨 [ACTION] Fechando TODAS as posições...");
   for(int retry = 0; retry < 3; retry++)
   {
      bool stillOpen = false;
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket <= 0) continue;
         if(!PositionSelectByTicket(ticket)) continue;
         long magic = PositionGetInteger(POSITION_MAGIC);
         if(magic != GetAuraMagic() && (!g_ManageManualOrders || magic != 0)) continue;
         ResetLastError();
         bool closed = trade.PositionClose(ticket);
         if(!closed) {
            Print("❌ Failed close: ", ticket, " | ", trade.ResultRetcodeDescription());
            stillOpen = true;
         } else
            Print("✅ Closed: ", ticket);
         Sleep(200);
      }
      if(!stillOpen) break;
      Print("🔄 Tentativa ", retry + 2, " de fecho total...");
      Sleep(1000);
   }
}

//+------------------------------------------------------------------+
//| ChartEvent function                                              |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(g_Panel != NULL) g_Panel.OnEvent(id, lparam, dparam, sparam);
}
