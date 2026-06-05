const fs = require('fs');
const filePath = 'smc_bot_dashboard.html';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `        <div class="setup-step">
          <h3><div class="step-number">5</div> O Novo Painel Gráfico (GUI)</h3>
          <p style="font-size: 0.8rem; line-height: 1.5;">
            Assim que clicar OK, o <b>Painel de Controlo Escuro</b> será aberto no seu gráfico.<br>
            Cole a sua Licença e URL, guarde e inicie o robô!
          </p>
        </div>`;

const replacementStr = `        <div class="setup-step">
          <h3><div class="step-number">5</div> O Novo Painel Gráfico (GUI)</h3>
          <p style="font-size: 0.8rem; line-height: 1.5;">
            Assim que clicar OK, o <b>Painel de Controlo Escuro</b> será aberto no seu gráfico.<br>
            Cole a sua Licença e URL, guarde e inicie o robô!
          </p>
          <div style="margin-top: 10px; font-size: 0.75rem; color: var(--accent); background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
            <b>Chave de Licença Pessoal:</b> <br><span id="eaLicenseKey" style="user-select: all; font-family: monospace; display:block; margin-bottom: 5px;">A carregar...</span>
            <b>Link da API:</b> <br><span id="eaApiUrl" style="user-select: all; font-family: monospace; display:block;">A carregar...</span>
          </div>
        </div>`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully added the missing eaLicenseKey spans!");
} else {
    console.log("Could not find the target string for the 5th step!");
}
