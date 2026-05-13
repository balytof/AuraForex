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
input int      InpTimerSeconds      = 1;                       // Intervalo de Checagem (Segundos)
input int      InpMaxSLForex        = 700;                     // Limite SL Forex (Pontos)
input int      InpMaxSLJPY          = 2000;                    // Limite SL JPY/Ouro (Pontos)
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
bool              DailyTargetReached = false;
int               LastTradingDay     = -1;
int               ConsecutiveLosses  = 0; // Contador de perdas consecutivas

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

PartialCloseData PartialCloses[100]; // Rastreio de fechos parciais
bool            ExecutionBusy = false; // Bloqueio de execução (Semáforo)

//--- Funções Auxiliares de Especialista
bool IsXAU(string sym) { return (StringFind(sym, "XAU") >= 0 || StringFind(sym, "GOLD") >= 0); }

bool IsTradingSession()
{
   MqlDateTime tm;
   TimeCurrent(tm);
   int hour = tm.hour;
   // Londres + NY (7h às 18h) - Horário do Servidor
   return (hour >= 7 && hour <= 18);
}

double GetMaxAllowedSpread(string sym)
{
   return IsXAU(sym) ? 35.0 : 15.0; // 35 pips para Ouro, 15 para Forex
}

bool IsVolatilityAbnormal(string sym)
{
   // --- ENGINE ATR DINÂMICO (H1 para Ouro) ---
   double atrNow = 0;
   ENUM_TIMEFRAMES atrTF = IsXAU(sym) ? PERIOD_H1 : PERIOD_M15;
   int handle = iATR(sym, atrTF, 14);
   if(handle != INVALID_HANDLE)
   {
      double buf[];
      ArraySetAsSeries(buf, true);
      if(CopyBuffer(handle, 0, 0, 1, buf) > 0) atrNow = buf[0];
      IndicatorRelease(handle);
   }
   
   double limit = IsXAU(sym) ? (2.5 * 0.50) : (1.5 * 0.0002); 
   return (atrNow > limit && atrNow > 0);
}

long GetAuraMagic()
{
   return InpMagicNumber + (int)PeriodSeconds();
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("🚀 AURA V8 INSTITUCIONAL - Execution Engine");
   
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
   // 1. Proteger Ordens Manuais (Sempre prioridade, independente de autorização)
   ProtectManualOrders();

   if(ExecutionBusy) return;
   ExecutionBusy = true;

   // Validar Licença (anti-spam throttle interno)
   ValidateLicense();

   if(IsAuthorized)
   {
      CheckDailyTarget();
      CheckSignals();
      ProcessSignalQueue();

      // HIERARQUIA INSTITUCIONAL DE GESTÃO
      MonitorTrailingStop();  // 1. Trailing
      MonitorPartialTP();     // 2. Parciais e BreakEven
      MonitorProfitLock();    // 3. ProfitLock

      ProcessPendingProtections();

      // Sincronismo Dashboard (Tempo Real)
      ReportBalance();
   }

   ExecutionBusy = false;
}

