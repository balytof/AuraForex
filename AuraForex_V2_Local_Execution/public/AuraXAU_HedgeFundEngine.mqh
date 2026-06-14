//+------------------------------------------------------------------+
//| AURA XAU HEDGE FUND ENGINE V9                                    |
//| Speed, Adaptive Volatility & Market Regimes                      |
//+------------------------------------------------------------------+
#property strict

//======================== INPUTS ========================
input int    HF_ATR_Fast_Period = 14;
input int    HF_ATR_Slow_Period = 50;
input double HF_ATR_Spike_Multiplier = 1.3;
input double HF_Speed_Threshold_Points = 20.0; // 20 pontos por segundo para ativar "FAST"
input double HF_Wick_Distribution_Ratio = 0.6; // 60% de sombra = distribuição
input int    HF_SMCTimeframe = 5;              // Timeframe base SMC (M5)

//======================== ENUMS & STRUCTS ===============
enum ENUM_MARKET_REGIME {
   REGIME_LOW_VOLATILITY = 0,
   REGIME_EXPANSION = 1,
   REGIME_DISTRIBUTION = 2
};

struct TickDataInfo {
   double price;
   ulong  time_ms;
};

//======================== GLOBALS ========================
int g_ATR_Fast_Handle = INVALID_HANDLE;
int g_ATR_Slow_Handle = INVALID_HANDLE;

#define TICK_BUFFER_SIZE 50
TickDataInfo g_TickBuffer[TICK_BUFFER_SIZE];
int      g_TickIndex = 0;

ENUM_MARKET_REGIME g_CurrentRegime = REGIME_LOW_VOLATILITY;
double g_CurrentSpeed = 0;

//======================== INITS ==========================
void HF_Engine_Init()
{
   ENUM_TIMEFRAMES tf = PERIOD_M5;
   if(HF_SMCTimeframe == 1) tf = PERIOD_M1;
   else if(HF_SMCTimeframe == 15) tf = PERIOD_M15;
   
   if(g_ATR_Fast_Handle != INVALID_HANDLE) IndicatorRelease(g_ATR_Fast_Handle);
   if(g_ATR_Slow_Handle != INVALID_HANDLE) IndicatorRelease(g_ATR_Slow_Handle);
   
   g_ATR_Fast_Handle = iATR(_Symbol, tf, HF_ATR_Fast_Period);
   g_ATR_Slow_Handle = iATR(_Symbol, tf, HF_ATR_Slow_Period);
   
   ZeroMemory(g_TickBuffer);
   g_TickIndex = 0;
   
   Print("✅ [Hedge Fund Engine] Inicializado | Fast ATR: ", HF_ATR_Fast_Period, " | Slow ATR: ", HF_ATR_Slow_Period);
}

void HF_Engine_Deinit()
{
   if(g_ATR_Fast_Handle != INVALID_HANDLE) IndicatorRelease(g_ATR_Fast_Handle);
   if(g_ATR_Slow_Handle != INVALID_HANDLE) IndicatorRelease(g_ATR_Slow_Handle);
}

//======================== SPEED MONITOR ==================
void HF_UpdateSpeed(double currentPrice)
{
   ulong current_ms = GetTickCount64();
   
   g_TickBuffer[g_TickIndex].price = currentPrice;
   g_TickBuffer[g_TickIndex].time_ms = current_ms;
   
   // Achar o tick mais antigo no último segundo (1000 ms)
   double oldestPrice = currentPrice;
   ulong oldestTime = current_ms;
   
   for(int i=0; i<TICK_BUFFER_SIZE; i++)
   {
      if(g_TickBuffer[i].time_ms > 0 && (current_ms - g_TickBuffer[i].time_ms) <= 1000)
      {
         if(g_TickBuffer[i].time_ms < oldestTime)
         {
            oldestTime = g_TickBuffer[i].time_ms;
            oldestPrice = g_TickBuffer[i].price;
         }
      }
   }
   
   double point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(point == 0) return;
   
   g_CurrentSpeed = MathAbs(currentPrice - oldestPrice) / point; // Speed in points per second
   
   g_TickIndex++;
   if(g_TickIndex >= TICK_BUFFER_SIZE) g_TickIndex = 0;
}

