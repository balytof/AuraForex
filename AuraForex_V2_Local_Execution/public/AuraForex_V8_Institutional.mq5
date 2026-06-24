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


//--- INPUT PARAMETERS ---
input string Tester_LicenseKey        = "COLE_SUA_LICENCA_AQUI"; // Chave de Licença (Dashboard)
input string Tester_ServerUrl         = "https://www.auratradebots.com/api"; // URL do seu VPS (Com /api)
input bool Tester_IsCentAccount     = false;                   // A Conta é Cent? (Auto-adaptável)
input double Tester_RiskPercent       = 1.0;                     // % de Risco por Trade
input int Tester_MagicNumber       = 888222;                  // Magic Number das Ordens
input int Tester_TimerSeconds      = 2;                       // Intervalo de Checagem (Segundos) – Recomendado: 2 ou 3
input int Tester_MaxSLForex        = 1500;                    // Limite SL Forex (Pontos)
input int Tester_MaxSLJPY          = 3000;                    // Limite SL JPY (Pontos)
input int Tester_MaxSLOuro         = 1500;                    // Limite SL Ouro (Pontos)
input int Tester_MaxOrders         = 6;                       // Limite Global de Ordens
input int Tester_MaxBuys           = 6;                       // Máximo de Compras Simultâneas
input int Tester_MaxSells          = 6;                       // Máximo de Vendas Simultâneas
input int Tester_TradeCooldown     = 300;                      // Cooldown entre ordens do mesmo par (seg)

// --- XAU DISTANCE SCALPER --- 
input bool Tester_XAU_Enabled          = true; // Ativar Bot Autónomo do Ouro (XAU Scalper)
input int Tester_XAU_StepDistance      = 200; // XAU: Distância para Abrir Nova Ordem (Pts)
input int Tester_XAU_TargetPoints      = 3000; // XAU: Alvo Fixo de Lucro (Pts)
input int Tester_XAU_ReversalPoints    = 150; // XAU: Reversão para Fechar Lucros (Pts)
input bool Tester_XAU_TrendFilter      = true; // XAU: Filtro de Tendencia EMA
input int Tester_XAU_EmaPeriod         = 50;  // XAU: Periodo EMA
input int Tester_XAU_EmaTimeframe      = 15;  // XAU: Timeframe EMA (1,5,15,60)

// --- FOREX DISTANCE SCALPER --- 
input int Tester_Forex_StepDistance      = 150; // FOREX: Distância para Abrir Nova Ordem (Pts)
input int Tester_Forex_TargetPoints      = 1500; // FOREX: Alvo Fixo de Lucro (Pts)
input int Tester_Forex_ReversalPoints    = 100; // FOREX: Reversão para Fechar Lucros (Pts)
input bool Tester_Forex_TrendFilter      = true; // FOREX: Filtro de Tendencia EMA
input int Tester_Forex_EmaPeriod         = 50;  // FOREX: Periodo EMA
input int Tester_Forex_EmaTimeframe      = 15;  // FOREX: Timeframe EMA (1,5,15,60)

// --- JPY DISTANCE SCALPER --- 
input int Tester_JPY_StepDistance      = 200; // JPY: Distância para Abrir Nova Ordem (Pts)
input int Tester_JPY_TargetPoints      = 2000; // JPY: Alvo Fixo de Lucro (Pts)
input int Tester_JPY_ReversalPoints    = 150; // JPY: Reversão para Fechar Lucros (Pts)
input bool Tester_JPY_TrendFilter      = true; // JPY: Filtro de Tendencia EMA
input int Tester_JPY_EmaPeriod         = 50;  // JPY: Periodo EMA
input int Tester_JPY_EmaTimeframe      = 15;  // JPY: Timeframe EMA (1,5,15,60)

// --- PROFIT LOCK PARAMETERS ---
input double Tester_ProfitLockMin     = 10.0;   // Lucro mínimo para activar ProfitLock ($)
input double Tester_ProfitLockDrop    = 30.0;  // % de queda do pico para fechar ordem

// --- TRAILING STOP PARAMETERS ---
input bool Tester_TrailingEnabled      = true;      // Trailing Stop Activo
input int Tester_TrailingStart_XAU     = 100;       // Trailing Start Ouro
input int Tester_TrailingDistance_XAU  = 150;       // Trailing Distance Ouro
input int Tester_TrailingStep_XAU      = 20;        // Trailing Step Ouro
input int Tester_TrailingStart_JPY     = 150;       // Trailing Start JPY
input int Tester_TrailingDistance_JPY  = 200;       // Trailing Distance JPY
input int Tester_TrailingStep_JPY      = 30;        // Trailing Step JPY
input int Tester_TrailingStart_Forex   = 100;       // Trailing Start Forex
input int Tester_TrailingDistance_Forex= 150;       // Trailing Distance Forex
input int Tester_TrailingStep_Forex    = 20;        // Trailing Step Forex

// --- TWIN TRADING (RUNNER) ---
// ✅ FIX #3: Renomeado de Tester_UseTwinTrading para g_UseTwinTrading
//    para seguir o padrão das restantes variáveis globais e ser
//    correctamente sobrescrito pela GUI / ficheiro de configuração.
//    ANTES: bool Tester_UseTwinTrading = true;
//    DEPOIS: declarado directamente como global g_UseTwinTrading (ver secção globals)

input bool Tester_ManageManualOrders = true;     // Gerir Ordens Manuais (Magic 0)
input double Tester_DailyTargetPct     = 5.0;      // Meta Diária de Lucro (%)
input double Tester_MaxDailyLossPct    = 10.0;     // Perda Máxima Diária (%)

// --- TRAVA DE META DIÁRIA (DAILY TARGET PROFIT LOCK) ---
input bool Tester_DailyTargetLockActive = true;  // Ativar Trava de Meta Diária
input double Tester_DailyTargetLockPct   = 80.0;  // Ativar Trava ao atingir % da Meta (ex: 80%)
input double Tester_DailyTargetFloorPct  = 50.0;  // Lucro Mínimo Garantido ao reverter % (ex: 50%)

// --- BE INTELIGENTE + CUSTOS (BREAKEVEN PLUS COSTS) ---
input bool Tester_BreakevenEnabled     = true;   // Ativar Breakeven Inteligente
input int Tester_BreakevenTrigger     = 40;     // Gatilho do Breakeven (4.0 pips de lucro)
input int Tester_BreakevenSecure      = 10;     // Pips Extras a Garantir (BE + 1.0 pip)

// --- SEXTA-FEIRA SEGURA (FRIDAY SAFE LOCK) ---
input bool Tester_FridaySafeLock       = false;   // DESATIVADO PARA TESTES
input int Tester_FridayHour           = 20;     // Hora de fecho na Sexta-feira (GMT/Broker)
input int Tester_FridayMinute         = 0;      // Minuto de fecho na Sexta-feira

