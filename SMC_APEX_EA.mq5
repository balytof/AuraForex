//+------------------------------------------------------------------+
//|                                              SMC_APEX_EA.mq5     |
//|                                  Copyright 2026, AuraForex Corp  |
//|                                             https://auraforex.pt |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AuraForex Corp"
#property link      "https://auraforex.pt"
#property version   "1.00"
#property strict

//--- INCLUDES ---
#include <Trade\Trade.mqh>

//--- INPUT PARAMETERS ---
input string   InpLicenseKey     = "COLE_SUA_LICENCA_AQUI"; // Chave de Licena (Dashboard)
input string   InpServerUrl      = "http://localhost:3005"; // URL do Servidor API
input double   InpRiskPercent    = 1.0;                     // % de Risco por Trade
input double   InpTPRR           = 2.0;                     // Take Profit (Risk:Reward)
input int      InpMagicNumber    = 888222;                  // Magic Number das Ordens
input int      InpTimerSeconds   = 2;                       // Intervalo de Checagem (Segundos)

//--- GLOBAL VARIABLES ---
CTrade         trade;
bool           IsAuthorized = false;
string         EAVersion = "v1.0.0-PRO";

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("== SMC APEX EA - INICIALIZANDO ==");
   
   // Configurar Magic Number e Slippage (50 pontos para evitar off quotes)
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(50);
   
   // Validar URL (Remover / final se existir)
   string url = InpServerUrl;
   if(StringSubstr(url, StringLen(url)-1, 1) == "/") 
      url = StringSubstr(url, 0, StringLen(url)-1);
   
   // Primeiro Timer para Validar Licena
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

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // Nada aqui, usamos Timer para no travar em momentos de baixa liquidez
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(!IsAuthorized)
   {
      ValidateLicense();
   }
   else
   {
      CheckForSignals();
      ReportAccountStatus();
   }
}

//+------------------------------------------------------------------+
//| Validar Licena via API                                          |
//+------------------------------------------------------------------+
void ValidateLicense()
{
   string url = InpServerUrl + "/ea/validate";
   string payload = "{\"licenseKey\":\"" + InpLicenseKey + "\",\"mtAccount\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\"}";
   
   string result = SendPost(url, payload);
   
   if(StringFind(result, "\"status\":\"OK\"") >= 0)
   {
      IsAuthorized = true;
      Print("✅ LICENA VALIDADA COM SUCESSO! Bem-vindo.");
      Comment("SMC APEX EA: ATIVO\nLicena: OK\nConta: " + (string)AccountInfoInteger(ACCOUNT_LOGIN));
   }
   else
   {
      Print("❌ FALHA NA VALIDAO: " + result);
      Comment("SMC APEX EA: BLOQUEADO\nErro: Verifique a Licena no Dashboard.");
   }
}

