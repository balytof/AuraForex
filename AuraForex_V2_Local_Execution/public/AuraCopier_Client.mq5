//+------------------------------------------------------------------+
//|                                         AuraCopier_Client.mq5   |
//|                                      AuraTrade Copy Trading SaaS |
//+------------------------------------------------------------------+
#property copyright "AuraTrade"
#property link      "https://aura-forex.com"
#property version   "1.00"
#property description "Receptor de Sinais (Slave) para o AuraTrade Copy Trading SaaS"

#include <Trade\Trade.mqh>

//--- Inputs
input string   InpProviderToken = "AURA-PRV-123456"; // Token do Provedor de Sinal
input string   InpClientEmail   = "cliente@email.com"; // O seu Email da AuraTrade
input string   InpApiUrl        = "http://139.59.159.48:80"; // URL do Servidor
input double   InpRiskMultiplier= 1.0; // Multiplicador de Lotes

//--- Globais
CTrade trade;
string lastSignalId = "0";

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
    Print("AuraCopier_Client Iniciado. Email: ", InpClientEmail);
    trade.SetExpertMagicNumber(99999);
    EventSetTimer(2); // Poll signals every 2 seconds
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
    EventKillTimer();
    Print("AuraCopier_Client Parado.");
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer() {
    FetchSignals();
}

//+------------------------------------------------------------------+
//| Fetch Signals                                                    |
//+------------------------------------------------------------------+
void FetchSignals() {
    string url = StringFormat("%s/api/copytrade/signals?token=%s&lastId=%s&email=%s", InpApiUrl, InpProviderToken, lastSignalId, InpClientEmail);
    
    char post[], result[];
    string headers = "Accept: application/json\r\n";
    string result_headers;
    
    int res = WebRequest("GET", url, headers, 3000, post, result, result_headers);
    if(res == 200) {
        string json = CharArrayToString(result);
        ParseAndExecuteSignals(json);
    } else if (res == 402) {
        Print("ALERTA: O seu Gás acabou! Deposite mais Gás na sua conta AuraTrade.");
    }
}

//+------------------------------------------------------------------+
//| Simple JSON Parser & Executor                                    |
//+------------------------------------------------------------------+
void ParseAndExecuteSignals(string json) {
    // Expected format: [{"id":"abc","ticket":"123","symbol":"EURUSD","type":"BUY","lot":0.1,"price":1.1,"sl":1.0,"tp":1.2,"action":"OPEN"}]
    
    int searchPos = 0;
    while(true) {
        int objStart = StringFind(json, "{", searchPos);
        if(objStart < 0) break;
        int objEnd = StringFind(json, "}", objStart);
        if(objEnd < 0) break;
        
        string objStr = StringSubstr(json, objStart, objEnd - objStart + 1);
        searchPos = objEnd + 1;
        
        string id = ExtractString(objStr, "id");
        string ticket = ExtractString(objStr, "ticket");
        string symbol = ExtractString(objStr, "symbol");
        string type = ExtractString(objStr, "type");
        string action = ExtractString(objStr, "action");
        double lot = ExtractDouble(objStr, "lot");
        double price = ExtractDouble(objStr, "price");
        double sl = ExtractDouble(objStr, "sl");
        double tp = ExtractDouble(objStr, "tp");
        
        if(id != "") {
            lastSignalId = id; // Update cursor
            ExecuteSignal(action, ticket, symbol, type, lot, price, sl, tp);
        }
    }
}

//+------------------------------------------------------------------+
//| Execute                                                          |
//+------------------------------------------------------------------+
void ExecuteSignal(string action, string ticket, string symbol, string type, double lot, double price, double sl, double tp) {
    Print("Recebido Sinal: ", action, " ", type, " ", lot, " ", symbol, " TKT: ", ticket);
    
    double finalLot = NormalizeDouble(lot * InpRiskMultiplier, 2);
    if(finalLot < 0.01) finalLot = 0.01;
    
    if(action == "OPEN") {
        if(type == "BUY") trade.Buy(finalLot, symbol, 0, sl, tp, "Copy:" + ticket);
        else if(type == "SELL") trade.Sell(finalLot, symbol, 0, sl, tp, "Copy:" + ticket);
    }
    else if(action == "CLOSE") {
        // Find our local trade that matches the master ticket in the comment
        string matchComment = "Copy:" + ticket;
        for(int i = PositionsTotal() - 1; i >= 0; i--) {
            ulong posTicket = PositionGetTicket(i);
            if(PositionGetString(POSITION_COMMENT) == matchComment) {
                trade.PositionClose(posTicket);
            }
        }
    }
    else if(action == "MODIFY") {
        string matchComment = "Copy:" + ticket;
        for(int i = PositionsTotal() - 1; i >= 0; i--) {
            ulong posTicket = PositionGetTicket(i);
            if(PositionGetString(POSITION_COMMENT) == matchComment) {
                trade.PositionModify(posTicket, sl, tp);
            }
        }
    }
}

//+------------------------------------------------------------------+
//| OnTradeTransaction (to report profit)                            |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans, const MqlTradeRequest& request, const MqlTradeResult& result) {
    if(trans.type == TRADE_TRANSACTION_DEAL_ADD) {
        if(HistoryDealSelect(trans.deal)) {
            long deal_entry = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
            long magic = HistoryDealGetInteger(trans.deal, DEAL_MAGIC);
            
            if(deal_entry == DEAL_ENTRY_OUT && magic == 99999) {
                double profit = HistoryDealGetDouble(trans.deal, DEAL_PROFIT);
                if(profit > 0) {
                    ReportProfit(profit);
                }
            }
        }
    }
}

void ReportProfit(double profit) {
    string url = InpApiUrl + "/api/copytrade/profit";
    string json = StringFormat("{\"token\":\"%s\",\"email\":\"%s\",\"profit\":%f}", InpProviderToken, InpClientEmail, profit);
    char post[], res[];
    string res_headers;
    StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
    ArrayResize(post, ArraySize(post) - 1);
    WebRequest("POST", url, "Content-Type: application/json\r\n", 3000, post, res, res_headers);
}

//+------------------------------------------------------------------+
//| Simple JSON Extractors                                           |
//+------------------------------------------------------------------+
string ExtractString(string json, string key) {
    string search = "\"" + key + "\":\"";
    int start = StringFind(json, search);
    if(start < 0) return "";
    start += StringLen(search);
    int end = StringFind(json, "\"", start);
    if(end < 0) return "";
    return StringSubstr(json, start, end - start);
}

double ExtractDouble(string json, string key) {
    string search = "\"" + key + "\":";
    int start = StringFind(json, search);
    if(start < 0) return 0.0;
    start += StringLen(search);
    int end1 = StringFind(json, ",", start);
    int end2 = StringFind(json, "}", start);
    int end = (end1 > 0 && end1 < end2) ? end1 : end2;
    if(end < 0) return 0.0;
    string valStr = StringSubstr(json, start, end - start);
    return StringToDouble(valStr);
}