//======================== REGIME MONITOR =================
double HF_GetWickRatio(int shift)
{
   ENUM_TIMEFRAMES tf = PERIOD_M5;
   if(HF_SMCTimeframe == 1) tf = PERIOD_M1;
   else if(HF_SMCTimeframe == 15) tf = PERIOD_M15;
   
   double high = iHigh(_Symbol, tf, shift);
   double low  = iLow(_Symbol, tf, shift);
   double open = iOpen(_Symbol, tf, shift);
   double close= iClose(_Symbol, tf, shift);
   
   double range = high - low;
   if(range == 0) return 0;
   
   double body = MathAbs(close - open);
   double wicks = range - body;
   
   return wicks / range;
}

void HF_UpdateRegime()
{
   double atrFast[1], atrSlow[1];
   if(CopyBuffer(g_ATR_Fast_Handle, 0, 0, 1, atrFast) <= 0) return;
   if(CopyBuffer(g_ATR_Slow_Handle, 0, 0, 1, atrSlow) <= 0) return;
   
   bool isExpansion = (atrFast[0] > atrSlow[0] * HF_ATR_Spike_Multiplier);
   double wickRatio = HF_GetWickRatio(1);
   
   if(wickRatio > HF_Wick_Distribution_Ratio)
   {
      g_CurrentRegime = REGIME_DISTRIBUTION;
   }
   else if(isExpansion)
   {
      g_CurrentRegime = REGIME_EXPANSION;
   }
   else
   {
      g_CurrentRegime = REGIME_LOW_VOLATILITY;
   }
}

//======================== SMC LOGIC ======================
bool HF_MarketStructureBull() { return (iHigh(_Symbol, PERIOD_M5, 1) > iHigh(_Symbol, PERIOD_M5, 2)); }
bool HF_MarketStructureBear() { return (iLow(_Symbol, PERIOD_M5, 1)  < iLow(_Symbol, PERIOD_M5, 2)); }

bool HF_LiquidityGrabBuy()    { return (iLow(_Symbol, PERIOD_M5, 1)  < iLow(_Symbol, PERIOD_M5, 2)); }
bool HF_LiquidityGrabSell()   { return (iHigh(_Symbol, PERIOD_M5, 1) > iHigh(_Symbol, PERIOD_M5, 2)); }

bool HF_DisplacementBull()
{
   double body = MathAbs(iClose(_Symbol, PERIOD_M5, 1) - iOpen(_Symbol, PERIOD_M5, 1));
   double atr[1]; CopyBuffer(g_ATR_Fast_Handle, 0, 0, 1, atr);
   return body > (atr[0] * 1.5) && iClose(_Symbol, PERIOD_M5, 1) > iOpen(_Symbol, PERIOD_M5, 1);
}

bool HF_DisplacementBear()
{
   double body = MathAbs(iClose(_Symbol, PERIOD_M5, 1) - iOpen(_Symbol, PERIOD_M5, 1));
   double atr[1]; CopyBuffer(g_ATR_Fast_Handle, 0, 0, 1, atr);
   return body > (atr[0] * 1.5) && iClose(_Symbol, PERIOD_M5, 1) < iOpen(_Symbol, PERIOD_M5, 1);
}

bool HF_BullishFVG() { return iLow(_Symbol, PERIOD_M5, 1) > iHigh(_Symbol, PERIOD_M5, 3); }
bool HF_BearishFVG() { return iHigh(_Symbol, PERIOD_M5, 1) < iLow(_Symbol, PERIOD_M5, 3); }

// Retorna 1 (Buy Signal), -1 (Sell Signal), 0 (Sem sinal)
int HF_DetectInstitutionalSignal()
{
   if(g_CurrentRegime == REGIME_LOW_VOLATILITY) return 0; // Não opera em consolidação
   
   bool buySignal = HF_MarketStructureBull() && HF_LiquidityGrabBuy() && HF_DisplacementBull() && HF_BullishFVG();
   bool sellSignal = HF_MarketStructureBear() && HF_LiquidityGrabSell() && HF_DisplacementBear() && HF_BearishFVG();
   
   // Se o mercado está FAST (velocidade alta), relaxamos ligeiramente as restrições para não perder o comboio
   if(g_CurrentSpeed > HF_Speed_Threshold_Points)
   {
      buySignal = HF_MarketStructureBull() && HF_DisplacementBull();
      sellSignal = HF_MarketStructureBear() && HF_DisplacementBear();
   }
   
   if(buySignal) return 1;
   if(sellSignal) return -1;
   return 0;
}
