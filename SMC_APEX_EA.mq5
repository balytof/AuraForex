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
input string   InpLicenseKey     = "COLE_SUA_LICENCA_AQUI"; // Chave de Licença (Dashboard)
input string   InpServerUrl      = "http://localhost:3005"; // URL do Servidor API
input double   InpRiskPercent    = 1.0;                     // % de Risco por Trade
input double   InpTPRR           = 1.5;                     // Take Profit (Risk:Reward)
input int      InpMagicNumber    = 888222;                  // Magic Number das Ordens
input int      InpTimerSeconds   = 2;                       // Intervalo de Checagem (Segundos)

//--- GLOBAL VARIABLES ---
CTrade         trade;
bool           IsAuthorized = false;
string         EAVersion = "v2.0.0-FIXED";

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("== SMC APEX EA v2.0 - INICIALIZANDO ==");
   
   // Configurar Magic Number e Slippage (50 pontos para evitar off quotes)
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(50);
   
   // Primeiro Timer para Validar Licença
   EventSetTimer(InpTimerSeconds);
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("== SMC APEX EA - DESLIGADO ==");
}

void OnTick() {}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(!IsAuthorized) ValidateLicense();
   else {
      CheckForSignals();
      ReportAccountStatus();
   }
}

//+------------------------------------------------------------------+
//| Validar Licença via API                                          |
//+------------------------------------------------------------------+
void ValidateLicense()
{
   string url = InpServerUrl + "/ea/validate";
   string payload = "{\"licenseKey\":\"" + InpLicenseKey + "\",\"mtAccount\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\"}";
   
   string result = SendPost(url, payload);
   
   if(StringFind(result, "\"status\":\"OK\"") >= 0)
   {
      IsAuthorized = true;
      Print("✅ LICENÇA VALIDADA COM SUCESSO! Versão: " + EAVersion);
      Comment("SMC APEX EA: ATIVO\nVersão: " + EAVersion + "\nConta: " + (string)AccountInfoInteger(ACCOUNT_LOGIN));
   }
   else
   {
      Print("❌ FALHA NA VALIDAÇÃO: " + result);
      Comment("SMC APEX EA: BLOQUEADO\nErro: Verifique a Licença no Dashboard.");
   }
}

//+------------------------------------------------------------------+
//| Buscar Sinais Pendentes no Servidor                              |
//+------------------------------------------------------------------+
void CheckForSignals()
{
   string url = InpServerUrl + "/ea/signals?licenseKey=" + InpLicenseKey;
   string result = SendGet(url);
   
   if(StringFind(result, "\"signals\":[]") >= 0) return; 
   
   int startPos = StringFind(result, "[");
   int endPos = StringFind(result, "]", startPos);
   if(startPos < 0 || endPos < 0) return;
   
   string signalsJson = StringSubstr(result, startPos+1, endPos-startPos-1);
   string objects[];
   int count = StringSplit(signalsJson, '}', objects);
   
   for(int i=0; i<count; i++)
   {
      string sigData = objects[i];
      if(StringFind(sigData, "\"id\"") < 0) continue;
      ExecuteSignal(sigData + "}");
   }
}

