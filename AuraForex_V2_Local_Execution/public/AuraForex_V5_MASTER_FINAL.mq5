//+------------------------------------------------------------------+
//|                                              AuraForex_V5_MASTER |
//|                                  Copyright 2026, AuraForex Corp  |
//|                                             https://auraforex.pt |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AuraForex Corp"
#property link      "https://auraforex.pt"
#property version   "5.01"
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
   
   // Primeira tentativa de validação
   ValidateLicense();
   
   EventSetTimer(InpTimerSeconds);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { EventKillTimer(); }

void OnTick()
{
   if(!IsNewBar()) return;
   if(!IsAuthorized) ValidateLicense();
   else CheckSignals();
}

void OnTimer()
{
   if(!IsAuthorized) ValidateLicense();
   else CheckSignals();
}

// --- CORE FUNCTIONS ---

void ValidateLicense()
{
   string url = InpServerUrl + "/ea/validate";
   string payload = "{\"licenseKey\":\"" + InpLicenseKey + "\",\"mtAccount\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\"}";
   
   Print("🔐 VALIDANDO LICENÇA...");
   string result = SendPost(url, payload);
   
   if(StringFind(result, "\"status\":\"OK\"") >= 0) {
      IsAuthorized = true;
      Print("✅ LICENÇA VALIDADA COM SUCESSO!");
      Comment("AURA V5 INSTITUCIONAL: ATIVO\nConta: " + (string)AccountInfoInteger(ACCOUNT_LOGIN));
   } else if(result != "") {
      Print("❌ FALHA NA LICENÇA: " + result);
   }
}

void CheckSignals()
{
   string url = InpServerUrl + "/ea/signals?licenseKey=" + InpLicenseKey;
   string result = SendGet(url);
   
   if(result == "" || StringFind(result, "\"signals\":[]") >= 0) return; 

   int startPos = StringFind(result, "[");
   int endPos = StringFind(result, "]", startPos);
   if(startPos < 0 || endPos < 0) return;
   
   string signalsJson = StringSubstr(result, startPos+1, endPos-startPos-1);
   string objects[];
   int count = StringSplit(signalsJson, '}', objects);
   
   for(int i=0; i<count; i++) {
      string obj = objects[i] + "}";
      string id = ExtractValue(obj, "id");
      if(id != "" && !IsProcessed(id)) { 
         ExecuteSignal(obj); 
         AddProcessed(id); 
      }
   }
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
   if(!SymbolSelect(pair, true)) return;

   int atrHandle = iATR(pair, PERIOD_H1, 14);
   double atrBuffer[];
   ArraySetAsSeries(atrBuffer, true);
   double atr = 0.0010;
   if(atrHandle != INVALID_HANDLE) {
      if(CopyBuffer(atrHandle, 0, 0, 1, atrBuffer) > 0) atr = atrBuffer[0];
      IndicatorRelease(atrHandle);
   }

   double volLimit = (StringFind(pair, "JPY") >= 0 || StringFind(pair, "XAU") >= 0) ? 0.8 : 0.0020;
   if(atr > volLimit) {
      Print("⚠️ Volatilidade alta em " + pair + ". Sinal ignorado.");
      return;
   }

   double ask = SymbolInfoDouble(pair, SYMBOL_ASK);
   double bid = SymbolInfoDouble(pair, SYMBOL_BID);
   double currentPrice = (dir == "BUY") ? ask : bid;
   double tickSize = SymbolInfoDouble(pair, SYMBOL_TRADE_TICK_SIZE);
   int digits = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   
   double sl = 0, tp = 0;
   double maxSL = (StringFind(pair, "JPY") >= 0 || StringFind(pair, "XAU") >= 0) ? (double)InpMaxSLJPY : (double)InpMaxSLForex;
   
   if(dir == "BUY") {
      double low = GetLastLow(pair, 20);
      sl = (low > 0) ? low - (atr * 0.5) : currentPrice - (atr * 3.0);
      double dist = (currentPrice - sl) / tickSize;
      if(dist > maxSL) {
         Print("⚠️ SL muito grande (" + (string)dist + " pts) em " + pair);
         return;
      }
      double risk = GetDynamicRisk(dist);
      double lot = CalculateLot(pair, risk, currentPrice - sl, ORDER_TYPE_BUY);
      if(lot > 0) {
         if(trade.Buy(lot, pair, ask, NormalizeDouble(sl, digits), NormalizeDouble(currentPrice + (atr * 6.0), digits)))
            Print("🚀 COMPRA EXECUTADA: " + pair + " Lote: " + DoubleToString(lot, 2));
      }
   } else {
      double high = GetLastHigh(pair, 20);
      sl = (high > 0) ? high + (atr * 0.5) : currentPrice + (atr * 3.0);
      double dist = (sl - currentPrice) / tickSize;
      if(dist > maxSL) {
         Print("⚠️ SL muito grande (" + (string)dist + " pts) em " + pair);
         return;
      }
      double risk = GetDynamicRisk(dist);
      double lot = CalculateLot(pair, risk, sl - currentPrice, ORDER_TYPE_SELL);
      if(lot > 0) {
         if(trade.Sell(lot, pair, bid, NormalizeDouble(sl, digits), NormalizeDouble(currentPrice - (atr * 6.0), digits)))
            Print("🚀 VENDA EXECUTADA: " + pair + " Lote: " + DoubleToString(lot, 2));
      }
   }
}

