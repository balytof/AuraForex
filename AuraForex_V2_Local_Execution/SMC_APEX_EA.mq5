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
   
   // Configurar Magic Number
   trade.SetExpertMagicNumber(InpMagicNumber);
   
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
   
   for(int i=0; i<count; i++) {
      string sigData = objects[i];
      if(StringFind(sigData, "\"id\"") < 0) continue;
      if(StringSubstr(sigData, 0, 1) == ",") sigData = StringSubstr(sigData, 1);
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

   Print("🚀 PROCESSANDO SINAL: " + pair + " " + direction + " Lot: " + (string)lot);
   
   bool res = false;
   if(direction == "BUY")
      res = trade.Buy(lot, pair, SymbolInfoDouble(pair, SYMBOL_ASK), sl, tp, "AuraForex Signal");
   else if(direction == "SELL")
      res = trade.Sell(lot, pair, SymbolInfoDouble(pair, SYMBOL_BID), sl, tp, "AuraForex Signal");
      
   if(res)
   {
      ulong ticket = trade.ResultOrder();
      Print("✅ ORDEM EXECUTADA! Ticket: " + (string)ticket);
      ReportSignalStatus(signalId, "EXECUTED", (long)ticket);
   }
   else
   {
      Print("❌ FALHA AO EXECUTAR: " + trade.ResultRetcodeDescription());
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

string ExtractJsonValue(string json, string key) {
   string k = "\"" + key + "\":";
   int p = StringFind(json, k);
   if(p < 0) return "";
   
   int s = p + StringLen(k);
   
   // Pular espaços em branco e aspas iniciais
   while(s < StringLen(json) && (StringSubstr(json, s, 1) == " " || StringSubstr(json, s, 1) == "\"")) s++;
   
   int e = StringFind(json, "\"", s); // Tenta achar aspas de fechamento
   if(e < 0) e = StringFind(json, ",", s); 
   if(e < 0) e = StringFind(json, "}", s); 
   
   if(e < 0 || e <= s) return "";
   
   string res = StringSubstr(json, s, e - s);
   
   // Limpeza final de caracteres residuais (sem usar retorno de StringReplace)
   StringReplace(res, "\"", "");
   StringReplace(res, " ", "");
   StringReplace(res, "}", "");
   StringReplace(res, "]", "");
   
   return res;
}
