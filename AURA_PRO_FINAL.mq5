//+------------------------------------------------------------------+
//|                                              AURA_PRO_FINAL.mq5  |
//|                                  Copyright 2026, AuraForex Corp  |
//|                                             https://auraforex.pt |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AuraForex Corp"
#property link      "https://auraforex.pt"
#property version   "3.00"
#property strict

//--- INCLUDES ---
#include <Trade\Trade.mqh>

//--- INPUT PARAMETERS ---
input string   InpLicenseKey     = "COLE_SUA_LICENCA_AQUI"; // Chave de Licença (Dashboard)
input string   InpServerUrl      = "http://139.59.159.48:3005"; // URL do Servidor VPS
input double   InpRiskPercent    = 1.0;                     // % de Risco por Trade

input int      InpMagicNumber    = 888222;                  // Magic Number das Ordens
input int      InpTimerSeconds   = 2;                       // Intervalo de Checagem (Segundos)

//--- GLOBAL VARIABLES ---
CTrade         trade;
bool           IsAuthorized = false;
string         ExtProcessedIds[];         // Memória de sinais já executados

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("🚀 AURA PRO FINAL v3.0 - INICIADO");
   
   // Configurar Magic Number
   trade.SetExpertMagicNumber(InpMagicNumber);
   
   // Tentar primeira validação imediata
   ValidateLicense();
   
   // Iniciar Timer para check contínuo
   EventSetTimer(InpTimerSeconds);

   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("== AURA PRO FINAL - DESLIGADO ==");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // Nada aqui, usamos Timer
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
   }
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
   Print("🔐 RESPOSTA LICENSE: ", result);
   
   if(StringFind(result, "\"status\":\"OK\"") >= 0)
   {
      IsAuthorized = true;
      Print("✅ LICENÇA VALIDADA COM SUCESSO!");
      Comment("AURA PRO FINAL: ATIVO\nLicença: OK\nConta: " + (string)AccountInfoInteger(ACCOUNT_LOGIN));
   }
   else
   {
      Print("❌ FALHA NA VALIDAÇÃO: " + result);
      Comment("AURA PRO FINAL: BLOQUEADO\nVerifique a Licença.");
   }
}

