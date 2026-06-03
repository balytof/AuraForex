const fs = require('fs');

let eaCode = fs.readFileSync('public/AuraForex_V8_INSTITUTIONAL.mq5', 'utf8');

// Replace all 'input ' followed by a type and 'Tester_' with just the type and 'Tester_'
// Example: 'input string Tester_LicenseKey' -> 'string Tester_LicenseKey'
// 'sinput bool Tester_...' -> 'bool Tester_...'

eaCode = eaCode.replace(/s?input\s+(string|bool|int|double|ENUM_[A-Z0-9_]+)\s+Tester_/g, '$1 Tester_');

fs.writeFileSync('public/AuraForex_V8_INSTITUTIONAL.mq5', eaCode);
console.log('✅ Removed "input" keyword from all Tester_ variables to hide them from MT5 dialog.');