//+------------------------------------------------------------------+
//| Buscar Sinais Pendentes no Servidor                              |
//+------------------------------------------------------------------+
void CheckForSignals()
{
   string url = InpServerUrl + "/ea/signals?licenseKey=" + InpLicenseKey;
   string result = SendGet(url);
   
   if(StringFind(result, "\"signals\":[]") >= 0) return; // Sem sinais novos
   
   // Debug
   // Print("Sinais Recebidos: " + result);
   
   // Parse MANUAL SIMPLES (Para no depender de bibliotecas externas complexas)
   // Procuramos por blocos de sinais
   int startPos = StringFind(result, "[");
   int endPos = StringFind(result, "]", startPos);
   if(startPos < 0 || endPos < 0) return;
   
   string signalsJson = StringSubstr(result, startPos+1, endPos-startPos-1);
   
   // Dividir sinais por objeto {}
   string objects[];
   int count = StringSplit(signalsJson, '}', objects);
   
   for(int i=0; i<count; i++)
   {
      string sigData = objects[i];
      if(StringFind(sigData, "\"id\"") < 0) continue;
      
      ExecuteSignal(sigData);
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
   
   // --- AJUSTE PROFISSIONAL DE SL/TP (RESPEITANDO STOPLEVEL) ---
   double ask = SymbolInfoDouble(pair, SYMBOL_ASK);
   double bid = SymbolInfoDouble(pair, SYMBOL_BID);
   double point = SymbolInfoDouble(pair, SYMBOL_POINT);
   int stopLevel = (int)SymbolInfoInteger(pair, SYMBOL_TRADE_STOPS_LEVEL);
   double minDistance = stopLevel * point;
   int digits = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   
   double price = (direction == "BUY") ? ask : bid;
   
   // --- VALIDAÇÃO DE MARKET WATCH ---
   if(price <= 0) {
      Print("❌ ERRO: O par " + pair + " não está no Market Watch ou preço indisponível.");
      ReportSignalStatus(signalId, "FAILED_NO_PRICE", 0);
      return;
   }
   
   // --- VALIDAÇÃO DE SANIDADE (ANTI-MOCK DATA) ---
   // Se o SL estiver negativo, for 0, ou estiver absurdamente longe do preço (mais de 2% para forex)
   bool isInvalid = (sl <= 0);
   if(!isInvalid && pair != "XAUUSD" && pair != "GOLD") {
      if(MathAbs(price - sl) > (price * 0.02)) isInvalid = true;
   } else if(!isInvalid) { // Para Ouro/Metais
      if(MathAbs(price - sl) > (price * 0.10)) isInvalid = true; 
   }

   if(isInvalid) {
      Print("⚠️ SL Inválido detectado. Recalculando Stop Loss real...");
      double delta = 200 * point; // 20 pips padrão
      if(pair == "XAUUSD" || pair == "GOLD") delta = 500 * point; // $5.00 para Ouro
      
      if(direction == "BUY") sl = price - delta;
      else sl = price + delta;
   }
   
   // Validação similar para TP
   if(tp <= 0 || MathAbs(price - tp) > (price * 0.20)) {
      double delta = 400 * point; // 40 pips padrão
      if(pair == "XAUUSD" || pair == "GOLD") delta = 1000 * point; // $10.00 para Ouro
      
      if(direction == "BUY") tp = price + delta;
      else tp = price - delta;
   }

   // Garantir distncia mnima do StopLevel exigida pela corretora
   if(direction == "BUY") {
      if((price - sl) < minDistance) sl = price - minDistance - (10 * point);
      if((tp - price) < minDistance) tp = price + minDistance + (10 * point);
   } else {
      if((sl - price) < minDistance) sl = price + minDistance + (10 * point);
      if((price - tp) < minDistance) tp = price - minDistance - (10 * point);
   }
   
   // Normalização Final baseada no TickSize (Mais preciso para Ouro/Índices)
   double tickSize = SymbolInfoDouble(pair, SYMBOL_TRADE_TICK_SIZE);
   if(tickSize > 0) {
      sl = MathRound(sl / tickSize) * tickSize;
      tp = MathRound(tp / tickSize) * tickSize;
      price = MathRound(price / tickSize) * tickSize;
   }
   
   sl = NormalizeDouble(sl, digits);
   tp = NormalizeDouble(tp, digits);
   price = NormalizeDouble(price, digits);

   Print("🛠️ DIAGNÓSTICO: Preço=" + (string)price + " SL=" + (string)sl + " TP=" + (string)tp + " MinDist=" + (string)minDistance);

   bool res = false;
   if(direction == "BUY")
      res = trade.Buy(lot, pair, price, sl, tp, "AuraForex Signal");
   else if(direction == "SELL")
      res = trade.Sell(lot, pair, price, sl, tp, "AuraForex Signal");
      
   if(res && (trade.ResultRetcode() == TRADE_RETCODE_DONE || trade.ResultRetcode() == TRADE_RETCODE_PLACED))
   {
      ulong ticket = trade.ResultOrder();
      Print("✅ ORDEM EXECUTADA: " + (string)ticket + " sl: " + (string)sl + " tp: " + (string)tp);
      ReportSignalStatus(signalId, "EXECUTED", (long)ticket);
   }
   else
   {
      string errDesc = trade.ResultRetcodeDescription();
      int errCode = (int)trade.ResultRetcode();
      Print("❌ FALHA: " + errDesc + " (Código: " + (string)errCode + ") SL: " + (string)sl + " TP: " + (string)tp);
      ReportSignalStatus(signalId, "FAILED", 0);
   }
}

//+------------------------------------------------------------------+
//| Reportar Status da Execução para o Servidor                      |
//+------------------------------------------------------------------+
void ReportSignalStatus(string sigId, string status, long ticket)
{
   string url = InpServerUrl + "/ea/report";
   string payload = "{\"signalId\":\"" + sigId + "\",\"status\":\"" + status + "\",\"orderTicket\":\"" + (string)ticket + "\"}";
   SendPost(url, payload);
}

//+------------------------------------------------------------------+
//| Reportar Saldo da Conta                                          |
//+------------------------------------------------------------------+
void ReportAccountStatus()
{
   string url = InpServerUrl + "/ea/report-balance";
   string payload = "{\"licenseKey\":\"" + InpLicenseKey + "\",\"balance\":" + (string)AccountInfoDouble(ACCOUNT_BALANCE) + ",\"equity\":" + (string)AccountInfoDouble(ACCOUNT_EQUITY) + "}";
   SendPost(url, payload);
}

//+------------------------------------------------------------------+
//| FUNÇÕES AUXILIARES DE REDE E PARSING                             |
//+------------------------------------------------------------------+

string SendPost(string url, string payload)
{
   uchar post[], result[];
   string headers = "Content-Type: application/json\r\n";
   StringToCharArray(payload, post);
   string result_headers;
   int res = WebRequest("POST", url, headers, 5000, post, result, result_headers); 
   if(res == -1) return "Error";
   return CharArrayToString(result);
}

string SendGet(string url)
{
   uchar result[], dummy[];
   string result_headers;
   int res = WebRequest("GET", url, "", 5000, dummy, result, result_headers);
   if(res == -1) return "Error";
   return CharArrayToString(result);
}

string ExtractJsonValue(string json, string key)
{
   string searchKey = "\"" + key + "\":";
   int pos = StringFind(json, searchKey);
   if(pos < 0) return "";
   
   int valStart = pos + StringLen(searchKey);
   
   // Se comear com ", pular
   bool isString = false;
   if(StringSubstr(json, valStart, 1) == "\"")
   {
      valStart++;
      isString = true;
   }
   
   int valEnd = -1;
   if(isString)
      valEnd = StringFind(json, "\"", valStart);
   else
   {
      valEnd = StringFind(json, ",", valStart);
      if(valEnd < 0) valEnd = StringFind(json, "}", valStart);
   }
   
   if(valEnd < 0) return "";
   
   return StringSubstr(json, valStart, valEnd - valStart);
}
