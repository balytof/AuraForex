//+------------------------------------------------------------------+
//|                                              AuraForex_V5_MASTER |
//|                                  Copyright 2026, AuraForex Corp  |
//|                                             https://auraforex.pt |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AuraForex Corp"
#property link      "https://auraforex.pt"
#property version   "5.00"
#property strict

//--- INCLUDES ---
#include <Trade\Trade.mqh>

//--- INPUT PARAMETERS ---
input string   InpLicenseKey     = "COLE_SUA_LICENCA_AQUI"; // Chave de Licença (Dashboard)
input string   InpServerUrl      = "https://www.auratradebots.com/api"; // URL do seu VPS
input double   InpRiskPercent    = 1.0;                     // % de Risco por Trade
input int      InpMagicNumber    = 888222;                  // Magic Number das Ordens
input int      InpTimerSeconds   = 2;                       // Intervalo de Checagem (Segundos)

//--- GLOBAL VARIABLES ---
CTrade         trade;
bool           IsAuthorized = false;
string         ProcessedIds[];            // Memória de sinais já executados (V5)

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("🚀 AURA V5 INSTITUCIONAL - INICIADO");
   trade.SetExpertMagicNumber(InpMagicNumber);
   
   // Tentar primeira validação imediata
   ValidateLicense();
   
   // Iniciar Timer para check contínuo
   EventSetTimer(InpTimerSeconds);
   
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { EventKillTimer(); }

// 🔥 GESTÃO INSTITUCIONAL: BREAK EVEN & TRAILING STOP
void ManagePositions()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket))
      {
         string symbol = PositionGetString(POSITION_SYMBOL);
         if(symbol != _Symbol) continue;

         double entry = PositionGetDouble(POSITION_PRICE_OPEN);
         double sl    = PositionGetDouble(POSITION_SL);
         double tp    = PositionGetDouble(POSITION_TP);
         double price = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_BID) : SymbolInfoDouble(symbol, SYMBOL_ASK);
         
         double risk = MathAbs(entry - sl);
         if(risk <= 0) continue;

         double profit = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? (price - entry) : (entry - price);
         double currentRR = profit / risk;

         // 🥇 1. BREAK EVEN (Gatilho 1.5x RR)
         if(currentRR >= 1.5)
         {
            double newSL = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? entry + (SymbolInfoDouble(symbol, SYMBOL_POINT) * 10) : entry - (SymbolInfoDouble(symbol, SYMBOL_POINT) * 10);
            
            // Só move se for para proteger mais
            if((PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY && sl < entry) || 
               (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL && (sl > entry || sl == 0)))
            {
               if(trade.PositionModify(ticket, NormalizeDouble(newSL, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)), tp))
                  Print("🛡️ Break Even aplicado para " + symbol);
            }
         }

         // 🥈 2. TRAILING STOP (Gatilho 2.2x RR)
         if(currentRR >= 2.2)
         {
            int atrHandle = iATR(symbol, PERIOD_H1, 14);
            double atrBuffer[];
            ArraySetAsSeries(atrBuffer, true);
            if(CopyBuffer(atrHandle, 0, 0, 1, atrBuffer) > 0)
            {
               double atr = atrBuffer[0];
               double trailDist = atr * 1.5; // Trailing apertado para garantir lucro
               double trailingSL = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? price - trailDist : price + trailDist;
               
               if((PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY && trailingSL > sl) || 
                  (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL && (trailingSL < sl || sl == 0)))
               {
                  trade.PositionModify(ticket, NormalizeDouble(trailingSL, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)), tp);
               }
            }
            IndicatorRelease(atrHandle);
         }
      }
   }
}

void OnTick()
{
   ManagePositions(); // Monitorização constante
   
   if(!IsNewBar()) return;
   if(!IsAuthorized) ValidateLicense();
   else CheckSignals();
}

void OnTimer()
{
   if(!IsAuthorized) ValidateLicense();
   else CheckSignals();
}

//+------------------------------------------------------------------+
//| Validar Licença via API                                          |
//+------------------------------------------------------------------+
void ValidateLicense()
{
   string url = InpServerUrl + "/ea/validate";
   string payload = "{\"licenseKey\":\"" + InpLicenseKey + "\",\"mtAccount\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\"}";
   
   Print("🔐 VALIDANDO LICENÇA...");
   string result = SendPost(url, payload);
   
   if(StringFind(result, "\"status\":\"OK\"") >= 0)
   {
      IsAuthorized = true;
      Print("✅ LICENÇA VALIDADA COM SUCESSO!");
      Comment("AURA V5 INSTITUCIONAL: ATIVO\nConta: " + (string)AccountInfoInteger(ACCOUNT_LOGIN));
   }
   else
   {
      Comment("AURA V5: AGUARDANDO VALIDAÇÃO...");
   }
}

