const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../smc_bot_dashboard.html');
console.log('Reading:', filePath);
let content = fs.readFileSync(filePath, 'utf8');

const target = '      if (currentUser.role === \'ADMIN\') {\n' +
  '        document.getElementById(\'adminLink\').style.display = \'flex\';\n' +
  '      }\n' +
  '      \n' +
  '      if (currentUser.isProvider) {\n' +
  '        document.getElementById(\'providerLink\').style.display = \'flex\';\n' +
  '      }\n' +
  '      \n' +
  '      userLicense = currentUser.license;';

const replace = '      if (currentUser.role === \'ADMIN\') {\n' +
  '        document.getElementById(\'adminLink\').style.display = \'flex\';\n' +
  '      }\n' +
  '      \n' +
  '      const hasActiveLicense = currentUser.license && currentUser.license.status === \'ACTIVE\';\n' +
  '      if (currentUser.isProvider || hasActiveLicense) {\n' +
  '        document.getElementById(\'providerLink\').style.display = \'flex\';\n' +
  '      }\n' +
  '      \n' +
  '      userLicense = currentUser.license;';

const normContent = content.replace(/\r\n/g, '\n');
const normTarget = target.replace(/\r\n/g, '\n');

if (normContent.indexOf(normTarget) === -1) {
  console.error('❌ Could not find target in smc_bot_dashboard.html');
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
console.log('Done! smc_bot_dashboard.html successfully patched.');
