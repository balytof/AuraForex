//+------------------------------------------------------------------+
//|                                  AuraForex_V4_MAGIC_OFFICIAL.mq5 |
//|                                  Copyright 2026, AuraForex Corp  |
//|                                             https://auraforex.pt |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AuraForex Corp"
#property link      "https://auraforex.pt"
#property version   "4.00"
#property strict

#include <Trade\Trade.mqh>

input string   InpLicenseKey     = "COLE_SUA_LICENCA_AQUI"; 
input string   InpServerUrl      = "https://www.auratradebots.com/api"; 
input double   InpRiskPercent    = 1.0;                     
input int      InpMagicNumber    = 888222;                  
input int      InpTimerSeconds   = 2;                       

CTrade         trade;
bool           IsAuthorized = false;
string         ExtProcessedIds[];

int OnInit() {
   Print("🚀 AURA PRO V4 MAGIC - OFICIAL INICIADO");
   trade.SetExpertMagicNumber(InpMagicNumber);
   ValidateLicense();
   EventSetTimer(InpTimerSeconds);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { EventKillTimer(); }
void OnTick() {}

void OnTimer() {
   if(!IsAuthorized) ValidateLicense();
   else CheckSignals();
}

void ValidateLicense() {
   string url = InpServerUrl + "/ea/validate";
   string payload = "{\"licenseKey\":\"" + InpLicenseKey + "\",\"mtAccount\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\"}";
   string res = SendPost(url, payload);
   if(StringFind(res, "\"status\":\"OK\"") >= 0) {
      IsAuthorized = true;
      Print("✅ AUTORIZADO PELO VPS V4");
   }
}

void CheckSignals() {
   string res = SendGet(InpServerUrl + "/ea/signals?licenseKey=" + InpLicenseKey);
   if(res == "Error" || StringFind(res, "\"signals\":[]") >= 0) return;

   int startPos = StringFind(res, "[");
   int endPos = StringFind(res, "]", startPos);
   if(startPos < 0 || endPos < 0) return;
   
   string signalsJson = StringSubstr(res, startPos+1, endPos-startPos-1);
   string objects[];
   int count = StringSplit(signalsJson, '}', objects);
   
   for(int i=0; i<count; i++) {
      string sigData = objects[i] + "}";
      string id = ExtractValue(sigData, "id");
      if(id == "") continue;

      bool alreadyDone = false;
      for(int j=0; j<ArraySize(ExtProcessedIds); j++) {
         if(ExtProcessedIds[j] == id) { alreadyDone = true; break; }
      }
      if(alreadyDone) continue;

      ExecuteSignal(sigData);
      
      int size = ArraySize(ExtProcessedIds);
      ArrayResize(ExtProcessedIds, size + 1);
      ExtProcessedIds[size] = id;
   }
}

void ExecuteSignal(string json) {
   string pair = ExtractValue(json, "pair");
   string dir  = ExtractValue(json, "direction");
   double sl   = StringToDouble(ExtractValue(json, "sl"));
   double tp   = StringToDouble(ExtractValue(json, "tp"));
   double lot  = StringToDouble(ExtractValue(json, "lot"));
   string id   = ExtractValue(json, "id");

   if(!SymbolSelect(pair, true)) {
      for(int s=0; s<SymbolsTotal(false); s++) {
         string sym = SymbolName(s, false);
         if(StringFind(sym, pair) >= 0) { pair = sym; break; }
      }
   }
   SymbolSelect(pair, true);

   double ask = SymbolInfoDouble(pair, SYMBOL_ASK);
   double bid = SymbolInfoDouble(pair, SYMBOL_BID);
   double price = (dir == "BUY") ? ask : bid;
   int digits = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   price = NormalizeDouble(price, digits);

   // --- PASSO 1: ENTRADA LIMPA ---
   bool res = (dir == "BUY") ? trade.Buy(lot, pair, price, 0, 0) : trade.Sell(lot, pair, price, 0, 0);

   if(res) {
      Print("✅ ORDEM ABERTA (V4). Aplicando proteção...");
      for(int i=0; i<10; i++) {
         if(PositionSelect(pair)) {
            ulong ticket = PositionGetInteger(POSITION_TICKET);
            if(trade.PositionModify(ticket, NormalizeDouble(sl, digits), NormalizeDouble(tp, digits))) {
               Print("🛡️ PROTEÇÃO V4 APLICADA!");
               SendPost(InpServerUrl + "/ea/report", "{\"signalId\":\"" + id + "\",\"status\":\"EXECUTED\"}");
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
   if(WebRequest("POST", url, h, 5000, post, res, rh) < 0) return "Error";
   return CharArrayToString(res);
}

string SendGet(string url) {
   uchar res[], d[]; string rh;
   if(WebRequest("GET", url, "", 5000, d, res, rh) < 0) return "Error";
   return CharArrayToString(res);
}

string ExtractValue(string json, string key) {
   string k = "\"" + key + "\":";
   int p = StringFind(json, k);
   if(p < 0) return "";
   int s = p + StringLen(k);
   if(StringSubstr(json, s, 1) == "\"") s++;
   int e = StringFind(json, "\"", s);
   if(e < 0) e = StringFind(json, ",", s);
   if(e < 0) e = StringFind(json, "}", s);
   string r = StringSubstr(json, s, e - s);
   StringReplace(r, "\"", ""); StringReplace(r, " ", ""); return r;
}