//+------------------------------------------------------------------+
//| Buscar Sinais e Executar (LÓGICA V5 INSTITUCIONAL)               |
//+------------------------------------------------------------------+
void CheckSignals()
{
   string url = InpServerUrl + "/ea/signals?licenseKey=" + InpLicenseKey;
   string result = SendGet(url);
   
   if(result == "Error" || StringFind(result, "\"signals\":[]") >= 0) return; 

   int startPos = StringFind(result, "[");
   int endPos = StringFind(result, "]", startPos);
   if(startPos < 0 || endPos < 0) return;
   
   string signalsJson = StringSubstr(result, startPos+1, endPos-startPos-1);
   string objects[];
   int count = StringSplit(signalsJson, '}', objects);
   
   for(int i=0; i<count; i++) {
      string data = objects[i] + "}";
      string id = ExtractValue(data, "id");
      if(id == "") continue;

      // 1. Filtro de Memória (V5)
      if(IsProcessed(id)) continue;

      // 2. Executar Sinal
      ExecuteSignal(data);
      
      // 3. Marcar como Processado
      AddProcessed(id);
   }
}

bool IsProcessed(string id)
{
   for(int i=0; i<ArraySize(ProcessedIds); i++)
      if(ProcessedIds[i] == id) return true;
   return false;
}

void AddProcessed(string id)
{
   int s = ArraySize(ProcessedIds);
   ArrayResize(ProcessedIds, s + 1);
   ProcessedIds[s] = id;
}

// 🥇 1. SL BASEADO EM ESTRUTURA (HIGH/LOW)
double GetLastSwingLow(string symbol, int barsBack = 20)
{
   double lows[];
   ArraySetAsSeries(lows, true);
   if(CopyLow(symbol, _Period, 1, barsBack, lows) > 0)
   {
      double minLow = lows[0];
      for(int i=1; i<ArraySize(lows); i++)
         if(lows[i] < minLow) minLow = lows[i];
      return minLow;
   }
   return 0;
}

double GetLastSwingHigh(string symbol, int barsBack = 20)
{
   double highs[];
   ArraySetAsSeries(highs, true);
   if(CopyHigh(symbol, _Period, 1, barsBack, highs) > 0)
   {
      double maxHigh = highs[0];
      for(int i=1; i<ArraySize(highs); i++)
         if(highs[i] > maxHigh) maxHigh = highs[i];
      return maxHigh;
   }
   return 0;
}

// 🥉 3. TP BASEADO EM LIQUIDEZ (SIMPLES)
double GetLiquidityTargetBuy(string symbol, int barsBack = 30)
{
   double highs[];
   ArraySetAsSeries(highs, true);
   if(CopyHigh(symbol, _Period, 1, barsBack, highs) > 0)
   {
      double maxHigh = highs[0];
      for(int i=1; i<ArraySize(highs); i++)
         if(highs[i] > maxHigh) maxHigh = highs[i];
      return maxHigh;
   }
   return 0;
}

double GetLiquidityTargetSell(string symbol, int barsBack = 30)
{
   double lows[];
   ArraySetAsSeries(lows, true);
   if(CopyLow(symbol, _Period, 1, barsBack, lows) > 0)
   {
      double minLow = lows[0];
      for(int i=1; i<ArraySize(lows); i++)
         if(lows[i] < minLow) minLow = lows[i];
      return minLow;
   }
   return 0;
}

