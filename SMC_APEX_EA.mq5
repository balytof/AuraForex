//+------------------------------------------------------------------+
//|                                              SMC_APEX_EA.mq5     |
//|                                  Copyright 2026, AuraForex Corp  |
//|                                             https://auraforex.pt |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AuraForex Corp"
#property link      "https://auraforex.pt"
#property version   "2.01"
#property strict

#include <Trade\Trade.mqh>

input string   InpLicenseKey     = "COLE_SUA_LICENCA_AQUI"; 
input string   InpServerUrl      = "http://localhost:3005"; 
input double   InpRiskPercent    = 1.0;                     
input double   InpTPRR           = 1.5;                     
input int      InpMagicNumber    = 888222;                  
input int      InpTimerSeconds   = 2;                       

CTrade         trade;
bool           IsAuthorized = false;
string         EAVersion = "v2.0.1-DIAG";

int OnInit() {
   Print("== SMC APEX EA v2.0.1 - DIAGNÓSTICO ATIVO ==");
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
      Print("✅ CONEXÃO ESTABELECIDA! Licença OK.");
   } else {
      Print("❌ ERRO DE CONEXÃO: " + result);
      Comment("SMC APEX EA: ERRO DE CONEXÃO\nVerifique a URL e a Licença.");
   }
}

void CheckForSignals() {
   string url = InpServerUrl + "/ea/signals?licenseKey=" + InpLicenseKey;
   string result = SendGet(url);
   
   // LOG DE DIAGNÓSTICO
   if(result == "Error") {
      Print("📡 Erro de Rede: Não foi possível contactar o servidor em " + InpServerUrl);
      return;
   }
   
   if(StringFind(result, "\"signals\":[]") >= 0) {
      // Print("🔎 Sem sinais pendentes no momento..."); // Silencioso para não encher o log
      return;
   }

   Print("🚀 RESPOSTA DO SERVIDOR: " + result);
   
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
   double sl = StringToDouble(ExtractJsonValue(json, "sl"));
   double tp = StringToDouble(ExtractJsonValue(json, "tp"));
   double lot = StringToDouble(ExtractJsonValue(json, "lot"));

   Print("📥 EXECUTANDO SINAL: " + pair + " " + direction + " ID:" + signalId);
   
   double price = (direction == "BUY") ? SymbolInfoDouble(pair, SYMBOL_ASK) : SymbolInfoDouble(pair, SYMBOL_BID);
   
   if(price <= 0) {
      Print("❌ Erro: Par " + pair + " não encontrado no Market Watch!");
      return;
   }

   // Normalização e Sanidade (Código Expert v2.0)
   int digits = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   double tickSize = SymbolInfoDouble(pair, SYMBOL_TRADE_TICK_SIZE);
   
   sl = NormalizeDouble(MathRound(sl/tickSize)*tickSize, digits);
   tp = NormalizeDouble(MathRound(tp/tickSize)*tickSize, digits);
   price = NormalizeDouble(MathRound(price/tickSize)*tickSize, digits);

   bool res = (direction == "BUY") ? trade.Buy(lot, pair, price, sl, tp) : trade.Sell(lot, pair, price, sl, tp);
   
   if(res) {
      Print("✅ SUCESSO: Ordem aberta para " + pair);
      ReportSignalStatus(signalId, "EXECUTED", (long)trade.ResultOrder());
   } else {
      Print("❌ FALHA AO ABRIR: " + trade.ResultRetcodeDescription());
   }
}

//--- WEB UTILS ---
string SendPost(string url, string payload) {
   uchar post[], result[]; string headers = "Content-Type: application/json\r\n", res_h;
   StringToCharArray(payload, post);
   ResetLastError();
   if(WebRequest("POST", url, headers, 5000, post, result, res_h) < 0) return "Error " + (string)GetLastError();
   return CharArrayToString(result);
}

string SendGet(string url) {
   uchar result[], dummy[]; string res_h;
   ResetLastError();
   if(WebRequest("GET", url, "", 5000, dummy, result, res_h) < 0) return "Error " + (string)GetLastError();
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