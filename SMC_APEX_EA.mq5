//+------------------------------------------------------------------+
//|                                              SMC_APEX_EA.mq5     |
//|                                  Copyright 2026, AuraForex Corp  |
//|                                             https://auraforex.pt |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AuraForex Corp"
#property link      "https://auraforex.pt"
#property version   "2.00"
#property strict

//--- INCLUDES ---
#include <Trade\Trade.mqh>

//--- INPUT PARAMETERS ---
input string   InpLicenseKey     = "COLE_SUA_LICENCA_AQUI"; // Chave de Licença
input string   InpServerUrl      = "http://localhost:3005"; // URL da API
input double   InpRiskPercent    = 1.0;                     // % de Risco
input double   InpTPRR           = 1.5;                     // Risk:Reward
input int      InpMagicNumber    = 888222;                  // Magic Number
input int      InpTimerSeconds   = 2;                       // Checagem (Segundos)

//--- GLOBAL VARIABLES ---
CTrade         trade;
bool           IsAuthorized = false;

int OnInit() {
   Print("== SMC APEX EA v2.0 - INICIALIZANDO ==");
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(50); // Evita "Off Quotes"
   EventSetTimer(InpTimerSeconds);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
   EventKillTimer();
   Print("== SMC APEX EA - DESLIGADO ==");
}

void OnTimer() {
   if(!IsAuthorized) ValidateLicense();
   else { CheckForSignals(); ReportAccountStatus(); }
}

void ValidateLicense() {
   string url = InpServerUrl + "/ea/validate";
   string payload = "{\"licenseKey\":\"" + InpLicenseKey + "\",\"mtAccount\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\"}";
   string result = SendPost(url, payload);
   if(StringFind(result, "\"status\":\"OK\"") >= 0) {
      IsAuthorized = true;
      Print("✅ LICENÇA OK!");
   }
}

void CheckForSignals() {
   string url = InpServerUrl + "/ea/signals?licenseKey=" + InpLicenseKey;
   string result = SendGet(url);
   if(StringFind(result, "\"signals\":[]") >= 0) return;
   
   int startPos = StringFind(result, "[");
   int endPos = StringFind(result, "]", startPos);
   if(startPos < 0 || endPos < 0) return;
   
   string signalsJson = StringSubstr(result, startPos+1, endPos-startPos-1);
   string objects[];
   int count = StringSplit(signalsJson, '}', objects);
   for(int i=0; i<count; i++) {
      if(StringFind(objects[i], "\"id\"") >= 0) ExecuteSignal(objects[i] + "}");
   }
}

void ExecuteSignal(string json) {
   string signalId = ExtractJsonValue(json, "id");
   string pair     = ExtractJsonValue(json, "pair");
   string direction = ExtractJsonValue(json, "direction");
   double sl       = StringToDouble(ExtractJsonValue(json, "sl"));
   double tp       = StringToDouble(ExtractJsonValue(json, "tp"));
   double lot      = StringToDouble(ExtractJsonValue(json, "lot"));

   Print("📥 SINAL RECEBIDO: " + pair + " " + direction + " SL: " + (string)sl + " TP: " + (string)tp);

   double ask = SymbolInfoDouble(pair, SYMBOL_ASK);
   double bid = SymbolInfoDouble(pair, SYMBOL_BID);
   double point = SymbolInfoDouble(pair, SYMBOL_POINT);
   double price = (direction == "BUY") ? ask : bid;
   int digits = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   double minDistance = SymbolInfoInteger(pair, SYMBOL_TRADE_STOPS_LEVEL) * point;

   if(price <= 0) {
      Print("❌ ERRO: Par " + pair + " não está no Market Watch!");
      return;
   }

   // --- PROTEÇÃO DE SANIDADE ---
   bool isInvalid = (sl <= 0);
   if(!isInvalid && pair != "XAUUSD" && pair != "GOLD") {
      if(MathAbs(price - sl) > (price * 0.03)) isInvalid = true;
   } else if(!isInvalid) {
      if(MathAbs(price - sl) > (price * 0.15)) isInvalid = true;
   }

   if(isInvalid) {
      Print("⚠️ SL Inválido (Mock Data). Recalculando...");
      double delta = 200 * point;
      if(pair == "XAUUSD" || pair == "GOLD") delta = 600 * point;
      sl = (direction == "BUY") ? price - delta : price + delta;
   }

   if(tp <= 0) {
      double delta = MathAbs(price - sl) * InpTPRR;
      tp = (direction == "BUY") ? price + delta : price - delta;
   }

   // Respeitar StopLevel
   if(direction == "BUY") {
      if((price - sl) < minDistance) sl = price - minDistance - (5 * point);
      if((tp - price) < minDistance) tp = price + minDistance + (5 * point);
   } else {
      if((sl - price) < minDistance) sl = price + minDistance + (5 * point);
      if((price - tp) < minDistance) tp = price - minDistance - (5 * point);
   }

   // Normalização de Tick
   double tick = SymbolInfoDouble(pair, SYMBOL_TRADE_TICK_SIZE);
   if(tick > 0) {
      sl = MathRound(sl/tick)*tick; tp = MathRound(tp/tick)*tick; price = MathRound(price/tick)*tick;
   }

   Print("🛠️ DIAGNÓSTICO: Preço=" + (string)price + " SL=" + (string)sl + " TP=" + (string)tp);

   bool res = (direction == "BUY") ? trade.Buy(lot, pair, price, sl, tp) : trade.Sell(lot, pair, price, sl, tp);
   
   if(res && (trade.ResultRetcode()==10008 || trade.ResultRetcode()==10009)) {
      Print("✅ SUCESSO: Ordem " + (string)trade.ResultOrder());
      ReportSignalStatus(signalId, "EXECUTED", (long)trade.ResultOrder());
   } else {
      Print("❌ ERRO: " + trade.ResultRetcodeDescription() + " Cod: " + (string)trade.ResultRetcode());
      ReportSignalStatus(signalId, "FAILED", 0);
   }
}

string ExtractJsonValue(string json, string key) {
   string s = "\"" + key + "\":";
   int p = StringFind(json, s);
   if(p<0) return "";
   int start = p + StringLen(s);
   if(StringSubstr(json, start, 1) == "\"") start++;
   int end = StringFind(json, ",", start);
   if(end<0) end = StringFind(json, "}", start);
   string res = StringSubstr(json, start, end-start);
   return StringReplace(res, "\"", "");
}

string SendPost(string url, string payload) {
   uchar p[], r[]; string h = "Content-Type: application/json\r\n", rh;
   StringToCharArray(payload, p);
   if(WebRequest("POST", url, h, 5000, p, r, rh) < 0) return "";
   return CharArrayToString(r);
}

string SendGet(string url) {
   uchar r[], d[]; string rh;
   if(WebRequest("GET", url, "", 5000, d, r, rh) < 0) return "";
   return CharArrayToString(r);
}

void ReportSignalStatus(string id, string st, long tk) {
   string url = InpServerUrl + "/ea/report";
   string payload = "{\"signalId\":\"" + id + "\",\"status\":\"" + st + "\",\"orderTicket\":\"" + (string)tk + "\"}";
   SendPost(url, payload);
}

void ReportAccountStatus() {
   string url = InpServerUrl + "/ea/report-balance";
   string payload = "{\"licenseKey\":\"" + InpLicenseKey + "\",\"balance\":" + (string)AccountInfoDouble(ACCOUNT_BALANCE) + "}";
   SendPost(url, payload);
}
                                                                           