// --- FILTRO DE SPREAD (SPREAD SPIKE GUARDIAN) ---
input bool Tester_SpreadGuardianActive = true;   // Ativar Spread Spike Guardian
input double Tester_MaxSpreadPips        = 5.0;    // Spread Máximo Permitido para Modificações (Pips)
input bool Tester_SessionFilter      = false;    // Filtrar Horário (Apenas Londres/NY)

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
string            g_LicenseKey = "";
string            g_ServerUrl = "";
bool              g_IsCentAccount = false;
double            g_RiskPercent = 1.0;
int               g_MagicNumber = 888222;
bool              g_TrailingEnabled = false;
string            g_RunnerMode = "none";
string            g_ExitMode = "take_profit";
int               g_HoldSeconds = 180;
int               g_NegativeHoldSeconds = 120;
double            g_EquityActivationPct = 3.0;
double            g_EquityDropPct = 0.5;
bool              g_EquityProtectionActive = false;
double            g_GlobalEquityPeak = 0;
string            g_EmaMode = "auto";
string            g_DynamicEmaLog = "";
int               g_TrailingStart_JPY = 0;
int               g_TrailingDistance_JPY = 0;
int               g_TrailingStep_JPY = 0;
int               g_TrailingStart_Forex = 0;
int               g_TrailingDistance_Forex = 0;
int               g_TrailingStep_Forex = 0;
double            g_ProfitLockMin = 0;
double            g_ProfitLockDrop = 0;
bool              g_UseLossProtector = false;
double            g_LossProtectorPct = 0;
bool              g_UseGlobalEquity = true;
bool              g_UseProfitLock = true;
string            g_ProfitLockType = "usd";
int               g_MaxSLForex = 0;
int               g_MaxSLJPY = 0;
int               g_MaxSLOuro = 0;
int               g_TrailingStart_XAU = 0;
int               g_TrailingDistance_XAU = 0;
int               g_TrailingStep_XAU = 0;
int               g_MaxOrders = 0;
int               g_XAU_StepDistance = 0;
int               g_XAU_TargetPoints = 0;
int               g_XAU_ReversalPoints = 0;
bool              g_XAU_TrendFilter = false;
int               g_XAU_EmaPeriod = 0;
int               g_XAU_EmaTimeframe = 0;
int               g_MaxBuys = 0;
int               g_MaxSells = 0;
int               g_TradeCooldown = 0;
bool              g_DailyTargetFeatureEnabled = false;
double            g_DailyTargetPct = 0;
double            g_DailyTargetLockPct = 0;
double            g_DailyTargetFloorPct = 0;
double            g_MaxDailyLossPct = 0;
bool              g_BreakevenEnabled = false;
int               g_BreakevenTrigger = 0;
int               g_BreakevenSecure = 0;
bool              g_FridaySafeLock = false;
int               g_FridayHour = 0;
int               g_FridayMinute = 0;
bool              g_SpreadGuardianActive = false;
double            g_MaxSpreadPips = 0;
bool              g_SessionFilter = false;
bool              g_ManageManualOrders = false;
int               g_TimerSeconds = 2;

double            g_MonetaryMultiplier = 1.0;
CTrade            trade;
bool              g_IsAuthorized = false;
datetime          g_lastCheckTime = 0;
double            g_DailyStartBalance  = 0;
double            g_DailyStartEquity   = 0;
bool              g_DailyTargetReached = false;
bool              g_DailyLossLock         = false;
bool              g_DailyTargetLockTriggered = false;
double            g_DailyPeakPnL          = 0;
double            g_DailyTargetProfit     = 0;
int               g_LastTradingDay        = -1;
int               g_ConsecutiveLosses     = 0;
double            g_XAU_AnchorPrice = 0;
double            g_XAU_PeakPrice = 0;
double            g_XAU_ValleyPrice = 0;
bool              g_UseTwinTrading = true;
string            g_ActivePairs = "";
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

struct ADXCache {
   string          symbol;
   ENUM_TIMEFRAMES tf;
   int             period;
   int             handle;
   double          value;
   datetime        lastBar;
};
ADXCache g_adxCache[];

struct EMACache {
   string          symbol;
   ENUM_TIMEFRAMES tf;
   int             period;
   int             handle;
   double          value;
   datetime        lastBar;
};
EMACache g_emaCache[];

//--- ESTRUTURA PROTECÇÃO ASSÍNCRONA ---
struct PendingProtectionData {
   ulong    ticket;
   double   sl;
   double   tp;
   string   signalId;
   datetime timestamp;
};
PendingProtectionData PendingQueue[];


struct PartialCloseData
{
   ulong ticket;
   bool  closed;
};

PartialCloseData PartialCloses[];
bool            g_ExecutionBusy = false;

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

// ✅ FIX #1 — HELPER: Inicializa g_DailyStartEquity e g_DailyStartBalance
//    de forma segura a partir do equity actual.
//    Chamado em OnInit() e no início de CheckDailyLoss() como fallback.
//    PROBLEMA ORIGINAL: g_DailyStartEquity ficava a 0 se CheckDailyTarget()
//    (comentada em RunInstitutionalCore) nunca corresse, tornando o
//    circuit-breaker de 10% completamente inoperacional.
void InitDailyBaseline()
{
   double currentBal = AccountInfoDouble(ACCOUNT_BALANCE);
   double currentEq  = AccountInfoDouble(ACCOUNT_EQUITY);
   if(currentBal > 10 && currentEq > 10)
   {
      g_DailyStartBalance = currentBal;
      g_DailyStartEquity  = currentEq;
      MqlDateTime dt;
      TimeToStruct(TimeCurrent(), dt);
      g_LastTradingDay = dt.day_of_year;
      Print("📊 [BASELINE] g_DailyStartEquity inicializado: $", DoubleToString(currentEq, 2),
            " | Balance: $", DoubleToString(currentBal, 2));
   }
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   // --- AURA GUI INIT (REMOVED) ---

   // Carrega as variáveis do painel de inputs do MT5 diretamente para as variáveis globais
   // Já não depende de AuraForexConfig.txt (GUI Removida)
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
   g_MaxOrders = Tester_MaxOrders;
   g_XAU_StepDistance = Tester_XAU_StepDistance;
   g_XAU_TargetPoints = Tester_XAU_TargetPoints;
   g_XAU_ReversalPoints = Tester_XAU_ReversalPoints;
   g_XAU_TrendFilter = Tester_XAU_TrendFilter;
   g_XAU_EmaPeriod = Tester_XAU_EmaPeriod;
   g_XAU_EmaTimeframe = Tester_XAU_EmaTimeframe;
   g_MaxBuys = Tester_MaxBuys;
   g_MaxSells = Tester_MaxSells;
   g_TradeCooldown = Tester_TradeCooldown;
   g_DailyTargetFeatureEnabled = Tester_DailyTargetLockActive;
   g_DailyTargetPct = Tester_DailyTargetPct;
   g_DailyTargetLockPct = Tester_DailyTargetLockPct;
   g_DailyTargetFloorPct = Tester_DailyTargetFloorPct;
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
   //    para garantir que g_DailyStartEquity nunca fica a 0.
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
   // GUI Removida
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

   for(int i = 0; i < ArraySize(g_adxCache); i++)
   {
      if(g_adxCache[i].handle != INVALID_HANDLE)
      {
         IndicatorRelease(g_adxCache[i].handle);
         g_adxCache[i].handle = INVALID_HANDLE;
      }
   }
   ArrayFree(g_adxCache);

   for(int i = 0; i < ArraySize(g_emaCache); i++)
   {
      if(g_emaCache[i].handle != INVALID_HANDLE)
      {
         IndicatorRelease(g_emaCache[i].handle);
         g_emaCache[i].handle = INVALID_HANDLE;
      }
   }
   ArrayFree(g_emaCache);

   Print("🛡️ [CLEANUP] Handles de Indicadores (ATR, ADX, EMA) libertados com sucesso.");
}

