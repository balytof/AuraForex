const fs = require('fs');

const target = `   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double profitPct = 0;
   
   if(DailyStartEquity > 0)
      profitPct = ((equity - DailyStartEquity) / DailyStartEquity) * 100.0;

   if(profitPct >= InpDailyTargetPct)
   {
      DailyTargetReached = true;
      Print("🏆 [DAILY] META ATINGIDA: ", DoubleToString(profitPct, 2), "% | Equity: $", DoubleToString(equity, 2), " | Fechando posições...");
      
      CloseAllPositions();
   }`.replace(/\r\n/g, '\n');

const replacement = `   // CÁLCULO PRECISO DO LUCRO DIÁRIO DO PRÓPRIO BOT (Closed + Open)
   double dailyPnL = GetDailyPnL();
   double targetProfit = DailyStartEquity * (InpDailyTargetPct / 100.0);

   if(dailyPnL >= targetProfit)
   {
      DailyTargetReached = true;
      Print("🏆 [DAILY] META ATINGIDA PELO BOT: $", DoubleToString(dailyPnL, 2), " >= Meta: $", DoubleToString(targetProfit, 2), " | Fechando posições...");
      
      CloseAllPositions();
   }`.replace(/\r\n/g, '\n');

const files = ['AuraForex_V8_INSTITUTIONAL.mq5', 'public/AuraForex_V8_INSTITUTIONAL.mq5'];

files.forEach(file => {
   const content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
   if (content.includes(target)) {
      const updated = content.replace(target, replacement);
      fs.writeFileSync(file, updated.replace(/\n/g, '\r\n'), 'utf8');
      console.log(`✅ Successfully replaced in: ${file}`);
   } else {
      console.error(`❌ Target NOT found in: ${file}`);
   }
});
