//+------------------------------------------------------------------+
//|                                           AuraMaster_Signal.mq5 |
//|                                      AuraTrade Copy Trading SaaS |
//+------------------------------------------------------------------+
#property copyright "AuraTrade"
#property link      "https://aura-forex.com"
#property version   "1.00"
#property description "Emissor de Sinais (Master) para o AuraTrade Copy Trading SaaS"

//--- Inputs
input string   InpProviderToken = "AURA-PRV-123456"; // Token Secreto do Provedor
input string   InpApiUrl = "http://139.59.159.48:80"; // URL do Servidor AuraTrade
input bool     InpSendManualTrades = true; // Emitir também ordens manuais?

//--- Globais
string lastError = "";

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
    Print("AuraMaster_Signal Iniciado. Token: ", InpProviderToken);
    EventSetTimer(1); // Check connectivity
    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
    EventKillTimer();
    Print("AuraMaster_Signal Parado.");
}

//+------------------------------------------------------------------+
//| Trade Transaction                                                |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result) {
    
    // We only care about DEAL transactions to detect OPEN/CLOSE reliably
    if(trans.type == TRADE_TRANSACTION_DEAL_ADD) {
        if(HistoryDealSelect(trans.deal)) {
            long deal_entry = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
            long deal_type = HistoryDealGetInteger(trans.deal, DEAL_TYPE);
            string symbol = HistoryDealGetString(trans.deal, DEAL_SYMBOL);
            double volume = HistoryDealGetDouble(trans.deal, DEAL_VOLUME);
            double price = HistoryDealGetDouble(trans.deal, DEAL_PRICE);
            long position_id = HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
            long magic = HistoryDealGetInteger(trans.deal, DEAL_MAGIC);
            double profit = HistoryDealGetDouble(trans.deal, DEAL_PROFIT);
            
            if(!InpSendManualTrades && magic == 0) return; // Ignore manual trades if requested
            
            string side = (deal_type == DEAL_TYPE_BUY) ? "BUY" : "SELL";
            
            // Se for entrada (OPEN)
            if(deal_entry == DEAL_ENTRY_IN) {
                // Obter SL e TP da posição aberta
                double sl = 0, tp = 0;
                if(PositionSelectByTicket(position_id)) {
                    sl = PositionGetDouble(POSITION_SL);
                    tp = PositionGetDouble(POSITION_TP);
                }
                
                SendSignal("OPEN", position_id, symbol, side, volume, price, sl, tp, 0);
            }
            // Se for saída (CLOSE)
            else if(deal_entry == DEAL_ENTRY_OUT) {
                // Numa saída, o DEAL_TYPE é o inverso da ordem original.
                // Ex: Fechar um BUY gera um deal SELL. Então a ordem original era BUY.
                string orig_side = (deal_type == DEAL_TYPE_SELL) ? "BUY" : "SELL";
                SendSignal("CLOSE", position_id, symbol, orig_side, volume, price, 0, 0, profit);
            }
        }
    }
}

//+------------------------------------------------------------------+
//| Helper: Send Signal via HTTP POST                                |
//+------------------------------------------------------------------+
void SendSignal(string action, long ticket, string symbol, string type, double lot, double price, double sl, double tp, double profit) {
    string url = InpApiUrl + "/api/copytrade/signal";
    
    string json = StringFormat("{\"token\":\"%s\",\"ticket\":%d,\"symbol\":\"%s\",\"type\":\"%s\",\"lot\":%f,\"price\":%f,\"sl\":%f,\"tp\":%f,\"action\":\"%s\",\"profit\":%f}",
        InpProviderToken, ticket, symbol, type, lot, price, sl, tp, action, profit);
        
    char post[], result[];
    string headers = "Content-Type: application/json\r\n";
    StringToCharArray(json, post, 0, WHOLE_ARRAY, CP_UTF8);
    ArrayResize(post, ArraySize(post) - 1);
    
    string result_headers;
    int res = WebRequest("POST", url, headers, 3000, post, result, result_headers);
    
    if(res == 200) {
        Print("Sinal Enviado -> [", action, "] ", type, " ", lot, " ", symbol, " @ ", price);
    } else {
        string resp = CharArrayToString(result);
        Print("Erro ao Enviar Sinal: ", res, " -> ", resp);
    }
}
