//+------------------------------------------------------------------+
//|                                              SMC_APEX_EA.mq5     |
//|                                  Copyright 2026, AuraForex Corp  |
//|                                             https://auraforex.pt |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AuraForex Corp"
#property link      "https://auraforex.pt"
#property version   "4.00"
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
string         ExtProcessedIds[];         // Memória de sinais já executados (V4)

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("🚀 SMC APEX EA v4.0 MAGIC - INICIADO");
   trade.SetExpertMagicNumber(InpMagicNumber);
   
   // Tentar primeira validação imediata
   ValidateLicense();
   
   // Iniciar Timer para check contínuo
   EventSetTimer(InpTimerSeconds);
   
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { EventKillTimer(); }
void OnTick() {}

void OnTimer()
{
   if(!IsAuthorized) ValidateLicense();
   else CheckForSignals();
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
      Comment("SMC APEX V4 MAGIC: ATIVO\nConta: " + (string)AccountInfoInteger(ACCOUNT_LOGIN));
   }
   else
   {
      Comment("SMC APEX V4: AGUARDANDO VALIDAÇÃO...");
   }
}

//+------------------------------------------------------------------+
//| Buscar Sinais e Executar (LÓGICA V4 MAGIC MULTI-USER)            |
//+------------------------------------------------------------------+
void CheckForSignals()
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
      string sigData = objects[i];
      if(StringFind(sigData, "\"id\"") < 0) continue;
      if(StringSubstr(sigData, 0, 1) == ",") sigData = StringSubstr(sigData, 1);
      
      string fullJson = sigData + "}";
      string id = ExtractJsonValue(fullJson, "id");
      string pair = ExtractJsonValue(fullJson, "pair");

      // 1. Verificar se o sinal é para este par (Filtro de Gráfico)
      if(StringFind(_Symbol, pair) < 0 && StringFind(pair, _Symbol) < 0) continue;

      // 2. Filtro de Memória (V4)
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
   }
}

void ExecuteSignal(string json)
{
   string signalId = ExtractJsonValue(json, "id");
   string pair     = ExtractJsonValue(json, "pair");
   string direction = ExtractJsonValue(json, "direction");
   double sl       = StringToDouble(ExtractJsonValue(json, "sl"));
   double tp       = StringToDouble(ExtractJsonValue(json, "tp"));
   double lot      = StringToDouble(ExtractJsonValue(json, "lot"));

   Print("🚀 PROCESSANDO SINAL V4: " + pair + " " + direction);
   
   // Garantir sufixos
   if(!SymbolSelect(pair, true)) {
      for(int s=0; s<SymbolsTotal(false); s++) {
         string sym = SymbolName(s, false);
         if(StringFind(sym, pair) >= 0) { pair = sym; break; }
      }
   }
   SymbolSelect(pair, true);

   double ask = SymbolInfoDouble(pair, SYMBOL_ASK);
   double bid = SymbolInfoDouble(pair, SYMBOL_BID);
   double price = (direction == "BUY") ? ask : bid;
   int digits = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   price = NormalizeDouble(price, digits);

   // --- PASSO 1: ABRIR ORDEM LIMPA (INSTITUCIONAL V4) ---
   bool res = false;
   if(direction == "BUY")
      res = trade.Buy(lot, pair, price, 0, 0, "SMC Magic Step1");
   else if(direction == "SELL")
      res = trade.Sell(lot, pair, price, 0, 0, "SMC Magic Step1");
      
   if(res)
   {
      ulong ticket = trade.ResultOrder();
      Print("✅ ORDEM ABERTA! Ticket: ", ticket, ". Aguardando posição para aplicar proteção...");
      
      // --- PASSO 2: ESPERAR EXECUÇÃO E MODIFICAR ---
      for(int i=0; i<10; i++)
      {
         if(PositionSelect(pair))
         {
            ulong posTicket = PositionGetInteger(POSITION_TICKET);
            sl = NormalizeDouble(sl, digits);
            tp = NormalizeDouble(tp, digits);
            
            if(trade.PositionModify(posTicket, sl, tp)) {
               Print("🛡️ PROTEÇÃO V4 APLICADA COM SUCESSO!");
               SendPost(InpServerUrl + "/ea/report", "{\"signalId\":\"" + signalId + "\",\"status\":\"EXECUTED\",\"orderTicket\":\"" + (string)posTicket + "\"}");
               break;
            }
         }
         Sleep(200);
      }
   }
}

string SendPost(string url, string p) {
   uchar post[], res[]; string h = "Content-Type: application/json\r\n", rh;
   StringToCharArray(p, post);
   int code = WebRequest("POST", url, h, 5000, post, res, rh);
   if(code < 0) return "Error";
   return CharArrayToString(res);
}

string SendGet(string url) {
   uchar res[], d[]; string rh;
   int code = WebRequest("GET", url, "", 5000, d, res, rh);
   if(code < 0) return "Error";
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
   string res = StringSubstr(json, s, e - s);
   StringReplace(res, "\"", ""); StringReplace(res, " ", ""); StringReplace(res, "}", "");
   return res;
}