//+------------------------------------------------------------------+
//| Executar Ordem baseada no JSON do sinal                          |
//+------------------------------------------------------------------+
void ExecuteSignal(string json)
{
   string signalId = ExtractJsonValue(json, "id");
   string pair     = ExtractJsonValue(json, "pair");
   string direction = ExtractJsonValue(json, "direction");
   double entry    = StringToDouble(ExtractJsonValue(json, "entry"));
   double sl       = StringToDouble(ExtractJsonValue(json, "sl"));
   double tp       = StringToDouble(ExtractJsonValue(json, "tp"));
   double lot      = StringToDouble(ExtractJsonValue(json, "lot"));

   Print("📥 SINAL RECEBIDO: " + pair + " " + direction + " SL: " + (string)sl + " TP: " + (string)tp);
   
   double ask = SymbolInfoDouble(pair, SYMBOL_ASK);
   double bid = SymbolInfoDouble(pair, SYMBOL_BID);
   double point = SymbolInfoDouble(pair, SYMBOL_POINT);
   int stopLevel = (int)SymbolInfoInteger(pair, SYMBOL_TRADE_STOPS_LEVEL);
   double minDistance = stopLevel * point;
   int digits = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   
   double price = (direction == "BUY") ? ask : bid;
   
   if(price <= 0) {
      Print("❌ ERRO: O par " + pair + " não está no Market Watch!");
      return;
   }
   
   // --- VALIDAÇÃO DE SANIDADE (ANTI-MOCK DATA) ---
   bool isInvalid = (sl <= 0);
   if(!isInvalid && pair != "XAUUSD" && pair != "GOLD") {
      if(MathAbs(price - sl) > (price * 0.03)) isInvalid = true;
   } else if(!isInvalid) {
      if(MathAbs(price - sl) > (price * 0.15)) isInvalid = true; 
   }

   if(isInvalid) {
      Print("⚠️ SL Inválido detectado. Recalculando Stop Loss real...");
      double delta = 200 * point; 
      if(pair == "XAUUSD" || pair == "GOLD") delta = 600 * point;
      sl = (direction == "BUY") ? price - delta : price + delta;
   }
   
   if(tp <= 0 || MathAbs(price - tp) > (price * 0.20)) {
      double delta = MathAbs(price - sl) * InpTPRR;
      tp = (direction == "BUY") ? price + delta : price - delta;
   }

   // Garantir distância mínima do StopLevel
   if(direction == "BUY") {
      if((price - sl) < minDistance) sl = price - minDistance - (5 * point);
      if((tp - price) < minDistance) tp = price + minDistance + (5 * point);
   } else {
      if((sl - price) < minDistance) sl = price + minDistance + (5 * point);
      if((price - tp) < minDistance) tp = price - minDistance - (5 * point);
   }
   
   // Normalização por TickSize
   double tickSize = SymbolInfoDouble(pair, SYMBOL_TRADE_TICK_SIZE);
   if(tickSize > 0) {
      sl = MathRound(sl / tickSize) * tickSize;
      tp = MathRound(tp / tickSize) * tickSize;
      price = MathRound(price / tickSize) * tickSize;
   }
   
   sl = NormalizeDouble(sl, digits);
   tp = NormalizeDouble(tp, digits);
   price = NormalizeDouble(price, digits);

   Print("🛠️ DIAGNÓSTICO: Preço=" + (string)price + " SL=" + (string)sl + " TP=" + (string)tp);

   bool res = (direction == "BUY") ? trade.Buy(lot, pair, price, sl, tp) : trade.Sell(lot, pair, price, sl, tp);
      
   if(res && (trade.ResultRetcode() == 10008 || trade.ResultRetcode() == 10009))
   {
      Print("✅ ORDEM EXECUTADA: " + (string)trade.ResultOrder());
      ReportSignalStatus(signalId, "EXECUTED", (long)trade.ResultOrder());
   }
   else
   {
      Print("❌ FALHA: " + trade.ResultRetcodeDescription() + " SL: " + (string)sl + " TP: " + (string)tp);
      ReportSignalStatus(signalId, "FAILED", 0);
   }
}

//--- AUXILIARES ---
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

string SendPost(string url, string payload) {
   uchar post[], result[]; string headers = "Content-Type: application/json\r\n", res_h;
   StringToCharArray(payload, post);
   if(WebRequest("POST", url, headers, 5000, post, result, res_h) < 0) return "Error";
   return CharArrayToString(result);
}

string SendGet(string url) {
   uchar result[], dummy[]; string res_h;
   if(WebRequest("GET", url, "", 5000, dummy, result, res_h) < 0) return "Error";
   return CharArrayToString(result);
}

void ReportSignalStatus(string sigId, string status, long ticket) {
   string url = InpServerUrl + "/ea/report";
   string payload = "{\"signalId\":\"" + sigId + "\",\"status\":\"" + status + "\",\"orderTicket\":\"" + (string)ticket + "\"}";
   SendPost(url, payload);
}

void ReportAccountStatus() {
   string url = InpServerUrl + "/ea/report-balance";
   string payload = "{\"licenseKey\":\"" + InpLicenseKey + "\",\"balance\":" + (string)AccountInfoDouble(ACCOUNT_BALANCE) + "}";
   SendPost(url, payload);
}
