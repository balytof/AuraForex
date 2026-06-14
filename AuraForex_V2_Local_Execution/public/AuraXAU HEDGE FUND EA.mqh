//+------------------------------------------------------------------+
//| AURA TRADE V3 HEDGE FUND EA - XAUUSD                            |
//| Institutional Logic Model                                        |
//+------------------------------------------------------------------+
#property strict

#include <Trade/Trade.mqh>
CTrade trade;

//======================== INPUTS ========================
input double RiskPercent = 1.0;
input int ATRPeriod = 14;
input double ATR_Multiplier_Displacement = 1.8;
input int MagicNumber = 2026001;

//======================== GLOBALS ========================
double atrValue;
double lastHigh, lastLow;
double score;

//======================== UTIL ===========================
double GetATR()
{
   double atr[];
   int handle = iATR(_Symbol, PERIOD_M5, ATRPeriod);
   CopyBuffer(handle, 0, 0, 1, atr);
   return atr[0];
}

double CandleBody(int shift)
{
   return MathAbs(iClose(_Symbol, PERIOD_M5, shift) - iOpen(_Symbol, PERIOD_M5, shift));
}

double CandleRange(int shift)
{
   return (iHigh(_Symbol, PERIOD_M5, shift) - iLow(_Symbol, PERIOD_M5, shift));
}

//======================== MICROSTRUCTURE =================
bool MarketStructureBull()
{
   return (iHigh(_Symbol, PERIOD_M5, 1) > iHigh(_Symbol, PERIOD_M5, 2));
}

bool MarketStructureBear()
{
   return (iLow(_Symbol, PERIOD_M5, 1) < iLow(_Symbol, PERIOD_M5, 2));
}

//======================== LIQUIDITY ======================
bool LiquidityGrabBuy()
{
   double prevLow = iLow(_Symbol, PERIOD_M5, 2);
   double currLow = iLow(_Symbol, PERIOD_M5, 1);

   return (currLow < prevLow);
}

bool LiquidityGrabSell()
{
   double prevHigh = iHigh(_Symbol, PERIOD_M5, 2);
   double currHigh = iHigh(_Symbol, PERIOD_M5, 1);

   return (currHigh > prevHigh);
}

//======================== DISPLACEMENT ===================
bool DisplacementBull()
{
   return CandleBody(1) > GetATR() * ATR_Multiplier_Displacement &&
          iClose(_Symbol, PERIOD_M5, 1) > iOpen(_Symbol, PERIOD_M5, 1);
}

bool DisplacementBear()
{
   return CandleBody(1) > GetATR() * ATR_Multiplier_Displacement &&
          iClose(_Symbol, PERIOD_M5, 1) < iOpen(_Symbol, PERIOD_M5, 1);
}

//======================== FVG ============================
bool BullishFVG()
{
   return iLow(_Symbol, PERIOD_M5, 1) > iHigh(_Symbol, PERIOD_M5, 3);
}

bool BearishFVG()
{
   return iHigh(_Symbol, PERIOD_M5, 1) < iLow(_Symbol, PERIOD_M5, 3);
}

//======================== SCORE ENGINE ====================
double CalculateScore(bool isBuy)
{
   double s = 0;

   if(isBuy)
   {
      if(MarketStructureBull()) s += 25;
      if(LiquidityGrabBuy()) s += 25;
      if(DisplacementBull()) s += 20;
      if(BullishFVG()) s += 15;
      s += 15; // session placeholder
   }
   else
   {
      if(MarketStructureBear()) s += 25;
      if(LiquidityGrabSell()) s += 25;
      if(DisplacementBear()) s += 20;
      if(BearishFVG()) s += 15;
      s += 15;
   }

   return s;
}

//======================== RISK ===========================
double LotSize()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double risk = balance * (RiskPercent / 100.0);

   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double lot = risk / (100 * tickValue);

   return NormalizeDouble(lot, 2);
}

//======================== EXECUTION ======================
void OpenBuy()
{
   trade.SetExpertMagicNumber(MagicNumber);
   trade.Buy(LotSize(), _Symbol, 0, 0, 0, "AURA V3 BUY");
}

void OpenSell()
{
   trade.SetExpertMagicNumber(MagicNumber);
   trade.Sell(LotSize(), _Symbol, 0, 0, 0, "AURA V3 SELL");
}

//======================== MAIN LOOP ======================
void OnTick()
{
   atrValue = GetATR();

   bool buySignal =
      MarketStructureBull() &&
      LiquidityGrabBuy() &&
      DisplacementBull() &&
      BullishFVG();

   bool sellSignal =
      MarketStructureBear() &&
      LiquidityGrabSell() &&
      DisplacementBear() &&
      BearishFVG();

   double buyScore = CalculateScore(true);
   double sellScore = CalculateScore(false);

   //================ BUY =================
   if(buySignal && buyScore >= 85)
   {
      if(PositionsTotal() == 0)
         OpenBuy();
   }

   //================ SELL ================
   if(sellSignal && sellScore >= 85)
   {
      if(PositionsTotal() == 0)
         OpenSell();
   }
}