void CheckDailyTarget()
{
   MqlDateTime tm;
   TimeCurrent(tm);

   if(tm.day != LastTradingDay)
   {
      LastTradingDay = tm.day;
      DailyStartBalance = AccountInfoDouble(ACCOUNT_BALANCE);
      DailyTargetReached = false;
      Print("🌅 [DAILY] Novo dia. Capital Base: $", DoubleToString(DailyStartBalance, 2));
   }

   if(DailyTargetReached) return;

   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   if(DailyStartBalance <= 0) return;

   double profitPct = ((equity - DailyStartBalance) / DailyStartBalance) * 100.0;

   if(profitPct >= InpDailyTargetPct)
   {
      DailyTargetReached = true;
      Print("🏆 [DAILY] META ATINGIDA: ", DoubleToString(profitPct, 2), "% | Fechando tudo...");
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket > 0 && PositionSelectByTicket(ticket))
            trade.PositionClose(ticket);
      }
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

      // 3. Cálculo de Volatilidade Real (H1 para Ouro, M15 para Forex)
      double atr = 0;
      ENUM_TIMEFRAMES atrTF = IsXAU(sym) ? PERIOD_H1 : PERIOD_M15;
      int atrHandle = iATR(sym, atrTF, 14);
      if(atrHandle != INVALID_HANDLE)
      {
         double atrBuf[];
         ArraySetAsSeries(atrBuf, true);
         if(CopyBuffer(atrHandle, 0, 0, 1, atrBuf) > 0) atr = atrBuf[0];
         IndicatorRelease(atrHandle);
      }

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

      // Verificar se já fechamos parcialmente este ticket
      bool alreadyClosed = false;
      for(int j=0; j<100; j++) { if(PartialCloses[j].ticket == ticket && PartialCloses[j].closed) { alreadyClosed = true; break; } }
      if(alreadyClosed) continue;

      if(profit >= partialTarget)
      {
         double closeVol = NormalizeDouble(vol / 2.0, 2);
         if(closeVol < 0.01) closeVol = vol; // Se muito pequeno, fecha tudo

         Print("💰 META PARCIAL ATINGIDA | ", sym, " | Ticket: ", ticket, " | Fechando 50% (", closeVol, ")");
         
         if(trade.PositionClosePartial(ticket, closeVol))
         {
            // Registar fecho parcial
            for(int j=0; j<100; j++) { if(PartialCloses[j].ticket == 0 || PartialCloses[j].ticket == ticket) { PartialCloses[j].ticket = ticket; PartialCloses[j].closed = true; break; } }
            
            // Mover para Break Even
            double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
            double currentTP = PositionGetDouble(POSITION_TP);
            trade.PositionModify(ticket, openPrice, currentTP);
            Print("🛡️ BREAK EVEN ACTIVADO para Ticket: ", ticket);
         }
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

      // CÁLCULO ATR DINÂMICO PARA TRAILING (H1 para Ouro)
      double atr = 0;
      ENUM_TIMEFRAMES atrTF = IsXAU(sym) ? PERIOD_H1 : PERIOD_M15;
      int handle = iATR(sym, atrTF, 14);
      if(handle != INVALID_HANDLE)
      {
         double buf[];
         ArraySetAsSeries(buf, true);
         if(CopyBuffer(handle, 0, 0, 1, buf) > 0) atr = buf[0];
         IndicatorRelease(handle);
      }

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
   string url = InpServerUrl + "/ea/validate?key=" + InpLicenseKey + "&account=" + (string)AccountInfoInteger(ACCOUNT_LOGIN);
   string res = SendGet(url);

   if(StringFind(res, "\"status\":\"success\"") >= 0) {
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

   // Anti-flood: Evita sobrecarregar a API
   if(TimeCurrent() - lastCheckTime < 5) return;
   
   string sym = _Symbol;

   //--- Filtros Institucionais para Busca de Sinais
   if(IsXAU(sym))
   {
      if(!IsTradingSession()) return; // Não gasta recursos fora de sessão
      
      double spread = (SymbolInfoDouble(sym, SYMBOL_ASK) - SymbolInfoDouble(sym, SYMBOL_BID)) / _Point;
      if(spread > GetMaxAllowedSpread(sym)) return;
   }

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
      
      // Adicionar à fila de execução em vez de executar direto
      AddToSignalQueue(signalJson);
      
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
   AddProcessed(signalId);

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
         if(PositionGetInteger(POSITION_MAGIC) == GetAuraMagic() && PositionGetDouble(POSITION_SL) == 0)
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
   string pair = ExtractValue(json, "pair");
   string dir  = ExtractValue(json, "direction");
   
   if(!SymbolSelect(pair, true)) {
      for(int s=0; s<SymbolsTotal(false); s++) {
         string sym = SymbolName(s, false);
         if(StringFind(sym, pair) >= 0) { pair = sym; break; }
      }
   }
   if(!SymbolSelect(pair, true)) { Print("❌ Par não encontrado: " + pair); return; }

   int atrHandle = iATR(pair, PERIOD_H1, 14);
   double atrBuffer[];
   ArraySetAsSeries(atrBuffer, true);
   double atr = 0.0010;
   if(atrHandle != INVALID_HANDLE) {
      if(CopyBuffer(atrHandle, 0, 0, 1, atrBuffer) > 0) atr = atrBuffer[0];
      IndicatorRelease(atrHandle);
   }

   double ask = SymbolInfoDouble(pair, SYMBOL_ASK);
   double bid = SymbolInfoDouble(pair, SYMBOL_BID);
   double spreadReal = ask - bid;

   if(StringFind(pair, "XAU") >= 0) {
      // REGRA OURO: Spread máximo de 80 cêntimos ($0.80)
      if(spreadReal > 0.80) { 
         Print("⚠️ Spread Ouro Inaceitável: ", DoubleToString(spreadReal, 2), " | Entrada Cancelada"); 
         return; 
      }
   } else {
      // REGRA FOREX: Normalização para 25 Pips (Broker-Agnostic)
      double pipSize = (SymbolInfoInteger(pair, SYMBOL_DIGITS) == 3 || SymbolInfoInteger(pair, SYMBOL_DIGITS) == 5) ? SymbolInfoDouble(pair, SYMBOL_POINT) * 10 : SymbolInfoDouble(pair, SYMBOL_POINT);
      double spreadPips = spreadReal / pipSize;
      if(spreadPips > 25) { 
         Print("⚠️ Spread Forex Alto: ", DoubleToString(spreadPips, 1), " pips | Entrada Cancelada"); 
         return; 
      }
   }

   double currentPrice = (dir == "BUY") ? ask : bid;
   double atrPercent = (atr / currentPrice) * 100.0;

   if(StringFind(pair, "XAU") >= 0)
   {
      if(atrPercent > 2.5) { 
         Print("⚠️ XAU volatilidade extrema (", DoubleToString(atrPercent, 2), "%) | ATR: ", DoubleToString(atr, 2)); 
         return; 
      }
   }
   else if(StringFind(pair, "JPY") >= 0)
   {
      if(atr > 1.5) { Print("⚠️ JPY volatilidade alta | ATR: ", DoubleToString(atr, 3)); return; }
   }
   else 
   {
      if(atr > 0.0050) { Print("⚠️ FX volatilidade alta | ATR: ", DoubleToString(atr, 5)); return; }
   }

   // --- EXPOSURE CONTROL (HEDGE SAFETY) ---
   int currentBuys = 0;
   int currentSells = 0;
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

   double tickSize = SymbolInfoDouble(pair, SYMBOL_TRADE_TICK_SIZE);
   int digits = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   
   double sl = 0, tp = 0;
   double maxSL = (double)((StringFind(pair, "JPY") >= 0 || StringFind(pair, "XAU") >= 0) ? InpMaxSLJPY : InpMaxSLForex);
   
   if(dir == "BUY") {
      double low = GetLastLow(pair, 20);
      sl = (low > 0) ? low - (atr * 0.5) : currentPrice - (atr * 3.0);
      double dist = (currentPrice - sl) / tickSize;
      if(dist > maxSL) { Print("⚠️ SL bloqueado (" + (string)dist + " pts)"); return; }
      double risk = GetDynamicRisk(dist);
      double lot = CalculateLot(pair, risk, currentPrice - sl, ORDER_TYPE_BUY);
      if(lot > 0) {
         trade.SetDeviationInPoints(GetDynamicDeviation(pair)); // Slippage Dinâmico
         if(trade.Buy(lot, pair, 0, 0, 0)) {
            ulong ticket = trade.ResultOrder();
            if(ticket > 0) {
               Print("🚀 Executando BUY: ", pair);
               AddToPendingQueue(ticket, sl, currentPrice + (atr * 6.0), ExtractValue(json, "id"));
            }
         }
      }
   } else {
      double high = GetLastHigh(pair, 20);
      sl = (high > 0) ? high + (atr * 0.5) : currentPrice + (atr * 3.0);
      double dist = (sl - currentPrice) / tickSize;
      if(dist > maxSL) { Print("⚠️ SL bloqueado (" + (string)dist + " pts)"); return; }
      double risk = GetDynamicRisk(dist);
      double lot = CalculateLot(pair, risk, sl - currentPrice, ORDER_TYPE_SELL);
      if(lot > 0) {
         trade.SetDeviationInPoints(GetDynamicDeviation(pair)); // Slippage Dinâmico
         if(trade.Sell(lot, pair, 0, 0, 0)) {
            ulong ticket = trade.ResultOrder();
            if(ticket > 0) {
               Print("🚀 Executando SELL: ", pair);
               AddToPendingQueue(ticket, sl, currentPrice - (atr * 6.0), ExtractValue(json, "id"));
            }
         }
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
      if(PositionSelectByTicket(ticket)) {
         if(PositionGetDouble(POSITION_SL) == 0) { 
            ApplyAsyncProtection(ticket, PendingQueue[i]);
            
            // Limpeza persistente
            GlobalVariableDel("PSL_" + (string)ticket);
            GlobalVariableDel("PTP_" + (string)ticket);
            
            RemovePendingQueueIndex(i);
         } else {
            // Já tem SL, remover da fila e do disco
            GlobalVariableDel("PSL_" + (string)ticket);
            GlobalVariableDel("PTP_" + (string)ticket);
            RemovePendingQueueIndex(i);
         }
      }
   }
}

void ApplyAsyncProtection(ulong ticket, PendingProtectionData &data) {
   if(!PositionSelectByTicket(ticket)) return;
   
   string pair = PositionGetString(POSITION_SYMBOL);
   double sl = data.sl;
   double tp = data.tp;
   int digits = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   double stopLevel = SymbolInfoInteger(pair, SYMBOL_TRADE_STOPS_LEVEL) * SymbolInfoDouble(pair, SYMBOL_POINT);
   double currentPrice = PositionGetDouble(POSITION_PRICE_CURRENT);
   
   if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) {
      if(currentPrice - sl < stopLevel) sl = currentPrice - stopLevel * 1.5;
      if(tp - currentPrice < stopLevel) tp = currentPrice + stopLevel * 1.5;
   } else {
      if(sl - currentPrice < stopLevel) sl = currentPrice + stopLevel * 1.5;
      if(currentPrice - tp < stopLevel) tp = currentPrice - stopLevel * 1.5;
   }
   
   if(trade.PositionModify(ticket, NormalizeDouble(sl, digits), NormalizeDouble(tp, digits))) {
      Print("🛡️ Ordem Protegida | Ticket: ", ticket);
      SendPost(InpServerUrl + "/ea/report", "{\"signalId\":\"" + data.signalId + "\",\"status\":\"EXECUTED\"}");
   }
}

void ProtectManualOrders()
{
   if(!InpManageManualOrders) return;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0 || !PositionSelectByTicket(ticket)) continue;
      
      string sym = PositionGetString(POSITION_SYMBOL);
      long magic = PositionGetInteger(POSITION_MAGIC);
      string comment = PositionGetString(POSITION_COMMENT);
      double sl = PositionGetDouble(POSITION_SL);

      // FILTROS INSTITUCIONAIS (Apex Guardian - MULTI-ASSET)
      if(magic != 0) continue; 
      if(sl > 0) continue; 

      // Whitelist opcional: Se o trader quiser que o bot ignore tudo o que não diga MANUAL
      // Descomentar a linha abaixo para segurança máxima
      // if(StringFind(comment, "MANUAL") < 0) continue;

      double entry = PositionGetDouble(POSITION_PRICE_OPEN);
      int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      double point = SymbolInfoDouble(sym, SYMBOL_POINT);
      
      // --- ENGINE ATR DINÂMICO (H1 para Ouro) ---
      double atr = 0;
      ENUM_TIMEFRAMES atrTF = IsXAU(sym) ? PERIOD_H1 : PERIOD_M15;
      int handle = iATR(sym, atrTF, 14);
      if(handle != INVALID_HANDLE) {
         double buf[]; ArraySetAsSeries(buf, true);
         if(CopyBuffer(handle, 0, 0, 1, buf) > 0) atr = buf[0];
         IndicatorRelease(handle);
      }
      
      // Fallback ATR (Institucional)
      if(atr <= 0) atr = (IsXAU(sym) ? 3.5 : 0.0015); 

      // Multiplicadores Profissionais (XAU: 2.0x ATR | Forex: 1.5x ATR)
      double slDist = IsXAU(sym) ? (atr * 2.0) : (atr * 1.5);
      double tpDist = slDist * 2.5; 
      
      double targetSL = 0, targetTP = 0;
      if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) {
         targetSL = entry - slDist;
         targetTP = entry + tpDist;
      } else {
         targetSL = entry + slDist;
         targetTP = entry - tpDist;
      }

      // Validação de Stop Levels e Spread
      double stopLevel = SymbolInfoInteger(sym, SYMBOL_TRADE_STOPS_LEVEL) * point;
      double bid = SymbolInfoDouble(sym, SYMBOL_BID);
      double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
      double currentPrice = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? bid : ask;
      
      if(MathAbs(currentPrice - targetSL) < stopLevel) {
         targetSL = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? currentPrice - (stopLevel * 1.5) : currentPrice + (stopLevel * 1.5);
      }

      if(trade.PositionModify(ticket, NormalizeDouble(targetSL, digits), NormalizeDouble(targetTP, digits))) {
         Print("🛡️ [GUARDIAN] Proteção ATR APEX aplicada em ", sym, " (", ticket, ") | SL: ", DoubleToString(targetSL, digits));
      } else {
         Print("⚠️ [GUARDIAN] Falha ao proteger ticket ", ticket, " | Erro: ", GetLastError());
      }
   }
}

