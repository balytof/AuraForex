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
input int      InpMaxSLForex     = 700;                     // Limite SL Forex (Pontos)
input int      InpMaxSLJPY       = 2000;                    // Limite SL JPY/Ouro (Pontos)

//--- GLOBAL VARIABLES ---
CTrade         trade;
bool           IsAuthorized = false;
string         ProcessedIds[];

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("🚀 AURA V5 INSTITUCIONAL - INICIADO");
   trade.SetExpertMagicNumber(InpMagicNumber);
   ValidateLicense();
   EventSetTimer(InpTimerSeconds);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { EventKillTimer(); }

// --- HELPER FUNCTIONS ---
bool IsNewBar()
{
   static datetime lastBar;
   datetime currentBar = (datetime)SeriesInfoInteger(_Symbol, _Period, SERIES_LASTBAR_DATE);
   if(currentBar != lastBar) { lastBar = currentBar; return true; }
   return false;
}

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

         if(currentRR >= 1.5)
         {
            double newSL = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? entry + (SymbolInfoDouble(symbol, SYMBOL_POINT) * 10) : entry - (SymbolInfoDouble(symbol, SYMBOL_POINT) * 10);
            if((PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY && sl < entry) || (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL && (sl > entry || sl == 0)))
               trade.PositionModify(ticket, NormalizeDouble(newSL, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)), tp);
         }
      }
   }
}

void ApplyBreakEven(double triggerRR = 1.0)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket))
      {
         if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
         double entry = PositionGetDouble(POSITION_PRICE_OPEN);
         double sl    = PositionGetDouble(POSITION_SL);
         double tp    = PositionGetDouble(POSITION_TP);
         double price = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         double risk = MathAbs(entry - sl);
         if(risk <= 0) continue;
         if((PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? (price - entry) : (entry - price)) >= risk * triggerRR)
         {
            if((PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY && sl < entry) || (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL && (sl > entry || sl == 0)))
               trade.PositionModify(ticket, entry, tp);
         }
      }
   }
}

void OnTick()
{
   ApplyBreakEven(1.0);
   if(!IsNewBar()) return;
   if(!IsAuthorized) ValidateLicense();
   else CheckSignals();
}

void OnTimer()
{
   if(!IsAuthorized) ValidateLicense();
   else CheckSignals();
}

void ValidateLicense()
{
   string url = InpServerUrl + "/ea/validate";
   string payload = "{\"licenseKey\":\"" + InpLicenseKey + "\",\"mtAccount\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\"}";
   string result = SendPost(url, payload);
   if(StringFind(result, "\"status\":\"OK\"") >= 0) {
      IsAuthorized = true;
      Comment("AURA V5 INSTITUCIONAL: ATIVO\nConta: " + (string)AccountInfoInteger(ACCOUNT_LOGIN));
   }
}

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
      if(id != "" && !IsProcessed(id)) { ExecuteSignal(data); AddProcessed(id); }
   }
}

bool IsProcessed(string id) { for(int i=0; i<ArraySize(ProcessedIds); i++) if(ProcessedIds[i] == id) return true; return false; }
void AddProcessed(string id) { int s = ArraySize(ProcessedIds); ArrayResize(ProcessedIds, s + 1); ProcessedIds[s] = id; }

double GetLastSwingLow(string symbol, int barsBack = 20) {
   double lows[]; ArraySetAsSeries(lows, true);
   if(CopyLow(symbol, _Period, 1, barsBack, lows) > 0) {
      double minLow = lows[0]; for(int i=1; i<ArraySize(lows); i++) if(lows[i] < minLow) minLow = lows[i]; return minLow;
   } return 0;
}

double GetLastSwingHigh(string symbol, int barsBack = 20) {
   double highs[]; ArraySetAsSeries(highs, true);
   if(CopyHigh(symbol, _Period, 1, barsBack, highs) > 0) {
      double maxHigh = highs[0]; for(int i=1; i<ArraySize(highs); i++) if(highs[i] > maxHigh) maxHigh = highs[i]; return maxHigh;
   } return 0;
}

double GetDynamicRisk(double slPoints) {
   if(slPoints > 300) return 0.3; if(slPoints > 200) return 0.5; return 1.0;                   
}

double CalculateLotSmart(string symbol, double riskPercent, double slDist) {
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double risk = balance * (riskPercent / 100.0);
   double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
   if(slDist <= 0 || tickSize <= 0 || tickValue <= 0) return 0.01;
   double costPerLot = (slDist / tickSize) * tickValue;
   double lot = risk / costPerLot;
   double minLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double step   = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   lot = MathMax(minLot, MathMin(maxLot, lot));
   lot = MathFloor(lot / step) * step;
   if(lot < minLot) lot = minLot; 
   return NormalizeDouble(lot, 2);
}

