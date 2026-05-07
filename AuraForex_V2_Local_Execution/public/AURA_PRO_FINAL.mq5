//+------------------------------------------------------------------+
//|                                              AuraForex_V5_MASTER |
//|                                  Copyright 2026, AuraForex Corp  |
//|                                             https://auraforex.pt |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, AuraForex Corp"
#property link      "https://auraforex.pt"
#property version   "5.03"
#property strict

//--- INCLUDES ---
#include <Trade\Trade.mqh>

//--- INPUT PARAMETERS ---
input string   InpLicenseKey     = "COLE_SUA_LICENCA_AQUI"; // Chave de Licença (Dashboard)
input string   InpServerUrl      = "https://www.auratradebots.com/api"; // URL do seu VPS
input double   InpRiskPercent    = 1.0;                     // % de Risco por Trade
input int      InpMagicNumber    = 888222;                  // Magic Number das Ordens
input int      InpTimerSeconds   = 1;                       // Intervalo de Checagem (Segundos)
input int      InpMaxSLForex     = 700;                     // Limite SL Forex (Pontos)
input int      InpMaxSLJPY       = 2000;                    // Limite SL JPY/Ouro (Pontos)

//--- GLOBAL VARIABLES ---
CTrade         trade;
bool           IsAuthorized = false;
string         ProcessedIds[];
datetime       lastCheckTime = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("🚀 AURA V5 INSTITUCIONAL - INICIADO (DEBUG MODE)");
   trade.SetExpertMagicNumber(InpMagicNumber);
   ValidateLicense();
   EventSetTimer(InpTimerSeconds);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) { EventKillTimer(); }

void OnTick()
{
   // Verificar sinais em cada tick para máxima velocidade
   if(IsAuthorized) CheckSignals();
}

void OnTimer()
{
   if(!IsAuthorized) ValidateLicense();
   else CheckSignals();
}

// --- CORE FUNCTIONS ---

void ValidateLicense()
{
   string url = InpServerUrl + "/ea/validate";
   string payload = "{\"licenseKey\":\"" + InpLicenseKey + "\",\"mtAccount\":\"" + (string)AccountInfoInteger(ACCOUNT_LOGIN) + "\"}";
   
   Print("🔐 VALIDANDO LICENÇA...");
   string result = SendPost(url, payload);
   
   if(StringFind(result, "\"status\":\"OK\"") >= 0) {
      IsAuthorized = true;
      Print("✅ LICENÇA VALIDADA COM SUCESSO!");
      Comment("AURA V5 INSTITUCIONAL: ATIVO\nConta: " + (string)AccountInfoInteger(ACCOUNT_LOGIN));
   } else if(result != "") {
      Print("❌ RESPOSTA LICENÇA: " + result);
   }
}

void CheckSignals()
{
   // Evitar flood de logs, mas manter a verificação rápida
   if(TimeCurrent() - lastCheckTime < 1) return;
   lastCheckTime = TimeCurrent();

   string url = InpServerUrl + "/ea/signals?licenseKey=" + InpLicenseKey;
   string result = SendGet(url);
   
   // Log de silêncio (opcional, mas bom para debug agora)
   if(result == "") return; 
   if(StringFind(result, "\"signals\":[]") >= 0) return;

   Print("📩 SINAIS RECEBIDOS: " + result);

   int startPos = StringFind(result, "[");
   int endPos = StringFind(result, "]", startPos);
   if(startPos < 0 || endPos < 0) return;
   
   string signalsJson = StringSubstr(result, startPos+1, endPos-startPos-1);
   string objects[];
   int count = StringSplit(signalsJson, '}', objects);
   
   for(int i=0; i<count; i++) {
      string obj = objects[i];
      if(StringFind(obj, "{") < 0) obj = "{" + obj;
      if(StringFind(obj, "}") < 0) obj = obj + "}";
      
      string id = ExtractValue(obj, "id");
      if(id != "" && !IsProcessed(id)) { 
         Print("🎯 PROCESSANDO SINAL ID: " + id);
         ExecuteSignal(obj); 
         AddProcessed(id); 
      }
   }
}