int CountOrdersBySymbol(string sym) {
   int c=0;
   for(int i=PositionsTotal()-1; i>=0; i--) {
      ulong t=PositionGetTicket(i);
      if(t>0 && PositionSelectByTicket(t)) {
         if(PositionGetString(POSITION_SYMBOL)==sym && PositionGetInteger(POSITION_MAGIC)==GetAuraMagic()) c++;
      }
   }
   return c;
}

//+------------------------------------------------------------------+
//| INSTITUTIONAL CONTINUOUS DISTANCE SCALPER                        |
//+------------------------------------------------------------------+
void ProcessInstitutionalScalper(string sym)
{
   if(IsFridayFreeze()) return; // Bloqueia abertura à Sexta-feira
   if(CountOrdersBySymbol(sym) >= g_MaxOrders) return; // Limite global

   if(!SymbolSelect(sym, true)) return;

   int stepDistance = 0, targetPoints = 0, reversalPoints = 0, emaPeriod = 0, emaTimeframe = 0;
   bool trendFilter = false;
   int maxSL = 0;

   if(IsXAU(sym)) {
      if(!Tester_XAU_Enabled) return;
      stepDistance = Tester_XAU_StepDistance; targetPoints = Tester_XAU_TargetPoints;
      reversalPoints = Tester_XAU_ReversalPoints; trendFilter = Tester_XAU_TrendFilter;
      emaPeriod = Tester_XAU_EmaPeriod; emaTimeframe = Tester_XAU_EmaTimeframe;
      maxSL = g_MaxSLOuro;
   } else if(StringFind(sym, "JPY") >= 0) {
      stepDistance = Tester_JPY_StepDistance; targetPoints = Tester_JPY_TargetPoints;
      reversalPoints = Tester_JPY_ReversalPoints; trendFilter = Tester_JPY_TrendFilter;
      emaPeriod = Tester_JPY_EmaPeriod; emaTimeframe = Tester_JPY_EmaTimeframe;
      maxSL = g_MaxSLJPY;
   } else {
      stepDistance = Tester_Forex_StepDistance; targetPoints = Tester_Forex_TargetPoints;
      reversalPoints = Tester_Forex_ReversalPoints; trendFilter = Tester_Forex_TrendFilter;
      emaPeriod = Tester_Forex_EmaPeriod; emaTimeframe = Tester_Forex_EmaTimeframe;
      maxSL = g_MaxSLForex;
   }

   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   double bid = SymbolInfoDouble(sym, SYMBOL_BID);
   double point = SymbolInfoDouble(sym, SYMBOL_POINT);
   double midPrice = (ask + bid) / 2.0;

   // 1. INICIALIZAÇÃO DA ÂNCORA E EXTREMOS
   if(!GlobalVariableCheck("ANC_"+sym))
   {
      GlobalVariableSet("ANC_"+sym, midPrice);
      GlobalVariableSet("PEAK_"+sym, midPrice);
      GlobalVariableSet("VAL_"+sym, midPrice);
      return; // Aguarda o próximo tick para medir distância
   }

   double anchor = GlobalVariableGet("ANC_"+sym);
   double peak   = GlobalVariableGet("PEAK_"+sym);
   double valley = GlobalVariableGet("VAL_"+sym);

   // 2. ATUALIZAÇÃO DOS EXTREMOS DA TENDÊNCIA ATUAL (Para Reversão)
   if(midPrice > peak)   { peak = midPrice;   GlobalVariableSet("PEAK_"+sym, midPrice); }
   if(midPrice < valley) { valley = midPrice; GlobalVariableSet("VAL_"+sym, midPrice); }

   // 2.5 FILTRO INSTITUCIONAL DE TENDENCIA (EMA M15)
   bool allowBuy = true;
   bool allowSell = true;
   
   bool effectiveTrendFilter = trendFilter;
   if(g_EmaMode == "on") effectiveTrendFilter = true;
   else if(g_EmaMode == "off") effectiveTrendFilter = false;
   else if(g_EmaMode == "auto") {
      double adxVal = GetADX(sym, PERIOD_M15, 14);
      if(adxVal > 0) {
         // Se ADX < 25 mercado está lateral (choppy), então DESLIGA o filtro EMA para scalping bidirecional
         // Se ADX >= 25 mercado tem tendência, então LIGA o filtro EMA para proteger contra a tendência
         effectiveTrendFilter = (adxVal >= 25.0);
      }
   }
   
   if(effectiveTrendFilter)
   {
      ENUM_TIMEFRAMES tf = PERIOD_M15;
      if(emaTimeframe == 1) tf = PERIOD_M1;
      else if(emaTimeframe == 5) tf = PERIOD_M5;
      else if(emaTimeframe == 15) tf = PERIOD_M15;
      else if(emaTimeframe == 30) tf = PERIOD_M30;
      else if(emaTimeframe == 60) tf = PERIOD_H1;
      else if(emaTimeframe == 240) tf = PERIOD_H4;
      else if(emaTimeframe == 1440) tf = PERIOD_D1;

      // FILTRO DE TENDÊNCIA DINÂMICO (VAMA)
      int dynamicEmaPeriod = GetDynamicEmaPeriod(sym, emaTimeframe);
      g_DynamicEmaLog += sym + ": " + IntegerToString(dynamicEmaPeriod) + "\\n";

      double emaVal = GetEMA(sym, tf, dynamicEmaPeriod);
      if(emaVal > 0)
      {
         // Estratégia Mean Reversion (Grid Scalper) - Comprar Fundos e Vender Topos
         if(midPrice > emaVal) allowBuy = false;  // Sobrecomprado: Bloqueia Compras (só permite Vendas)
         if(midPrice < emaVal) allowSell = false; // Sobrevendido: Bloqueia Vendas (só permite Compras)
      }
   }

   // 3. REGRA DE ABERTURA DE ORDENS (Por Distância da Âncora)
   if(allowBuy && midPrice >= anchor + (stepDistance * point))
   {
      double sLot = CalculateLot(sym, GetDynamicRisk(maxSL), maxSL * point, ORDER_TYPE_BUY); if(sLot <= 0) sLot = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
      trade.SetTypeFillingBySymbol(sym);
      
      double slPrice = NormalizeDouble(ask - (maxSL * point), _Digits);
      double tpPrice = NormalizeDouble(ask + (targetPoints * point), _Digits);
      
      bool ok = trade.Buy(sLot, sym, ask, slPrice, tpPrice, "Aura "+sym+" Dist Buy");
      if(ok)
      {
         Print("📈 [SCALPER] Abertura de COMPRA em ", sym, " (Passo atingido). Preço: ", ask, " SL: ", slPrice, " TP: ", tpPrice);
         GlobalVariableSet("ANC_"+sym, midPrice);
         GlobalVariableSet("PEAK_"+sym, midPrice);
         GlobalVariableSet("VAL_"+sym, midPrice);
      }
   }
   else if(allowSell && midPrice <= anchor - (stepDistance * point))
   {
      double sLot = CalculateLot(sym, GetDynamicRisk(maxSL), maxSL * point, ORDER_TYPE_SELL); if(sLot <= 0) sLot = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
      trade.SetTypeFillingBySymbol(sym);
      
      double slPrice = NormalizeDouble(bid + (maxSL * point), _Digits);
      double tpPrice = NormalizeDouble(bid - (targetPoints * point), _Digits);
      
      bool ok = trade.Sell(sLot, sym, bid, slPrice, tpPrice, "Aura "+sym+" Dist Sell");
      if(ok)
      {
         Print("📉 [SCALPER] Abertura de VENDA em ", sym, " (Passo atingido). Preço: ", bid, " SL: ", slPrice, " TP: ", tpPrice);
         GlobalVariableSet("ANC_"+sym, midPrice);
         GlobalVariableSet("PEAK_"+sym, midPrice);
         GlobalVariableSet("VAL_"+sym, midPrice);
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
      double profit = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      
      bool closeIt = false;
      string closeReason = "";

      // === LÓGICA DE FECHO MÚTUO EXCLUSIVO ===
      if(g_ExitMode == "take_profit")
      {
         // 4.1 Apenas Take Profit Fixo
         if(type == POSITION_TYPE_BUY && bid >= openPrice + (targetPoints * point))
         {
            closeIt = true; closeReason = "Alvo de Lucro Atingido (Take Profit)";
         }
         else if(type == POSITION_TYPE_SELL && ask <= openPrice - (targetPoints * point))
         {
            closeIt = true; closeReason = "Alvo de Lucro Atingido (Take Profit)";
         }
      }
      else if(g_ExitMode == "time_limit")
      {
         // 4.2 Apenas Tempo Limite (Sem TP Fixo)
         long timeOpen = PositionGetInteger(POSITION_TIME);
         long secondsOpen = TimeCurrent() - timeOpen;
         
         if(profit > 0 && g_HoldSeconds > 0 && secondsOpen > g_HoldSeconds)
         {
            closeIt = true; closeReason = "Exaustão de Tempo no Lucro (Hold Seconds)";
         }
         else if(profit < 0 && g_NegativeHoldSeconds > 0 && secondsOpen > g_NegativeHoldSeconds)
         {
            closeIt = true; closeReason = "Exaustão de Tempo na Perda (Negative Hold)";
         }
      }
      
      // 4.3 Reversões (Atua em qualquer modo)
      if(!closeIt && profit > 0)
      {
         if(type == POSITION_TYPE_BUY && bid <= peak - (reversalPoints * point))
         {
            closeIt = true; closeReason = "Reversão de Mercado detetada (Proteção de Lucro)";
         }
         else if(type == POSITION_TYPE_SELL && ask >= valley + (reversalPoints * point))
         {
            closeIt = true; closeReason = "Reversão de Mercado detetada (Proteção de Lucro)";
         }
      }

      if(closeIt)
      {
         trade.PositionClose(t, 50);
         Print("✅ [SCALPER] Ordem ", t, " em ", sym, " Fechada. Motivo: ", closeReason, " | Lucro: $", DoubleToString(profit, 2));
      }
   }
}

int GetDynamicEmaPeriod(string sym, int basePeriod) {
    double atr = GetATR(sym, PERIOD_M15);
    double price = SymbolInfoDouble(sym, SYMBOL_BID);
    if(atr == 0) return basePeriod;
    // Lógica VAMA simplificada: aumenta período em volatilidade, diminui em calmaria
    double vol = atr / price * 10000; 
    return (int)(basePeriod * (1.0 + vol));
}

void OnTick()
{
   if(!g_IsAuthorized) return;
   
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
   if(!IsTradingSession()) return;
   
   g_DynamicEmaLog = ""; // Limpa o log no início do ciclo

   // ✅ FIX #2: ReportBalance() e UpdateChartVisuals() movidos para DENTRO
   //    do semáforo g_ExecutionBusy para evitar race condition no estado
   //    g_DailyLossLock / g_DailyTargetReached durante o processamento.
   //    ANTES: corriam ANTES da verificação do semáforo, podendo ler/escrever
   //    estado partilhado em paralelo com RunInstitutionalCore().
   if(g_ExecutionBusy) return;
   g_ExecutionBusy = true;

   // Sincronismo Dashboard (agora dentro do semáforo — sem race condition)
   ReportBalance();
   UpdateChartVisuals();

   // Proteger Ordens Manuais (executa mesmo sem autorização de licença)
   ProtectManualOrders();

   RunInstitutionalCore();

   g_ExecutionBusy = false;
}

void CheckLossProtector()
{
   if(!g_UseLossProtector || g_LossProtectorPct <= 0) return;
   
   double dailyProfit = GetDailyPnL();
   if(dailyProfit <= 0) return; // Opção A: Desativado se lucro diário for <= 0 para ganhar tração
   
   double maxLossAllowed = -(dailyProfit * (g_LossProtectorPct / 100.0));
   
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         long magic = PositionGetInteger(POSITION_MAGIC);
         if(magic == GetAuraMagic() || (g_ManageManualOrders && magic == 0))
         {
            double currentProfit = PositionGetDouble(POSITION_PROFIT);
            if(currentProfit < 0 && currentProfit <= maxLossAllowed)
            {
               Print("🛡️ LOSS PROTECTOR ATIVADO! Ordem fechada. Lucro Diário: $", DoubleToString(dailyProfit, 2), " | Perda Máx: $", DoubleToString(maxLossAllowed, 2), " | Perda Atual: $", DoubleToString(currentProfit, 2));
               trade.PositionClose(ticket);
            }
         }
      }
   }
}

