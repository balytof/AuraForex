//+------------------------------------------------------------------+
//|                                              AURA_PRO_FINAL.mq5  |
//|                                  Copyright 2026, AuraForex Corp  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AuraForex Corp"
#property version   "3.00"
#property strict

#include <Trade\Trade.mqh>

input string   InpLicenseKey     = "COLE_SUA_LICENCA_AQUI"; 
input string   InpServerUrl      = "https://www.auratradebots.com/api"; 
input double   InpRiskPercent    = 1.0;                     
input int      InpMagicNumber    = 888222;                  

CTrade         trade;
bool           IsAuthorized = false;

int OnInit() {
   Print("🚀 AURA PRO FINAL v3.0 - INICIADO");
   trade.SetExpertMagicNumber(InpMagicNumber);
   EventSetTimer(2);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { EventKillTimer(); }
void OnTick() {}

void OnTimer() {
   if(!IsAuthorized) {
      string url = InpServerUrl + "/ea/validate";
      string payload = "{\"licenseKey\":\"" + InpLicenseKey + "\",\"mtAccount\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\"}";
      string res = SendPost(url, payload);
      if(StringFind(res, "\"status\":\"OK\"") >= 0) {
         IsAuthorized = true;
         Print("✅ AUTORIZADO PELO VPS");
      }
   } else {
      CheckSignals();
   }
}

void CheckSignals() {
   string res = SendGet(InpServerUrl + "/ea/signals?licenseKey=" + InpLicenseKey);
   
   if(res == "Error") {
      Print("❌ Erro de rede ao buscar sinais");
      return;
   }

   // Log temporário para ver o que o servidor diz
   if(StringFind(res, "\"signals\":[]") < 0) {
      Print("📡 Resposta do Servidor: " + res);
   }

   if(StringFind(res, "\"signals\":[]") >= 0) return;

   int startPos = StringFind(res, "[");
   int endPos = StringFind(res, "]", startPos);
   if(startPos < 0 || endPos < 0) return;
   
   string signalsJson = StringSubstr(res, startPos+1, endPos-startPos-1);
   string objects[];
   int count = StringSplit(signalsJson, '}', objects);
   
   for(int i=0; i<count; i++) {
      string sig = objects[i];
      if(StringFind(sig, "\"id\"") < 0) continue;
      if(StringSubstr(sig, 0, 1) == ",") sig = StringSubstr(sig, 1);
      sig = sig + "}";
      
      string pair = ExtractValue(sig, "pair");
      string dir  = ExtractValue(sig, "direction");
      double sl   = StringToDouble(ExtractValue(sig, "sl"));
      double tp   = StringToDouble(ExtractValue(sig, "tp"));
      double lot  = StringToDouble(ExtractValue(sig, "lot"));
      string id   = ExtractValue(sig, "id");
      
      if(pair == "" || dir == "") continue;

      // --- EXPERT FIX: SUFIXO DA CORRETORA ---
      if(!SymbolSelect(pair, true)) {
         // Tenta encontrar o símbolo correto (ex: EURUSD.m, EURUSD+)
         bool found = false;
         for(int s=0; s<SymbolsTotal(false); s++) {
            string sym = SymbolName(s, false);
            if(StringFind(sym, pair) >= 0) {
               pair = sym;
               found = true;
               break;
            }
         }
         if(!found) {
            Print("❌ Símbolo não encontrado: " + pair);
            continue;
         }
      }

      double ask = SymbolInfoDouble(pair, SYMBOL_ASK);
      double bid = SymbolInfoDouble(pair, SYMBOL_BID);
      double price = (dir == "BUY") ? ask : bid;
      
      if(price <= 0) {
         Print("⚠️ Preço inválido para " + pair + ". Verifique se o par está ativo.");
         continue;
      }

      // Se o SL for absurdo (negativo ou longe demais), recalcula 300 pips
      double point = SymbolInfoDouble(pair, SYMBOL_POINT);
      if(sl <= 0 || MathAbs(price - sl) > (price * 0.1)) {
         Print("⚠️ SL Inválido (" + (string)sl + "). Corrigindo para 300 pips.");
         sl = (dir == "BUY") ? price - (300 * point) : price + (300 * point);
         tp = (dir == "BUY") ? price + (450 * point) : price - (450 * point);
      }

      int digits = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
      sl = NormalizeDouble(sl, digits);
      tp = NormalizeDouble(tp, digits);
      price = NormalizeDouble(price, digits);

      Print("📥 EXECUTANDO " + pair + " " + dir + " SL:" + (string)sl);
      if((dir == "BUY" && trade.Buy(lot, pair, price, sl, tp)) || (dir == "SELL" && trade.Sell(lot, pair, price, sl, tp))) {
         SendPost(InpServerUrl + "/ea/report", "{\"signalId\":\"" + id + "\",\"status\":\"EXECUTED\"}");
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
   
   // Pular espaços em branco e aspas iniciais
   while(s < StringLen(json) && (StringSubstr(json, s, 1) == " " || StringSubstr(json, s, 1) == "\"")) s++;
   
   int e = StringFind(json, "\"", s); // Tenta achar aspas de fechamento (se for string)
   if(e < 0) e = StringFind(json, ",", s); // Se não, tenta achar vírgula
   if(e < 0) e = StringFind(json, "}", s); // Se não, tenta achar fecha chave
   
   if(e < 0 || e <= s) return "";
   
   string res = StringSubstr(json, s, e - s);
   
   // Limpeza final de caracteres residuais (sem usar retorno de StringReplace)
   StringReplace(res, "\"", "");
   StringReplace(res, " ", "");
   StringReplace(res, "}", "");
   StringReplace(res, "]", "");
   
   return res;
}