void ExecuteSignal(string json)
{
   string pair = ExtractValue(json, "pair");
   string dir  = ExtractValue(json, "direction");
   
   if(!SymbolSelect(pair, true)) {
      for(int s=0; s<SymbolsTotal(false); s++) {
         string sym = SymbolName(s, false);
         if(StringFind(sym, pair) >= 0) { pair = sym; break; }
      }
   }
   if(!SymbolSelect(pair, true)) { Print("❌ Par não encontrado: " + pair); return; }

   int atrHandle = iATR(pair, PERIOD_H1, 14);
   double atrBuffer[];
   ArraySetAsSeries(atrBuffer, true);
   double atr = 0.0010;
   if(atrHandle != INVALID_HANDLE) {
      if(CopyBuffer(atrHandle, 0, 0, 1, atrBuffer) > 0) atr = atrBuffer[0];
      IndicatorRelease(atrHandle);
   }

   double volLimit = (StringFind(pair, "JPY") >= 0 || StringFind(pair, "XAU") >= 0) ? 1.5 : 0.0050;
   if(atr > volLimit) { Print("⚠️ Volatilidade alta em " + pair); return; }

   double tickSize = SymbolInfoDouble(pair, SYMBOL_TRADE_TICK_SIZE);
   int digits = (int)SymbolInfoInteger(pair, SYMBOL_DIGITS);
   double ask = SymbolInfoDouble(pair, SYMBOL_ASK);
   double bid = SymbolInfoDouble(pair, SYMBOL_BID);
   
   double sl = 0, tp = 0, currentPrice = (dir == "BUY") ? ask : bid;
   double maxSL = (double)((StringFind(pair, "JPY") >= 0 || StringFind(pair, "XAU") >= 0) ? InpMaxSLJPY : InpMaxSLForex);
   
   if(dir == "BUY") {
      double low = GetLastLow(pair, 20);
      sl = (low > 0) ? low - (atr * 0.5) : currentPrice - (atr * 3.0);
      double dist = (currentPrice - sl) / tickSize;
      if(dist > maxSL) { Print("⚠️ SL bloqueado (" + (string)dist + " pts)"); return; }
      double risk = GetDynamicRisk(dist);
      double lot = CalculateLot(pair, risk, currentPrice - sl, ORDER_TYPE_BUY);
      if(lot > 0) {
         if(trade.Buy(lot, pair, 0, 0, 0)) ApplyProtection(pair, sl, currentPrice + (atr * 6.0), digits, json);
      }
   } else {
      double high = GetLastHigh(pair, 20);
      sl = (high > 0) ? high + (atr * 0.5) : currentPrice + (atr * 3.0);
      double dist = (sl - currentPrice) / tickSize;
      if(dist > maxSL) { Print("⚠️ SL bloqueado (" + (string)dist + " pts)"); return; }
      double risk = GetDynamicRisk(dist);
      double lot = CalculateLot(pair, risk, sl - currentPrice, ORDER_TYPE_SELL);
      if(lot > 0) {
         if(trade.Sell(lot, pair, 0, 0, 0)) ApplyProtection(pair, sl, currentPrice - (atr * 6.0), digits, json);
      }
   }
}

void ApplyProtection(string pair, double sl, double tp, int digits, string json) {
   ulong ticket = 0;
   
   // ✅ Fix Hedge: procurar posição pelo Magic Number + par + mais recente
   for(int i=0; i<15; i++) {
      for(int j=PositionsTotal()-1; j>=0; j--) {
         if(PositionGetTicket(j) > 0 && 
            PositionGetString(POSITION_SYMBOL) == pair && 
            PositionGetInteger(POSITION_MAGIC) == InpMagicNumber) {
            ticket = PositionGetInteger(POSITION_TICKET);
            break;
         }
      }
      if(ticket > 0) break;
      Sleep(200);
   }
   
   if(ticket > 0) {
      // ✅ Verificar stop mínimo do broker
      double stopLevel = SymbolInfoInteger(pair, SYMBOL_TRADE_STOPS_LEVEL) * SymbolInfoDouble(pair, SYMBOL_POINT);
      double currentPrice = PositionGetDouble(POSITION_PRICE_CURRENT);
      
      // Ajustar SL/TP se muito perto do preço atual (evita erro 10014)
      if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) {
         if(currentPrice - sl < stopLevel) sl = currentPrice - stopLevel * 1.5;
         if(tp - currentPrice < stopLevel) tp = currentPrice + stopLevel * 1.5;
      } else {
         if(sl - currentPrice < stopLevel) sl = currentPrice + stopLevel * 1.5;
         if(currentPrice - tp < stopLevel) tp = currentPrice - stopLevel * 1.5;
      }
      
      if(trade.PositionModify(ticket, NormalizeDouble(sl, digits), NormalizeDouble(tp, digits))) {
         Print("🛡️ Proteção Aplicada Ticket: " + (string)ticket);
         SendPost(InpServerUrl + "/ea/report", "{\"signalId\":\"" + ExtractValue(json, "id") + "\",\"status\":\"EXECUTED\"}");
      } else {
         Print("⚠️ Falha ao aplicar SL/TP no ticket: " + (string)ticket + " | Erro: " + (string)GetLastError());
      }
   } else {
      Print("⚠️ Posição não encontrada para: " + pair);
   }
}