void RunInstitutionalCore()
{
   ValidateLicense();

   if(g_IsAuthorized)
   {
      CheckDailyLoss();
      CheckDailyTarget();
      CheckFridaySafeLock();
      ApplyBreakeven();
      CheckLossProtector();

      ProcessPendingProtections();
      MonitorGlobalEquityStop();

      if(g_RunnerMode == "trailing") MonitorTrailingStop();
      else if(g_RunnerMode == "profit_lock") MonitorProfitLock();
      
      MonitorGlobalProfitLock();
      
      if(g_ActivePairs == "") {
         ProcessInstitutionalScalper(_Symbol);
      } else {
         string pairs[];
         int count = StringSplit(g_ActivePairs, ',', pairs);
         for(int i = 0; i < count; i++) {
            string pair = pairs[i];
            StringTrimLeft(pair); StringTrimRight(pair);
            if(pair != "") ProcessInstitutionalScalper(pair);
         }
      }
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

   if(tm.day_of_year != g_LastTradingDay)
   {
      double currentBal = AccountInfoDouble(ACCOUNT_BALANCE);
      double currentEq  = AccountInfoDouble(ACCOUNT_EQUITY);
      if(currentBal > 10 && currentEq > 10)
      {
         g_LastTradingDay = tm.day_of_year;
         g_DailyTargetReached = false;
         g_DailyLossLock      = false;
         g_DailyStartBalance  = currentBal;
         g_DailyStartEquity   = currentEq;
         g_DailyTargetProfit  = g_DailyStartEquity * (g_DailyTargetPct / 100.0);

         GlobalVariableSet(gvTarget, g_DailyTargetProfit);
         GlobalVariableSet(gvEquity, g_DailyStartEquity);
         GlobalVariableSet(gvDay, tm.day_of_year);

         Print("🌅 [DAILY] Novo dia detectado. Meta/Loss resetados | Balance: $",
               DoubleToString(g_DailyStartBalance, 2),
               " | Equity: $", DoubleToString(g_DailyStartEquity, 2),
               " | Meta: $", DoubleToString(g_DailyTargetProfit, 2));
      }
   }

   if(g_DailyTargetProfit <= 0 && g_DailyStartEquity <= 10)
   {
      if(GlobalVariableCheck(gvTarget) && GlobalVariableCheck(gvDay) &&
         GlobalVariableGet(gvDay) == tm.day_of_year)
      {
         g_DailyTargetProfit = GlobalVariableGet(gvTarget);
         g_DailyStartEquity  = GlobalVariableGet(gvEquity);
         g_DailyStartBalance = g_DailyStartEquity;
         g_LastTradingDay    = tm.day_of_year;
         Print("🔄 [RESTORE] Meta Diária recuperada: $", DoubleToString(g_DailyTargetProfit, 2));
      }
      else
      {
         double currentBal = AccountInfoDouble(ACCOUNT_BALANCE);
         double currentEq  = AccountInfoDouble(ACCOUNT_EQUITY);
         if(currentBal > 10 && currentEq > 10)
         {
            g_DailyStartBalance = currentBal;
            g_DailyStartEquity  = currentEq;
            g_DailyTargetProfit = g_DailyStartEquity * (g_DailyTargetPct / 100.0);

            GlobalVariableSet(gvTarget, g_DailyTargetProfit);
            GlobalVariableSet(gvEquity, g_DailyStartEquity);
            GlobalVariableSet(gvDay, tm.day_of_year);

            Print("🌅 [BOOT] Saldo inicial definido: $", DoubleToString(g_DailyStartBalance, 2));
         }
      }
   }

   if(g_DailyStartEquity <= 10) return;
   if(g_DailyTargetReached) return;

   double dailyPnL = GetDailyPnL();

   if(dailyPnL >= g_DailyTargetProfit && g_DailyTargetProfit > 0)
   {
      g_DailyTargetReached = true;
      Print("🏆 [DAILY] META ATINGIDA: $", DoubleToString(dailyPnL, 2));
      CloseAllPositions();
      g_DailyTargetLockTriggered = false;
      g_DailyPeakPnL = 0;
      return;
   }

   if(g_DailyTargetFeatureEnabled)
   {
      double activationThreshold = g_DailyTargetProfit * (g_DailyTargetLockPct / 100.0);
      double floorProfit         = g_DailyTargetProfit * (g_DailyTargetFloorPct / 100.0);

      if(!g_DailyTargetLockTriggered && dailyPnL >= activationThreshold && g_DailyTargetProfit > 0)
      {
         g_DailyTargetLockTriggered = true;
         g_DailyPeakPnL = dailyPnL;
         Print("🛡️ [DAILY LOCK] Ativado! Lucro: $", DoubleToString(dailyPnL, 2));
      }

      if(g_DailyTargetLockTriggered)
      {
         if(dailyPnL > g_DailyPeakPnL) g_DailyPeakPnL = dailyPnL;
         if(dailyPnL <= floorProfit)
         {
            g_DailyTargetReached = true;
            Print("🛑 [DAILY LOCK] Limite mínimo atingido. Fechando tudo.");
            CloseAllPositions();
            g_DailyTargetLockTriggered = false;
            g_DailyPeakPnL = 0;
         }
      }
   }
}

void CheckDailyLoss()
{
   if(g_DailyLossLock) return;

   // ✅ FIX #1 (complementar): Se g_DailyStartEquity ainda for 0 aqui
   //    (ex: bot reiniciado intra-dia sem ter passado pelo OnInit completo),
   //    inicializa agora antes de calcular qualquer percentagem de perda.
   //    ANTES: a função retornava silenciosamente com "return" e o
   //    circuit-breaker nunca actuava durante toda a sessão.
   if(g_DailyStartEquity <= 10)
   {
      InitDailyBaseline();
      return; // Aguarda próximo timer com baseline correcto
   }

   static datetime bootTime = 0;
   if(bootTime == 0) bootTime = TimeCurrent();
   if(TimeCurrent() - bootTime < 10) return;

   double dailyPnL = GetDailyPnL();
   double lossPct = (dailyPnL < 0) ? (MathAbs(dailyPnL) / g_DailyStartEquity) * 100.0 : 0.0;
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);

   if(lossPct >= g_MaxDailyLossPct)
   {
      g_DailyLossLock = true;
      Print("🛑 [CIRCUIT-BREAKER] LIMITE DE PERDA DIÁRIA ATINGIDO: ",
            DoubleToString(lossPct, 2), "% | Equity Inicial: ", g_DailyStartEquity,
            " | Equity Actual: ", equity);
      CloseAllPositions();
   }
}