double AdjustLotToMargin(string symbol, ENUM_ORDER_TYPE type, double lot) {
   double marginRequired = 0; double freeMargin = AccountInfoDouble(ACCOUNT_FREEMARGIN);
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK); double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   double price = (type == ORDER_TYPE_BUY) ? ask : bid;
   if(price <= 0) price = SymbolInfoDouble(symbol, SYMBOL_LAST);
   double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP); double minLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   while(lot >= minLot) {
      if(OrderCalcMargin(type, symbol, lot, price, marginRequired)) {
         if(marginRequired <= freeMargin) return lot;
         if(lot <= minLot) Print("⚠️ Margem insuficiente para Lote Mínimo. Necessário: " + (string)marginRequired + " | Livre: " + (string)freeMargin);
      }
      lot -= step; lot = NormalizeDouble(lot, 2);
   } return 0;
}

void ExecuteSignal(string json) {
   string pair = ExtractValue(json, "pair"); string dir  = ExtractValue(json, "direction");
   if(!SymbolSelect(pair, true)) {
      for(int s=0; s<SymbolsTotal(false); s++) {
         string sym = SymbolName(s, false); if(StringFind(sym, pair) >= 0) { pair = sym; break; }
      }
   }
   SymbolSelect(pair, true);
   int atrHandle = iATR(pair, PERIOD_H1, 14); double atrBuffer[]; ArraySetAsSeries(atrBuffer, true);
   double atr = (atrHandle != INVALID_HANDLE && CopyBuffer(atrHandle, 0, 0, 1, atrBuffer) > 0) ? atrBuffer[0] : 0.0010;
   if(atrHandle != INVALID_HANDLE) IndicatorRelease(atrHandle);

   double volLimit = (StringFind(pair, "JPY") >= 0 || StringFind(pair, "XAU") >= 0) ? 0.8 : 0.0020;
   if(atr > volLimit) return;

   int digits = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS); double tickSize = SymbolInfoDouble(pair, SYMBOL_TRADE_TICK_SIZE);
   double currentPrice = (dir == "BUY") ? SymbolInfoDouble(pair, SYMBOL_ASK) : SymbolInfoDouble(pair, SYMBOL_BID);
   double sl = 0, tp = 0; double safetyBuffer = atr * 0.5;
   double maxSL = (StringFind(pair, "JPY") >= 0 || StringFind(pair, "XAU") >= 0) ? InpMaxSLJPY : InpMaxSLForex;
   
   if(dir == "BUY") {
      double structuralSL = GetLastSwingLow(pair, 20); if(structuralSL <= 0) structuralSL = currentPrice - (atr * 3.0); 
      sl = structuralSL - safetyBuffer;
      double slDistPoints = (currentPrice - sl) / tickSize;
      if(slDistPoints > maxSL) return;
      double dynamicRisk = GetDynamicRisk(slDistPoints);
      double slDist = currentPrice - sl;
      double lot = AdjustLotToMargin(pair, ORDER_TYPE_BUY, CalculateLotSmart(pair, dynamicRisk, slDist));
      if(lot > 0) trade.Buy(lot, pair, 0, NormalizeDouble(sl, digits), NormalizeDouble(currentPrice + (slDist * 2.0), digits));
   } else {
      double structuralSL = GetLastSwingHigh(pair, 20); if(structuralSL <= 0) structuralSL = currentPrice + (atr * 3.0);
      sl = structuralSL + safetyBuffer;
      double slDistPoints = (sl - currentPrice) / tickSize;
      if(slDistPoints > maxSL) return;
      double dynamicRisk = GetDynamicRisk(slDistPoints);
      double slDist = sl - currentPrice;
      double lot = AdjustLotToMargin(pair, ORDER_TYPE_SELL, CalculateLotSmart(pair, dynamicRisk, slDist));
      if(lot > 0) trade.Sell(lot, pair, 0, NormalizeDouble(sl, digits), NormalizeDouble(currentPrice - (slDist * 2.0), digits));
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
   string k = "\"" + key + "\":"; int p = StringFind(json, k); if(p < 0) return "";
   int s = p + StringLen(k); if(StringSubstr(json, s, 1) == "\"") s++;
   int e = StringFind(json, "\"", s); if(e < 0) e = StringFind(json, ",", s); if(e < 0) e = StringFind(json, "}", s);
   string r = StringSubstr(json, s, e - s); StringReplace(r, "\"", ""); StringReplace(r, " ", ""); return r;
}
