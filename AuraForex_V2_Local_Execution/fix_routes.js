const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const startMatch = code.indexOf('// ── COPY TRADING SAAS ROUTES');
const endStr = 'server.listen(PORT';

const endMatch = code.indexOf(endStr, startMatch);

if (startMatch !== -1 && endMatch !== -1) {
  let endOfBlock = code.lastIndexOf('// ──', endMatch); // go back to the separator
  const block = code.substring(startMatch, endOfBlock);
  
  // Remove block
  code = code.substring(0, startMatch) + code.substring(endOfBlock);
  
  // Find where to insert it (before 404 handler)
  const insertPoint = code.indexOf('let lastModTimes = {};');
  code = code.substring(0, insertPoint) + block + '\n\n' + code.substring(insertPoint);
  
  fs.writeFileSync('server.js', code);
  console.log('Moved successfully!');
} else {
  console.log('Could not find boundaries.', startMatch, endMatch);
}