//+------------------------------------------------------------------+
//| PROFIT LOCK                                                      |
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
               if(SafePositionModify(ticket, targetSL, PositionGetDouble(POSITION_TP)))
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
               if(SafePositionModify(ticket, targetSL, PositionGetDouble(POSITION_TP)))
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
//| GLOBAL PORTFOLIO PROFIT LOCK                                     |
//+------------------------------------------------------------------+
void MonitorGlobalEquityStop()
{
   if(g_EquityActivationPct <= 0 || g_EquityDropPct <= 0) return;

   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);

   int openPositionsCount = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--) {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket)) {
         long magic = PositionGetInteger(POSITION_MAGIC);
         if(magic == GetAuraMagic() || (g_ManageManualOrders && magic == 0)) openPositionsCount++;
      }
   }

   if(openPositionsCount == 0) {
      if(g_EquityProtectionActive) {
         g_EquityProtectionActive = false;
         g_GlobalEquityPeak = 0;
      }
      return;
   }

   double activationTarget = balance * (1.0 + (g_EquityActivationPct / 100.0));

   if(!g_EquityProtectionActive && equity >= activationTarget) {
      g_EquityProtectionActive = true;
      g_GlobalEquityPeak = equity;
      PrintFormat("🛡️ Proteção Global Equity Ativada! Equity alcançou $%.2f", equity);
   }

   if(g_EquityProtectionActive) {
      if(equity > g_GlobalEquityPeak) g_GlobalEquityPeak = equity; // Atualiza o Trailing
      
      double dropLevel = g_GlobalEquityPeak * (1.0 - (g_EquityDropPct / 100.0));

      if(equity <= dropLevel) {
         PrintFormat("🚨 Global Equity Drop disparado! Pico: $%.2f | Drop Level: $%.2f | Atual: $%.2f. Fechando tudo!", g_GlobalEquityPeak, dropLevel, equity);
         
         for(int i = PositionsTotal() - 1; i >= 0; i--) {
            ulong ticket = PositionGetTicket(i);
            if(ticket > 0 && PositionSelectByTicket(ticket)) {
               long magic = PositionGetInteger(POSITION_MAGIC);
               if(magic == GetAuraMagic() || (g_ManageManualOrders && magic == 0)) {
                  trade.PositionClose(ticket, 50);
               }
            }
         }
         
         g_EquityProtectionActive = false;
         g_GlobalEquityPeak = 0;
      }
   }
}

