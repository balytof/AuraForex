//+------------------------------------------------------------------+
//|                                              SMC_APEX_EA.mq5     |
//|                                  Copyright 2026, AuraForex Corp  |
//|                                             https://auraforex.pt |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AuraForex Corp"
#property link      "https://auraforex.pt"
#property version   "2.02"
#property strict

#include <Trade\Trade.mqh>

// --- INPUTS COM IP DO VPS ---
input string   InpLicenseKey     = "COLE_SUA_LICENCA_AQUI"; 
input string   InpServerUrl      = "http://139.59.159.48:3005"; // IP DO SEU VPS
input double   InpRiskPercent    = 1.0;                     
input double   InpTPRR           = 1.5;                     
input int      InpMagicNumber    = 888222;                  
input int      InpTimerSeconds   = 2;                       

CTrade         trade;
bool           IsAuthorized = false;
string         EAVersion = "v2.0.2-VPS";

int OnInit() {
   Print("== SMC APEX EA v2.0.2 - CONECTANDO AO VPS [" + InpServerUrl + "] ==");
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(50);
   EventSetTimer(InpTimerSeconds);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { EventKillTimer(); }
void OnTick() {}

void OnTimer() {
   if(!IsAuthorized) ValidateLicense();
   else CheckForSignals();
}

void ValidateLicense() {
   string url = InpServerUrl + "/ea/validate";
   string payload = "{\"licenseKey\":\"" + InpLicenseKey + "\",\"mtAccount\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\"}";
   string result = SendPost(url, payload);
   
   if(StringFind(result, "\"status\":\"OK\"") >= 0) {
      IsAuthorized = true;
      Print("✅ LIGADO AO VPS COM SUCESSO!");
   } else {
      Print("❌ ERRO AO LIGAR AO VPS: " + result);
      Comment("SMC APEX EA: ERRO DE REDE\nVerifique se o VPS [" + InpServerUrl + "] está ativo.");
   }
}

void CheckForSignals() {
   string url = InpServerUrl + "/ea/signals?licenseKey=" + InpLicenseKey;
   string result = SendGet(url);
   
   if(result == "Error") return;
   if(StringFind(result, "\"signals\":[]") >= 0) return;

   Print("🚀 SINAL RECEBIDO DO VPS: " + result);
   
   int startPos = StringFind(result, "[");
   int endPos = StringFind(result, "]", startPos);
   if(startPos < 0 || endPos < 0) return;
   
   string signalsJson = StringSubstr(result, startPos+1, endPos-startPos-1);
   string objects[];
   int count = StringSplit(signalsJson, '}', objects);
   
   for(int i=0; i<count; i++) {
      string sigData = objects[i];
      if(StringFind(sigData, "\"id\"") < 0) continue;
      ExecuteSignal(sigData + "}");
   }
}

void ExecuteSignal(string json) {
   string pair = ExtractJsonValue(json, "pair");
   string direction = ExtractJsonValue(json, "direction");
   string signalId = ExtractJsonValue(json, "id");
   double entry = StringToDouble(ExtractJsonValue(json, "entry"));
   double sl = StringToDouble(ExtractJsonValue(json, "sl"));
   double tp = StringToDouble(ExtractJsonValue(json, "tp"));
   double lot = StringToDouble(ExtractJsonValue(json, "lot"));

   Print("📥 EXECUTANDO: " + pair + " " + direction + " SL:" + (string)sl + " TP:" + (string)tp);
   
   double ask = SymbolInfoDouble(pair, SYMBOL_ASK);
   double bid = SymbolInfoDouble(pair, SYMBOL_BID);
   double price = (direction == "BUY") ? ask : bid;
   
   if(price <= 0) {
      Print("❌ Par " + pair + " não está no Market Watch!");
      return;
   }

   // Normalização por TickSize (Expert v2.0)
   int digits = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   double tickSize = SymbolInfoDouble(pair, SYMBOL_TRADE_TICK_SIZE);
   if(tickSize > 0) {
      sl = NormalizeDouble(MathRound(sl/tickSize)*tickSize, digits);
      tp = NormalizeDouble(MathRound(tp/tickSize)*tickSize, digits);
      price = NormalizeDouble(MathRound(price/tickSize)*tickSize, digits);
   }

   bool res = (direction == "BUY") ? trade.Buy(lot, pair, price, sl, tp) : trade.Sell(lot, pair, price, sl, tp);
   
   if(res) {
      Print("✅ ORDEM ABERTA: " + pair + " Ticket: " + (string)trade.ResultOrder());
      ReportSignalStatus(signalId, "EXECUTED", (long)trade.ResultOrder());
   } else {
      Print("❌ ERRO AO ABRIR: " + trade.ResultRetcodeDescription());
   }
}

//--- WEB UTILS ---
string SendPost(string url, string payload) {
   uchar post[], result[]; string headers = "Content-Type: application/json\r\n", res_h;
   StringToCharArray(payload, post);
   ResetLastError();
   if(WebRequest("POST", url, headers, 5000, post, result, res_h) < 0) return "Error";
   return CharArrayToString(result);
}

string SendGet(string url) {
   uchar result[], dummy[]; string res_h;
   ResetLastError();
   if(WebRequest("GET", url, "", 5000, dummy, result, res_h) < 0) return "Error";
   return CharArrayToString(result);
}

string ExtractJsonValue(string json, string key) {
   string searchKey = "\"" + key + "\":";
   int pos = StringFind(json, searchKey);
   if(pos < 0) return "";
   int valStart = pos + StringLen(searchKey);
   if(StringSubstr(json, valStart, 1) == "\"") valStart++;
   int valEnd = StringFind(json, ",", valStart);
   if(valEnd < 0) valEnd = StringFind(json, "}", valStart);
   string res = StringSubstr(json, valStart, valEnd - valStart);
   return StringReplace(res, "\"", "");
}

void ReportSignalStatus(string sigId, string status, long ticket) {
   string url = InpServerUrl + "/ea/report";
   string payload = "{\"signalId\":\"" + sigId + "\",\"status\":\"" + status + "\",\"orderTicket\":\"" + (string)ticket + "\"}";
   SendPost(url, payload);
}