void ReportBalance()
{
   static datetime lastReport = 0;
   if(TimeCurrent() - lastReport < 5) return; // Sincronismo a cada 5s (Institutional Real-Time)
   double balance     = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity      = AccountInfoDouble(ACCOUNT_EQUITY);
   double freeMargin  = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double margin      = AccountInfoDouble(ACCOUNT_MARGIN);
   double floatingPnL = equity - balance;

   double marginLevel = 0;
   if(margin > 0) marginLevel = (equity / margin) * 100.0;

   double drawdown = 0;
   if(balance > 0) drawdown = ((balance - equity) / balance) * 100.0;

   string payload = "{"
      "\"licenseKey\":\"" + InpLicenseKey + "\","
      "\"balance\":" + DoubleToString(balance, 2) + ","
      "\"equity\":" + DoubleToString(equity, 2) + ","
      "\"freeMargin\":" + DoubleToString(freeMargin, 2) + ","
      "\"floatingPnL\":" + DoubleToString(floatingPnL, 2) + ","
      "\"marginLevel\":" + DoubleToString(marginLevel, 2) + ","
      "\"drawdown\":" + DoubleToString(drawdown, 2) +
   "}";

   string url = InpServerUrl + "/ea/report-balance";
   string response = SendPost(url, payload);

   if(response == "") {
      int err = GetLastError();
      Print("❌ Falha ao reportar saldo | Erro MT5: ", err);
   }

   // HMI - COMENTÁRIO NO GRÁFICO
   Comment(
      "AURA V8 INSTITUCIONAL\n",
      "----------------------------------\n",
      "Conta: ", AccountInfoInteger(ACCOUNT_LOGIN), "\n",
      "Balance: $", DoubleToString(balance, 2), "\n",
      "Equity: $", DoubleToString(equity, 2), "\n",
      "Floating: $", DoubleToString(floatingPnL, 2), "\n",
      "DD Atual: ", DoubleToString(drawdown, 2), "%\n",
      "Ordens EA: ", CountAuraPositions(), "/", InpMaxOrders, "\n",
      "Status Sync: Conectado"
   );
   
   lastReport = TimeCurrent();
}

