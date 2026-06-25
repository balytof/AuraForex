const fs = require('fs');
let code = fs.readFileSync('smc_bot_dashboard.html', 'utf8');

const target1 = `<button id="btnResetDaily" onclick="resetClientLocks()" style="display:none; margin: 0 auto; padding: 14px 24px; background: var(--accent); color: #000; border: none; border-radius: 8px; font-weight: 800; font-size:1rem; cursor: pointer; transition: transform 0.2s;">Redefinir Limites (Reset)</button>`;
const target2 = `<button id="btnResetLoss" onclick="resetClientLocks()" style="display:none; margin: 0 auto; padding: 14px 24px; background: var(--accent); color: #000; border: none; border-radius: 8px; font-weight: 800; font-size:1rem; cursor: pointer; transition: transform 0.2s;">Redefinir Limites (Reset)</button>`;

const rep1 = `<button id="btnResetDaily" onclick="resetClientLocks()" style="display:none; margin: 0 auto; padding: 14px 24px; background: transparent; color: var(--accent); border: 2px solid var(--accent); border-radius: 8px; font-weight: 800; font-size:1rem; cursor: pointer; transition: transform 0.2s;">Redefinir Limites (Reset)</button>`;
const rep2 = `<button id="btnResetLoss" onclick="resetClientLocks()" style="display:none; margin: 0 auto; padding: 14px 24px; background: transparent; color: var(--bear); border: 2px solid var(--bear); border-radius: 8px; font-weight: 800; font-size:1rem; cursor: pointer; transition: transform 0.2s;">Redefinir Limites (Reset)</button>`;

code = code.replace(target1, rep1);
code = code.replace(target2, rep2);

fs.writeFileSync('smc_bot_dashboard.html', code);
console.log("Success buttons");
