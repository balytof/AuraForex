const fs = require('fs');

const files = ['AuraForex_V8_INSTITUTIONAL.mq5', 'public/AuraForex_V8_INSTITUTIONAL.mq5'];

files.forEach(file => {
   let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
   let modified = false;

   // 1. GetDailyPnL history select magic check
   const target1 = `            long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
            if(magic == GetAuraMagic())`;
   const replacement1 = `            long magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
            if(magic == GetAuraMagic() || (InpManageManualOrders && magic == 0))`;

   if (content.includes(target1)) {
      content = content.replace(target1, replacement1);
      modified = true;
      console.log(`[${file}] Target 1 replaced successfully.`);
   }

   // 2. GetDailyPnL floating positions magic check
   const target2 = `         if(PositionGetInteger(POSITION_MAGIC) == GetAuraMagic())
            floatingProfit += PositionGetDouble(POSITION_PROFIT);`;
   const replacement2 = `         long magic = PositionGetInteger(POSITION_MAGIC);
         if(magic == GetAuraMagic() || (InpManageManualOrders && magic == 0))
            floatingProfit += PositionGetDouble(POSITION_PROFIT);`;

   if (content.includes(target2)) {
      content = content.replace(target2, replacement2);
      modified = true;
      console.log(`[${file}] Target 2 replaced successfully.`);
   }

   // 3. CloseAllPositions magic check
   const target3 = `         if(PositionGetInteger(POSITION_MAGIC) != GetAuraMagic())
            continue;`;
   const replacement3 = `         long magic = PositionGetInteger(POSITION_MAGIC);
         if(magic != GetAuraMagic() && (!InpManageManualOrders || magic != 0))
            continue;`;

   if (content.includes(target3)) {
      content = content.replace(target3, replacement3);
      modified = true;
      console.log(`[${file}] Target 3 replaced successfully.`);
   }

   if (modified) {
      fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
      console.log(`✅ File saved: ${file}`);
   } else {
      console.warn(`❌ No replacements made in: ${file}`);
   }
});