string SendPost(string url, string payload) {
   uchar post[], res[]; string headers = "Content-Type: application/json\r\n", rh;
   StringToCharArray(payload, post);
   if(WebRequest("POST", url, headers, 5000, post, res, rh) < 0) return "";
   return CharArrayToString(res);
}

string SendGet(string url) {
   uchar res[], data[]; string rh;
   if(WebRequest("GET", url, NULL, 5000, data, res, rh) < 0) return "";
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
      long baseMagic = InpMagicNumber;
      if(dealMagic < baseMagic || dealMagic > baseMagic + 100000) continue;
      
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
   if(slDist <= 0 || tSize <= 0 || tVal <= 0) return 0.01;
   
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

double GetLastLow(string sym, int bars) {
   double lows[]; ArraySetAsSeries(lows, true);
   if(CopyLow(sym, PERIOD_H1, 1, bars, lows) > 0) {
      double m = lows[0]; for(int i=1; i<ArraySize(lows); i++) if(lows[i] < m) m = lows[i]; return m;
   } return 0;
}

double GetLastHigh(string sym, int bars) {
   double highs[]; ArraySetAsSeries(highs, true);
   if(CopyHigh(sym, PERIOD_H1, 1, bars, highs) > 0) {
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
   string k = "\"" + key + "\":"; int p = StringFind(json, k); if(p < 0) return "";
   int s = p + StringLen(k); if(StringSubstr(json, s, 1) == "\"") s++;
   int e = StringFind(json, "\"", s); if(e < 0) e = StringFind(json, ",", s); if(e < 0) e = StringFind(json, "}", s);
   string r = StringSubstr(json, s, e - s); StringReplace(r, "\"", ""); StringReplace(r, " ", ""); return r;
}