//+------------------------------------------------------------------+
//| Buscar Sinais Pendentes no Servidor                              |
//+------------------------------------------------------------------+
void CheckForSignals()
{
   string url = InpServerUrl + "/ea/signals?licenseKey=" + InpLicenseKey;
   
   string result = SendGet(url);
   
   if(result == "Error" || StringFind(result, "\"signals\":[]") >= 0) return; 
   
   // Parse blocos de sinais
   int startPos = StringFind(result, "[");
   int endPos = StringFind(result, "]", startPos);
   if(startPos < 0 || endPos < 0) return;
   
   string signalsJson = StringSubstr(result, startPos+1, endPos-startPos-1);
   string objects[];
   int count = StringSplit(signalsJson, '}', objects);
   
   for(int i=0; i<count; i++) {
      string sigData = objects[i];
      if(StringFind(sigData, "\"id\"") < 0) continue;
      if(StringSubstr(sigData, 0, 1) == ",") sigData = StringSubstr(sigData, 1);
      
      string fullJson = sigData + "}";
      string id = ExtractJsonValue(fullJson, "id");
      string pair = ExtractJsonValue(fullJson, "pair");
      
      // --- EXPERT FILTERING ---
      // 1. Verificar se o sinal é para este par (Evita ordens duplicadas em múltiplos gráficos)
      if(StringFind(_Symbol, pair) < 0 && StringFind(pair, _Symbol) < 0) continue;
      
      // 2. Verificar se já processamos este ID
      bool alreadyDone = false;
      for(int j=0; j<ArraySize(ExtProcessedIds); j++) {
         if(ExtProcessedIds[j] == id) { alreadyDone = true; break; }
      }
      if(alreadyDone) continue;

      // Executar e guardar ID
      ExecuteSignal(fullJson);
      
      int size = ArraySize(ExtProcessedIds);
      ArrayResize(ExtProcessedIds, size + 1);
      ExtProcessedIds[size] = id;
      
      // Limpeza de memória (mantém apenas os últimos 50 IDs)
      if(ArraySize(ExtProcessedIds) > 50) {
         for(int k=0; k<49; k++) ExtProcessedIds[k] = ExtProcessedIds[k+1];
         ArrayResize(ExtProcessedIds, 50);
      }
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
   double sl       = StringToDouble(ExtractJsonValue(json, "sl"));
   double tp       = StringToDouble(ExtractJsonValue(json, "tp"));
   double lot      = StringToDouble(ExtractJsonValue(json, "lot"));

   Print("🚀 PROCESSANDO SINAL: " + pair + " " + direction + " Lot: " + (string)lot);
   
   // Garantir que o símbolo está ativo e resolver sufixos
   if(!SymbolSelect(pair, true)) {
      for(int s=0; s<SymbolsTotal(false); s++) {
         string sym = SymbolName(s, false);
         if(StringFind(sym, pair) >= 0) { pair = sym; break; }
      }
   }
   SymbolSelect(pair, true);
   Sleep(300);

   // Proteção de Lote
   if(lot <= 0) {
      lot = SymbolInfoDouble(pair, SYMBOL_VOLUME_MIN);
      Print("⚠️ Lot corrigido para o mínimo: ", lot);
   }

   double price = (direction == "BUY") ? SymbolInfoDouble(pair, SYMBOL_ASK) : SymbolInfoDouble(pair, SYMBOL_BID);
   bool res = false;

   if(direction == "BUY")
      res = trade.Buy(lot, pair, price, sl, tp, "AuraPro Signal");
   else if(direction == "SELL")
      res = trade.Sell(lot, pair, price, sl, tp, "AuraPro Signal");
      
   if(!res)
   {
      Print("❌ ERRO ORDEM: ", trade.ResultRetcode(), " | ", trade.ResultRetcodeDescription());
      ReportSignalStatus(signalId, "FAILED", 0);
   }
   else
   {
      ulong ticket = trade.ResultOrder();
      Print("✅ ORDEM EXECUTADA! Ticket: " + (string)ticket);
      ReportSignalStatus(signalId, "EXECUTED", (long)ticket);
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
//| FUNÇÕES DE REDE E PARSING                                        |
//+------------------------------------------------------------------+

string SendPost(string url, string p) {
   uchar post[], res[];
   string h = "Content-Type: application/json\r\n", rh;
   StringToCharArray(p, post);
   int code = WebRequest("POST", url, h, 5000, post, res, rh);
   if(code < 0) { Print("❌ POST ERROR: ", GetLastError()); return "Error"; }
   return CharArrayToString(res);
}

string SendGet(string url) {
   uchar res[], d[];
   string rh;
   int code = WebRequest("GET", url, "", 5000, d, res, rh);
   if(code < 0) { Print("❌ GET ERROR: ", GetLastError()); return "Error"; }
   return CharArrayToString(res);
}

string ExtractJsonValue(string json, string key) {
   string k = "\"" + key + "\":";
   int p = StringFind(json, k);
   if(p < 0) return "";
   int s = p + StringLen(k);
   while(s < StringLen(json) && (StringSubstr(json, s, 1) == " " || StringSubstr(json, s, 1) == "\"")) s++;
   int e = StringFind(json, "\"", s); 
   if(e < 0) e = StringFind(json, ",", s); 
   if(e < 0) e = StringFind(json, "}", s); 
   if(e < 0 || e <= s) return "";
   string res = StringSubstr(json, s, e - s);
   StringReplace(res, "\"", "");
   StringReplace(res, " ", "");
   StringReplace(res, "}", "");
   StringReplace(res, "]", "");
   return res;
}