void ExecuteSignal(string json)
{
   string pair = ExtractValue(json, "pair");
   string dir  = ExtractValue(json, "direction");
   double lot  = StringToDouble(ExtractValue(json, "lot"));

   // Garantir símbolo correto
   if(!SymbolSelect(pair, true)) {
      for(int s=0; s<SymbolsTotal(false); s++) {
         string sym = SymbolName(s, false);
         if(StringFind(sym, pair) >= 0) { pair = sym; break; }
      }
   }
   SymbolSelect(pair, true);

   // 🔥 SOLUÇÃO 3: ATR CALCULADO LOCALMENTE (INSTITUCIONAL)
   int atrHandle = iATR(pair, PERIOD_H1, 14);
   double atrBuffer[];
   ArraySetAsSeries(atrBuffer, true);
   double atr = 0;
   
   if(atrHandle != INVALID_HANDLE && CopyBuffer(atrHandle, 0, 0, 1, atrBuffer) > 0)
   {
      atr = atrBuffer[0];
      Print("📊 ATR calculado localmente para " + pair + ": " + DoubleToString(atr, 5));
   }
   
   // 🛡️ SOLUÇÃO 2: FALLBACK DEFENSIVO
   if(atr <= 0)
   {
      Print("⚠️ ATR indisponível. Usando fallback para " + pair);
      if(StringFind(pair, "JPY") >= 0)
         atr = 0.05;
      else if(StringFind(pair, "XAU") >= 0)
         atr = 5.0;
      else
         atr = 0.0010;
   }
   
   if(atrHandle != INVALID_HANDLE) IndicatorRelease(atrHandle);

   int digits = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);

   // --- PASSO 1: ENTRADA LIMPA ---
   bool opened = (dir == "BUY") ? trade.Buy(lot, pair, 0, 0, 0) : trade.Sell(lot, pair, 0, 0, 0);

   if(!opened) {
      Print("❌ Falha ao abrir ordem para " + pair + " | Erro: " + (string)GetLastError());
      return;
   }

   Print("✅ Ordem aberta para " + pair + ". Aplicando SL/TP com ATR=" + DoubleToString(atr, 5));

   // --- PASSO 2: AGUARDAR POSIÇÃO ---
   ulong ticket = 0;
   for(int i=0; i<10; i++) {
      if(PositionSelect(pair)) {
         ticket = PositionGetInteger(POSITION_TICKET);
         break;
      }
      Sleep(200);
   }

   if(ticket == 0) {
      Print("❌ Não encontrou posição ativa para " + pair);
      return;
   }

   // --- PASSO 3: HIERARQUIA PROFISSIONAL (V5 MASTER FINAL) ---
   double price = PositionGetDouble(POSITION_PRICE_OPEN);
   double sl = 0, tp = 0;
   double safetyBuffer = atr * 0.5; // 🥈 2. ATR (AJUSTE FINO)
   
   if(dir == "BUY") {
      // 🥇 1. SL BASEADO EM ESTRUTURA
      double structuralSL = GetLastSwingLow(pair, 20); 
      sl = structuralSL - safetyBuffer;
      
      // Sanidade: Evitar stops absurdos ou colados
      if(price - sl > atr * 3.5) sl = price - (atr * 2.5);
      if(price - sl < atr * 1.5) sl = price - (atr * 1.5);
      
      // 🥉 3. TP BASEADO EM LIQUIDEZ
      tp = GetLiquidityTargetBuy(pair, 30);
      
      // ⚖️ VALIDAÇÃO R:R MÍNIMO 1:2
      double slDist = price - sl;
      if((tp - price) < (slDist * 2.0)) tp = price + (slDist * 2.5);
   } else {
      // 🥇 1. SL BASEADO EM ESTRUTURA
      double structuralSL = GetLastSwingHigh(pair, 20);
      sl = structuralSL + safetyBuffer;
      
      // Sanidade
      if(sl - price > atr * 3.5) sl = price + (atr * 2.5);
      if(sl - price < atr * 1.5) sl = price + (atr * 1.5);
      
      // 🥉 3. TP BASEADO EM LIQUIDEZ
      tp = GetLiquidityTargetSell(pair, 30);
      
      // ⚖️ VALIDAÇÃO R:R MÍNIMO 1:2
      double slDist = sl - price;
      if((price - tp) < (slDist * 2.0)) tp = price - (slDist * 2.5);
   }

   // --- PASSO 4: VALIDAR STOPLEVEL ---
   double stopLevel = SymbolInfoInteger(pair, SYMBOL_TRADE_STOPS_LEVEL) * _Point;
   if(MathAbs(price - sl) < stopLevel)
      sl = (dir == "BUY") ? price - stopLevel : price + stopLevel;
   if(MathAbs(price - tp) < stopLevel)
      tp = (dir == "BUY") ? price + stopLevel : price - stopLevel;

   sl = NormalizeDouble(sl, digits);
   tp = NormalizeDouble(tp, digits);

   // --- PASSO 5: APLICAR COM RETRY ---
   bool modified = false;
   for(int t=0; t<3; t++) {
      if(trade.PositionModify(ticket, sl, tp)) {
         modified = true;
         break;
      }
      Sleep(300);
   }

   if(modified) {
      Print("🛡️ SL/TP aplicado: SL=" + DoubleToString(sl, digits) + " TP=" + DoubleToString(tp, digits));
      SendPost(InpServerUrl + "/ea/report", "{\"signalId\":\"" + ExtractValue(json, "id") + "\",\"status\":\"EXECUTED\"}");
   } else {
      Print("❌ Falha ao aplicar SL/TP para " + pair + " | Erro: " + (string)GetLastError());
   }
}

string SendPost(string url, string payload) {
   uchar post[], res[]; string headers = "Content-Type: application/json\r\n", rh;
   StringToCharArray(payload, post);
   if(WebRequest("POST", url, headers, 5000, post, res, rh) < 0) return "Error";
   return CharArrayToString(res);
}

string SendGet(string url) {
   uchar res[], data[]; string rh;
   if(WebRequest("GET", url, "", 5000, data, res, rh) < 0) return "Error";
   return CharArrayToString(res);
}

string ExtractValue(string json, string key) {
   string k = "\"" + key + "\":";
   int p = StringFind(json, k);
   if(p < 0) return "";
   int s = p + StringLen(k);
   if(StringSubstr(json, s, 1) == "\"") s++;
   int e = StringFind(json, "\"", s);
   if(e < 0) e = StringFind(json, ",", s);
   if(e < 0) e = StringFind(json, "}", s);
   string r = StringSubstr(json, s, e - s);
   StringReplace(r, "\"", ""); StringReplace(r, " ", ""); return r;
}
