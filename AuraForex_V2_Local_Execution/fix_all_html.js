const fs = require('fs');
const filePath = 'smc_bot_dashboard.html';
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: The unclosed div from line 5073
content = content.replace(
    /        <div class="setup-step">\r?\n\r?\n        <div class="setup-step">\r?\n          <h3><div class="step-number">3<\/div> Autorizar WebRequest \(OBRIGATÓRIO\)<\/h3>/,
    `        <div class="setup-step">
          <h3><div class="step-number">2</div> Autorizar WebRequest (OBRIGATÓRIO)</h3>`
);

// Fix 2: The step 4 and 5 replacement AND adding the missing eaLicenseKey spans
const oldSteps = `        <div class="setup-step">
          <h3><div class="step-number">3</div> Ativar e Aplicar</h3>
          <p style="font-size: 0.8rem; line-height: 1.5;">
            1. Certifique-se que o botão <b>"Algotrading"</b> no topo do MT5 está <b>VERDE</b>.<br>
            2. Abra um gráfico (ex: EURUSD H1) e arraste o <b>AuraForex_V8_INSTITUTIONAL</b> para dentro dele.<br>
            3. Na janela que surge, vá ao separador <b>"Inputs"</b>.
          </p>
        </div>

        <div class="setup-step">
          <h3><div class="step-number">4</div> Configurar os Inputs</h3>
          <table class="guide-table">
            <thead>
              <tr><th>Input</th><th>Valor</th><th>Descrição</th></tr>
            </thead>
            <tbody>
              <tr><td>LICENSE_KEY</td><td><b style="color:var(--accent)" id="eaLicenseKey">...</b></td><td>Sua chave pessoal</td></tr>
              <tr><td>API_URL</td><td id="eaApiUrl">...</td><td>Endereço do servidor</td></tr>
              <tr><td>RiskPercent</td><td>1.0</td><td>% do saldo por trade</td></tr>
              <tr><td>TP_RR</td><td>2.0</td><td>Take Profit = 2x o SL</td></tr>
            </tbody>
          </table>
        </div>`;

const newSteps = `        <div class="setup-step">
          <h3><div class="step-number">3</div> Ativar o Bot no Gráfico</h3>
          <p style="font-size: 0.8rem; line-height: 1.5;">
            1. Certifique-se que o botão <b>"Algotrading"</b> no topo do MT5 está <b>VERDE</b>.<br>
            2. Abra um gráfico (ex: EURUSD H1) e arraste o <b>AuraForex_V8_INSTITUTIONAL</b> para dentro dele.<br>
            3. Na janela que surgir, vá a "Comum" e marque <b>"Permitir Algo Trading"</b>. De seguida, clique OK.
          </p>
        </div>

        <div class="setup-step">
          <h3><div class="step-number">4</div> O Novo Painel Gráfico (GUI)</h3>
          <p style="font-size: 0.8rem; line-height: 1.5;">
            Assim que clicar OK, o <b>Painel de Controlo Escuro</b> será aberto no seu gráfico.<br>
            Cole a sua Licença e URL, guarde e inicie o robô!
          </p>
          <div style="margin-top: 10px; font-size: 0.75rem; color: var(--accent); background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
            <b>Chave de Licença Pessoal:</b> <br><span id="eaLicenseKey" style="user-select: all; font-family: monospace; display:block; margin-bottom: 5px;">A carregar...</span>
            <b>Link da API:</b> <br><span id="eaApiUrl" style="user-select: all; font-family: monospace; display:block;">A carregar...</span>
          </div>
        </div>`;

// Regex replacement for oldSteps to handle OS differences in newlines
const oldStepsRegex = /<div class="setup-step">\s*<h3><div class="step-number">3<\/div> Ativar e Aplicar<\/h3>[\s\S]*?<\/table>\s*<\/div>/;
content = content.replace(oldStepsRegex, newSteps);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Fix completed.");