// --- COMMUNICATION HELPERS ---

string SendPost(string url, string payload) {
   uchar post[], res[]; string headers = "Content-Type: application/json\r\n", rh;
   StringToCharArray(payload, post);
   ResetLastError();
   int resCode = WebRequest("POST", url, headers, 5000, post, res, rh);
   if(resCode < 0) {
      Print("🌐 Erro WebRequest (POST): " + (string)GetLastError());
      return "";
   }
   return CharArrayToString(res);
}

string SendGet(string url) {
   uchar res[], data[]; string rh;
   ResetLastError();
   int resCode = WebRequest("GET", url, "", 5000, data, res, rh);
   if(resCode < 0) {
      if(GetLastError() != 4014) // Ignorar erro de URL não listada se já logado
         Print("🌐 Erro WebRequest (GET): " + (string)GetLastError());
      return "";
   }
   return CharArrayToString(res);
}

// --- UTILS ---

double GetDynamicRisk(double pts) {
   if(pts > 300) return 0.3; if(pts > 200) return 0.5; return 1.0;
}

double CalculateLot(string sym, double riskPercent, double slDist, ENUM_ORDER_TYPE type) {
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskVal = balance * (riskPercent / 100.0);
   double tVal = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
   double tSize = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
   if(slDist <= 0 || tSize <= 0 || tVal <= 0) return 0.01;
   
   double lot = riskVal / ((slDist / tSize) * tVal);
   double minL = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double maxL = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
   double step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   lot = MathMax(minL, MathMin(maxL, MathFloor(lot/step)*step));
   if(lot < minL) lot = minL;

   double margin = 0;
   double p = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(sym, SYMBOL_ASK) : SymbolInfoDouble(sym, SYMBOL_BID);
   if(OrderCalcMargin(type, sym, lot, p, margin)) {
      if(margin > AccountInfoDouble(ACCOUNT_FREEMARGIN)) {
         Print("⚠️ Margem insuficiente para " + sym + ". Necessário: " + DoubleToString(margin, 2));
         return 0;
      }
   }
   return NormalizeDouble(lot, 2);
}

double GetLastLow(string sym, int bars) {
   double lows[]; ArraySetAsSeries(lows, true);
   if(CopyLow(sym, _Period, 1, bars, lows) > 0) {
      double m = lows[0]; for(int i=1; i<ArraySize(lows); i++) if(lows[i] < m) m = lows[i]; return m;
   } return 0;
}

double GetLastHigh(string sym, int bars) {
   double highs[]; ArraySetAsSeries(highs, true);
   if(CopyHigh(sym, _Period, 1, bars, highs) > 0) {
      double m = highs[0]; for(int i=1; i<ArraySize(highs); i++) if(highs[i] > m) m = highs[i]; return m;
   } return 0;
}

bool IsNewBar() {
   static datetime last; datetime curr = (datetime)SeriesInfoInteger(_Symbol, _Period, SERIES_LASTBAR_DATE);
   if(curr != last) { last = curr; return true; } return false;
}

bool IsProcessed(string id) {
   for(int i=0; i<ArraySize(ProcessedIds); i++) if(ProcessedIds[i] == id) return true; return false;
}

void AddProcessed(string id) {
   int s = ArraySize(ProcessedIds); ArrayResize(ProcessedIds, s+1); ProcessedIds[s] = id;
}

string ExtractValue(string json, string key) {
   string k = "\"" + key + "\":"; int p = StringFind(json, k); if(p < 0) return "";
   int s = p + StringLen(k); if(StringSubstr(json, s, 1) == "\"") s++;
   int e = StringFind(json, "\"", s); if(e < 0) e = StringFind(json, ",", s); if(e < 0) e = StringFind(json, "}", s);
   string r = StringSubstr(json, s, e - s); StringReplace(r, "\"", ""); StringReplace(r, " ", ""); return r;
}
