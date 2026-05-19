const fs = require('fs');
const content = fs.readFileSync('public/AuraForex_V8_INSTITUTIONAL.mq5', 'utf8').split('\n');

content.forEach((l, i) => {
   if (l.includes('HistoryDealGetInteger') || l.includes('PositionGetInteger(POSITION_MAGIC)') || l.includes('PositionClose')) {
      console.log(`${i+1}: [${l}]`);
   }
});
