const fs = require('fs');
const filePath = 'smc_bot_dashboard.html';
let content = fs.readFileSync(filePath, 'utf8');

const targetRegex = /<div class="setup-step">\s*<div class="setup-step">\s*<h3><div class="step-number">3<\/div> Autorizar WebRequest \(OBRIGATÓRIO\)<\/h3>/;
const fixedDiv = `<div class="setup-step">
          <h3><div class="step-number">2</div> Autorizar WebRequest (OBRIGATÓRIO)</h3>`;

if (targetRegex.test(content)) {
    content = content.replace(targetRegex, fixedDiv);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Regex Fix OK!");
} else {
    console.log("Regex Target Not Found!");
}