void MonitorGlobalProfitLock()
{
   if(g_ProfitLockMin <= 0 || g_ProfitLockDrop <= 0) return;

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
         trailStartPts = g_TrailingStart_XAU;
         trailStepPts  = g_TrailingStep_XAU;
         trailDistPts  = g_TrailingDistance_XAU;
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
      g_IsAuthorized = true;
      return;
   }

   static datetime lastValidate = 0;
   static datetime lastSuccessTime = 0;
   
   if(TimeCurrent() - lastValidate < 5 && g_IsAuthorized)  return; // Verifica a cada 5 segundos para resposta rápida ao Dashboard
   if(TimeCurrent() - lastValidate < 5  && !g_IsAuthorized) return; // Tenta a cada 5s se falhou
   lastValidate = TimeCurrent();

   string url = g_ServerUrl + "/ea/validate";
   string payload = "{\"licenseKey\":\"" + g_LicenseKey +
                    "\",\"mtAccount\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\"}";
   string res = SendPost(url, payload);

   if(StringFind(res, "\"status\":\"success\"") >= 0 ||
      StringFind(res, "\"status\":\"OK\"") >= 0)
   {
      if(!g_IsAuthorized) Print("✅ LICENÇA VALIDADA COM SUCESSO!");
      g_IsAuthorized = true;
      lastSuccessTime = TimeCurrent(); // Registra o momento da última validação com sucesso
      
      int apIndex = StringFind(res, "\"activePairs\":\"");
      if(apIndex >= 0) {
         apIndex += 15; // len of "activePairs":"
         int endIndex = StringFind(res, "\"", apIndex);
         if(endIndex > apIndex) {
            g_ActivePairs = StringSubstr(res, apIndex, endIndex - apIndex);
         }
      }
   }
   else if(StringFind(res, "\"status\":\"STOPPED\"") >= 0)
   {
      g_IsAuthorized = false;
      Print("⏸️ BOT PARADO PELO DASHBOARD. A aguardar início...");
   }
   else if(res == "")
   {
      // Erro de rede: Tolerância de 24 horas (86400 segundos) para proteger contra quedas do servidor
      if(g_IsAuthorized && (TimeCurrent() - lastSuccessTime < 86400))
      {
         static datetime lastWarn = 0;
         if(TimeCurrent() - lastWarn > 3600) { // Avisa apenas a cada 1 hora
            Print("⚠️ Servidor inacessível. O Bot continuará a operar (Modo Tolerância Ativo: 24h).");
            lastWarn = TimeCurrent();
         }
      }
      else
      {
         g_IsAuthorized = false;
         Print("❌ ERRO DE CONEXÃO CRÍTICO: Servidor Offline há mais de 24h ou URL Inválida.");
      }
   }
   else
   {
      // Outro erro qualquer retornado pelo servidor (ex: licença expirada)
      g_IsAuthorized = false;
      Print("❌ FALHA NA LICENÇA: ", res);
   }
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

   double dailyPnl    = (g_DailyStartEquity > 0) ? ((rawEquity - g_DailyStartEquity) * mult) : 0;
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
            double sl      = PositionGetDouble(POSITION_SL);
            double tp      = PositionGetDouble(POSITION_TP);
            if(count > 0) openTradesJson += ",";
            openTradesJson += "{\"id\":\"" + IntegerToString(ticket) +
                              "\",\"pair\":\"" + sym +
                              "\",\"direction\":\"" + dir +
                              "\",\"profit\":" + DoubleToString(profit, 2) +
                              ",\"lotSize\":" + DoubleToString(lot, 2) +
                              ",\"openPrice\":" + DoubleToString(openPrice, 5) +
                              ",\"sl\":" + DoubleToString(sl, 5) +
                              ",\"tp\":" + DoubleToString(tp, 5) + "}";
            count++;
         }
      }
   }
   openTradesJson += "]";

   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   dt.hour = 0; dt.min = 0; dt.sec = 0;
   datetime todayStart = StructToTime(dt);
   
   HistorySelect(todayStart, TimeCurrent());
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
      "\"isLocked\":"        + (g_DailyLossLock ? "true" : "false") + ","
      "\"isLossLocked\":"    + (g_DailyLossLock ? "true" : "false") + ","
      "\"openTrades\":"      + openTradesJson  + ","
      "\"closedTrades\":"    + closedTradesJson + ","
      "\"dynamicEmaLog\":\"" + g_DynamicEmaLog + "\""
   "}";

   string url = g_ServerUrl + "/ea/report-balance";
   string response = SendPost(url, payload);

   if(response == "") {
      Print("❌ [SYNC] Falha ao reportar saldo para o Dashboard.");
      return;
   }

   bool isProfitLocked = (StringFind(response, "\"isProfitLocked\":true") >= 0);
   bool isLossLocked = (StringFind(response, "\"isLossLocked\":true") >= 0) || (StringFind(response, "\"isLocked\":true") >= 0);

   double serverStartBalance = 0;
   int sIdx = StringFind(response, "\"g_DailyStartBalance\":");
   if(sIdx >= 0) {
      sIdx += 20;
      int eIdx = StringFind(response, "}", sIdx);
      if(eIdx < 0) eIdx = StringFind(response, ",", sIdx);
      if(eIdx > sIdx) {
         serverStartBalance = StringToDouble(StringSubstr(response, sIdx, eIdx - sIdx));
      }
   }

   // --- PARSE ADVANCED SETTINGS ---
   int emaIdx = StringFind(response, "\"emaMode\":\"");
   if(emaIdx >= 0) {
      emaIdx += 11;
      int eIdx = StringFind(response, "\"", emaIdx);
      if(eIdx > emaIdx) {
         string val = StringSubstr(response, emaIdx, eIdx - emaIdx);
         if(val == "auto" || val == "on" || val == "off") g_EmaMode = val;
      }
   }
   
   int profitPctIdx = StringFind(response, "\"advDailyProfitPct\":");
   if(profitPctIdx >= 0) {
      profitPctIdx += 20;
      int eIdx = StringFind(response, ",", profitPctIdx);
      if(eIdx < 0) eIdx = StringFind(response, "}", profitPctIdx);
      if(eIdx > profitPctIdx) {
         double v = StringToDouble(StringSubstr(response, profitPctIdx, eIdx - profitPctIdx));
         if(v >= 0 && v <= 1000) g_DailyTargetPct = v;
      }
   }
   
   int lossPctIdx = StringFind(response, "\"advDailyLossPct\":");
   if(lossPctIdx >= 0) {
      lossPctIdx += 18;
      int eIdx = StringFind(response, ",", lossPctIdx);
      if(eIdx < 0) eIdx = StringFind(response, "}", lossPctIdx);
      if(eIdx > lossPctIdx) {
         double v = StringToDouble(StringSubstr(response, lossPctIdx, eIdx - lossPctIdx));
         if(v >= 0 && v <= 100) g_MaxDailyLossPct = v;
      }
   }

   int riskIdx = StringFind(response, "\"riskPercent\":");
   if(riskIdx >= 0) {
      riskIdx += 14;
      int eIdx = StringFind(response, "}", riskIdx);
      if(eIdx < 0) eIdx = StringFind(response, ",", riskIdx);
      if(eIdx > riskIdx) {
         double v = StringToDouble(StringSubstr(response, riskIdx, eIdx - riskIdx));
         if(v > 0 && v <= 100) g_RiskPercent = v; // Risk should probably remain > 0 and <= 100
      }
   }

   int runnerIdx = StringFind(response, "\"runnerMode\":\"");
   if(runnerIdx >= 0) {
      runnerIdx += 14;
      int eIdx = StringFind(response, "\"", runnerIdx);
      if(eIdx > runnerIdx) {
         string val = StringSubstr(response, runnerIdx, eIdx - runnerIdx);
         if(val == "none" || val == "trailing" || val == "profit_lock") g_RunnerMode = val;
      }
   }

   int exitIdx = StringFind(response, "\"exitMode\":\"");
   if(exitIdx >= 0) {
      exitIdx += 12;
      int eIdx = StringFind(response, "\"", exitIdx);
      if(eIdx > exitIdx) {
         string val = StringSubstr(response, exitIdx, eIdx - exitIdx);
         if(val == "take_profit" || val == "time_limit") g_ExitMode = val;
      }
   }

   int hsIdx = StringFind(response, "\"holdSeconds\":");
   if(hsIdx >= 0) {
      hsIdx += 14;
      int eIdx = StringFind(response, ",", hsIdx);
      if(eIdx < 0) eIdx = StringFind(response, "}", hsIdx);
      if(eIdx > hsIdx) {
         int v = (int)StringToInteger(StringSubstr(response, hsIdx, eIdx - hsIdx));
         if(v >= 0) g_HoldSeconds = v;
      }
   }

   int nhsIdx = StringFind(response, "\"negativeHoldSeconds\":");
   if(nhsIdx >= 0) {
      nhsIdx += 22;
      int eIdx = StringFind(response, ",", nhsIdx);
      if(eIdx < 0) eIdx = StringFind(response, "}", nhsIdx);
      if(eIdx > nhsIdx) {
         int v = (int)StringToInteger(StringSubstr(response, nhsIdx, eIdx - nhsIdx));
         if(v >= 0) g_NegativeHoldSeconds = v;
      }
   }

   int plMinIdx = StringFind(response, "\"profitLockMin\":");
   if(plMinIdx >= 0) {
      plMinIdx += 16;
      int eIdx = StringFind(response, ",", plMinIdx);
      if(eIdx < 0) eIdx = StringFind(response, "}", plMinIdx);
      if(eIdx > plMinIdx) {
         double v = StringToDouble(StringSubstr(response, plMinIdx, eIdx - plMinIdx));
         if(v >= 0) g_ProfitLockMin = v;
      }
   }

   int plDropIdx = StringFind(response, "\"profitLockDrop\":");
   if(plDropIdx >= 0) {
      plDropIdx += 17;
      int eIdx = StringFind(response, ",", plDropIdx);
      if(eIdx < 0) eIdx = StringFind(response, "}", plDropIdx);
      if(eIdx > plDropIdx) {
         double v = StringToDouble(StringSubstr(response, plDropIdx, eIdx - plDropIdx));
         if(v >= 0) g_ProfitLockDrop = v;
      }
   }

   int eqActIdx = StringFind(response, "\"equityActivationPct\":");
   if(eqActIdx >= 0) {
      eqActIdx += 22;
      int eIdx = StringFind(response, ",", eqActIdx);
      if(eIdx < 0) eIdx = StringFind(response, "}", eqActIdx);
      if(eIdx > eqActIdx) {
         double v = StringToDouble(StringSubstr(response, eqActIdx, eIdx - eqActIdx));
         if(v >= 0) g_EquityActivationPct = v;
      }
   }

   int eqDropIdx = StringFind(response, "\"equityDropPct\":");
   if(eqDropIdx >= 0) {
      eqDropIdx += 16;
      int eIdx = StringFind(response, ",", eqDropIdx);
      if(eIdx < 0) eIdx = StringFind(response, "}", eqDropIdx);
      if(eIdx > eqDropIdx) {
         double v = StringToDouble(StringSubstr(response, eqDropIdx, eIdx - eqDropIdx));
         if(v >= 0) g_EquityDropPct = v;
      }
   }

   int ulpIdx = StringFind(response, "\"useLossProtector\":");
   if(ulpIdx >= 0) {
      g_UseLossProtector = (StringFind(response, "true", ulpIdx) < StringFind(response, ",", ulpIdx));
   }
   
   int lpPctIdx = StringFind(response, "\"lossProtectorPct\":");
   if(lpPctIdx >= 0) {
      lpPctIdx += 19;
      int eIdx = StringFind(response, ",", lpPctIdx);
      if(eIdx < 0) eIdx = StringFind(response, "}", lpPctIdx);
      if(eIdx > lpPctIdx) {
         double v = StringToDouble(StringSubstr(response, lpPctIdx, eIdx - lpPctIdx));
         if(v >= 0) g_LossProtectorPct = v;
      }
   }

   int ugeIdx = StringFind(response, "\"useGlobalEquity\":");
   if(ugeIdx >= 0) {
      g_UseGlobalEquity = (StringFind(response, "true", ugeIdx) < StringFind(response, ",", ugeIdx));
   }

   int uplIdx = StringFind(response, "\"useProfitLock\":");
   if(uplIdx >= 0) {
      g_UseProfitLock = (StringFind(response, "true", uplIdx) < StringFind(response, ",", uplIdx));
   }

   int pltIdx = StringFind(response, "\"profitLockType\":");
   if(pltIdx >= 0) {
      pltIdx += 17;
      int eIdx = StringFind(response, "\"", pltIdx + 1);
      if(eIdx > pltIdx) {
         g_ProfitLockType = StringSubstr(response, pltIdx + 1, eIdx - pltIdx - 1);
      }
   }

      if(serverStartBalance > 10)
      {
         g_DailyStartBalance = serverStartBalance;
         if(g_DailyStartEquity <= 0) g_DailyStartEquity = serverStartBalance;
      }

      if(isProfitLocked && !g_DailyTargetReached)
      {
         g_DailyTargetReached = true;
         Print("🏆 [SERVER-SYNC] Meta Diária Atingida no Servidor! Fechando posições...");
         CloseAllPositions();
      }
      else if(!isProfitLocked && g_DailyTargetReached)
      {
         g_DailyTargetReached = false;
         Print("🌅 [SERVER-SYNC] Reset de Meta Diária detectado. Desbloqueando...");
      }

      if(isLossLocked && !g_DailyLossLock)
      {
         g_DailyLossLock = true;
         Print("🛡️ [SERVER-SYNC] Limite de Perda Diária Atingido no Servidor! Fechando posições...");
         CloseAllPositions();
      }
      else if(!isLossLocked && g_DailyLossLock)
      {
         g_DailyLossLock = false;
         Print("🌅 [SERVER-SYNC] Reset de Perda Diária detectado. Desbloqueando...");
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
   string status = g_DailyTargetReached ? "LOCKED" : "RUNNING";

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
   g_atrCache[size].lastBar = 0;
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

// OnChartEvent removido junto com o GUI


//+------------------------------------------------------------------+
//| Custom Optimization Criterion (OnTester)                         |
//+------------------------------------------------------------------+
#define WEIGHT_PROFIT_FACTOR    0.30
#define WEIGHT_RECOVERY_FACTOR  0.25
#define WEIGHT_SHARPE           0.20
#define WEIGHT_WIN_RATE         0.10
#define WEIGHT_DRAWDOWN_PENALTY 0.15

#define MIN_TRADES              30
#define MAX_DRAWDOWN_PCT        25.0
#define MIN_PROFIT_FACTOR       1.10
#define MIN_WIN_RATE            35.0

double OnTester()
{
   double profitFactor    = TesterStatistics(STAT_PROFIT_FACTOR);
   double totalNetProfit  = TesterStatistics(STAT_PROFIT);
   double maxDrawdownPct  = TesterStatistics(STAT_EQUITY_DD_RELATIVE);
   double recoveryFactor  = TesterStatistics(STAT_RECOVERY_FACTOR);
   double sharpeRatio     = TesterStatistics(STAT_SHARPE_RATIO);
   double winRatePct      = TesterStatistics(STAT_TRADES) > 0 ? (TesterStatistics(STAT_PROFIT_TRADES) / TesterStatistics(STAT_TRADES)) * 100.0 : 0;
   int    totalTrades     = (int)TesterStatistics(STAT_TRADES);

   if(totalTrades < MIN_TRADES)          return 0;
   if(totalNetProfit <= 0)               return 0;
   if(maxDrawdownPct > MAX_DRAWDOWN_PCT) return 0;
   if(profitFactor < MIN_PROFIT_FACTOR)  return 0;
   if(winRatePct < MIN_WIN_RATE)         return 0;

   double pfScore = MathMin(profitFactor / 4.0, 1.0);
   double rfScore = MathMin(MathMax(recoveryFactor, 0) / 10.0, 1.0);
   double sharpeScore = MathMin(MathMax(sharpeRatio, 0) / 3.0, 1.0);
   double winScore = MathMin(MathMax((winRatePct - 35.0) / 35.0, 0), 1.0);
   double ddPenalty = MathMin(maxDrawdownPct / MAX_DRAWDOWN_PCT, 1.0);

   double score = (pfScore * WEIGHT_PROFIT_FACTOR) + (rfScore * WEIGHT_RECOVERY_FACTOR) + (sharpeScore * WEIGHT_SHARPE) + (winScore * WEIGHT_WIN_RATE) - (ddPenalty * WEIGHT_DRAWDOWN_PENALTY);
   score = MathMax(score, 0);

   double initialBalance = TesterStatistics(STAT_INITIAL_DEPOSIT);
   if(initialBalance > 0) score *= (1.0 + MathMin(totalNetProfit / initialBalance, 1.0));

   PrintFormat("[OPT] Score: %.4f | PF: %.2f | RF: %.2f | Sharpe: %.2f | WR: %.1f%% | DD: %.1f%% | Trades: %d | Lucro: $%.2f", score, profitFactor, recoveryFactor, sharpeRatio, winRatePct, maxDrawdownPct, totalTrades, totalNetProfit);

   return score;
}

//+------------------------------------------------------------------+
//| INDICADORES FALTANTES (GetADX, GetEMA)                           |
//+------------------------------------------------------------------+
double GetADX(string sym, ENUM_TIMEFRAMES tf, int period)
{
   if(sym == "" || StringLen(sym) < 3) return 0;
   datetime currentBar = iTime(sym, tf, 0);
   if(currentBar <= 0) return 0;

   int size = ArraySize(g_adxCache);
   for(int i = 0; i < size; i++)
   {
      if(g_adxCache[i].symbol == sym && g_adxCache[i].tf == tf && g_adxCache[i].period == period)
      {
         if(g_adxCache[i].lastBar == currentBar && g_adxCache[i].value > 0)
            return g_adxCache[i].value;

         double adxBuf[];
         ArraySetAsSeries(adxBuf, true);
         if(CopyBuffer(g_adxCache[i].handle, 0, 0, 1, adxBuf) > 0)
         {
            g_adxCache[i].value   = adxBuf[0];
            g_adxCache[i].lastBar = currentBar;
            return adxBuf[0];
         }
         return 0;
      }
   }

   int newIdx = size;
   ArrayResize(g_adxCache, newIdx + 1);
   g_adxCache[newIdx].symbol = sym;
   g_adxCache[newIdx].tf     = tf;
   g_adxCache[newIdx].period = period;
   g_adxCache[newIdx].handle = iADX(sym, tf, period);
   g_adxCache[newIdx].value  = 0;
   g_adxCache[newIdx].lastBar= 0;

   if(g_adxCache[newIdx].handle == INVALID_HANDLE) return 0;

   double adxBuf[];
   ArraySetAsSeries(adxBuf, true);
   if(CopyBuffer(g_adxCache[newIdx].handle, 0, 0, 1, adxBuf) > 0)
   {
      g_adxCache[newIdx].value   = adxBuf[0];
      g_adxCache[newIdx].lastBar = currentBar;
      return adxBuf[0];
   }

   return 0;
}

double GetEMA(string sym, ENUM_TIMEFRAMES tf, int period)
{
   if(sym == "" || StringLen(sym) < 3) return 0;
   datetime currentBar = iTime(sym, tf, 0);
   if(currentBar <= 0) return 0;

   int size = ArraySize(g_emaCache);
   for(int i = 0; i < size; i++)
   {
      if(g_emaCache[i].symbol == sym && g_emaCache[i].tf == tf && g_emaCache[i].period == period)
      {
         if(g_emaCache[i].lastBar == currentBar && g_emaCache[i].value > 0)
            return g_emaCache[i].value;

         double emaBuf[];
         ArraySetAsSeries(emaBuf, true);
         if(CopyBuffer(g_emaCache[i].handle, 0, 0, 1, emaBuf) > 0)
         {
            g_emaCache[i].value   = emaBuf[0];
            g_emaCache[i].lastBar = currentBar;
            return emaBuf[0];
         }
         return 0;
      }
   }

   int newIdx = size;
   ArrayResize(g_emaCache, newIdx + 1);
   g_emaCache[newIdx].symbol = sym;
   g_emaCache[newIdx].tf     = tf;
   g_emaCache[newIdx].period = period;
   g_emaCache[newIdx].handle = iMA(sym, tf, period, 0, MODE_EMA, PRICE_CLOSE);
   g_emaCache[newIdx].value  = 0;
   g_emaCache[newIdx].lastBar= 0;

   if(g_emaCache[newIdx].handle == INVALID_HANDLE) return 0;

   double emaBuf[];
   ArraySetAsSeries(emaBuf, true);
   if(CopyBuffer(g_emaCache[newIdx].handle, 0, 0, 1, emaBuf) > 0)
   {
      g_emaCache[newIdx].value   = emaBuf[0];
      g_emaCache[newIdx].lastBar = currentBar;
      return emaBuf[0];
   }

   return 0;
}

