const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../server.js');
console.log('Reading:', filePath);
let content = fs.readFileSync(filePath, 'utf8');

const target = '          for (const { trade, reason } of toClose) {\n' +
  '            console.log(`\\x1b[41m\\x1b[37m[ALERTA] FECHANDO TICKET #${ticketId} | LUCRO: $${currentProfit.toFixed(2)} | RAZÃO: ${reason}\\x1b[0m`);\n' +
  '            const res = await broker.closePosition(ticketId);\n' +
  '            if (res.success) {\n' +
  '              risk.closeTrade(trade.id, 0, reason, currentProfit);\n' +
  '            }\n' +
  '          }\n' +
  '        }\n' +
  '        }\n' +
  '      } catch (e) {';

const replace = '          for (const { trade, reason } of toClose) {\n' +
  '            console.log(`\\x1b[41m\\x1b[37m[ALERTA] FECHANDO TICKET #${ticketId} | LUCRO: $${currentProfit.toFixed(2)} | RAZÃO: ${reason}\\x1b[0m`);\n' +
  '            const res = await broker.closePosition(ticketId);\n' +
  '            if (res.success) {\n' +
  '              risk.closeTrade(trade.id, 0, reason, currentProfit);\n' +
  '            }\n' +
  '          }\n' +
  '        }\n' +
  '      } catch (e) {';

const normContent = content.replace(/\r\n/g, '\n');
const normTarget = target.replace(/\r\n/g, '\n');

if (normContent.indexOf(normTarget) === -1) {
  console.error('❌ Could not find target in server.js');
  process.exit(1);
}

const parts = content.split(target);
if (parts.length === 2) {
  content = parts.join(replace);
} else {
  const normReplace = replace.replace(/\r\n/g, '\n');
  content = normContent.split(normTarget).join(normReplace);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done! Extra brace removed.');