string SendPost(string url, string payload) {
   uchar post[], res[]; string headers = "Content-Type: application/json\r\n", rh;
   StringToCharArray(payload, post);
   if(WebRequest("POST", url, headers, 5000, post, res, rh) < 0) return "";
   return CharArrayToString(res);
}

string SendGet(string url) {
   uchar res[], data[]; string rh;
   if(WebRequest("GET", url, NULL, 5000, data, res, rh) < 0) return "";
   return CharArrayToString(res);
}

double GetDynamicRisk(double pts) {
   // Fix 1: Usar sempre o risco definido pelo utilizador
   return InpRiskPercent;
}

double CalculateLot(string sym, double riskPercent, double slDist, ENUM_ORDER_TYPE type) {
   double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskVal  = balance * (riskPercent / 100.0);
   double tVal     = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
   double tSize    = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
   if(slDist <= 0 || tSize <= 0 || tVal <= 0) return 0.01;
   
   double lot  = riskVal / ((slDist / tSize) * tVal);
   double minL = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   lot = MathMax(minL, MathFloor(lot / step) * step);
   
   double margin = 0;
   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
   double bid = SymbolInfoDouble(sym, SYMBOL_BID);
   double p = (type == ORDER_TYPE_BUY) ? ask : bid;

   if(OrderCalcMargin(type, sym, lot, p, margin)) {
      double freeMargin = AccountInfoDouble(ACCOUNT_FREEMARGIN);
      // ✅ Fix 2: Permite usar até 80% da margem livre
      if(margin > freeMargin * 0.80) {
         // Tentar com lote mínimo
         double minMargin = 0;
         if(OrderCalcMargin(type, sym, minL, p, minMargin)) {
            if(minMargin > freeMargin * 0.80) {
               Print("⚠️ Sem margem para " + sym + 
                     " | Necessário: " + DoubleToString(minMargin,2) + 
                     " | Livre: " + DoubleToString(freeMargin,2));
               return 0;
            }
            Print("ℹ️ Margem apertada. Usando lote mínimo (0.01) para " + sym);
            return minL; // usa lote mínimo
         }
      }
   }
   return NormalizeDouble(lot, 2);
}

double GetLastLow(string sym, int bars) {
   double lows[]; ArraySetAsSeries(lows, true);
   if(CopyLow(sym, _Period, 1, bars, lows) > 0) {
      double m = lows[0]; for(int i=1; i<ArraySize(lows); i++) if(lows[i] < m) m = lows[i]; return m;
   } return 0;
}

double GetLastHigh(string sym, int bars) {
   double highs[]; ArraySetAsSeries(highs, true);
   if(CopyHigh(sym, _Period, 1, bars, highs) > 0) {
      double m = highs[0]; for(int i=1; i<ArraySize(highs); i++) if(highs[i] > m) m = highs[i]; return m;
   } return 0;
}

bool IsProcessed(string id) {
   for(int i=0; i<ArraySize(ProcessedIds); i++) if(ProcessedIds[i] == id) return true; return false;
}

void AddProcessed(string id) {
   int s = ArraySize(ProcessedIds); ArrayResize(ProcessedIds, s+1); ProcessedIds[s] = id;
}

string ExtractValue(string json, string key) {
   string k = "\"" + key + "\":"; int p = StringFind(json, k); if(p < 0) return "";
   int s = p + StringLen(k); if(StringSubstr(json, s, 1) == "\"") s++;
   int e = StringFind(json, "\"", s); if(e < 0) e = StringFind(json, ",", s); if(e < 0) e = StringFind(json, "}", s);
   string r = StringSubstr(json, s, e - s); StringReplace(r, "\"", ""); StringReplace(r, " ", ""); return r;
}
