const fs = require('fs');
const filePath = 'smc_bot_dashboard.html';
let content = fs.readFileSync(filePath, 'utf8');

const targetRegex = /<div class="setup-step">\s*<h3><div class="step-number">3<\/div> Ativar e Aplicar<\/h3>[\s\S]*?<\/table>\s*<\/div>/;

const replacement = `<div class="setup-step">
          <h3><div class="step-number">4</div> Ativar o Bot no Gráfico</h3>
          <p style="font-size: 0.8rem; line-height: 1.5;">
            1. Certifique-se que o botão <b>"Algotrading"</b> no topo do MT5 está <b>VERDE</b>.<br>
            2. Abra um gráfico (ex: EURUSD H1) e arraste o <b>AuraForex_V8_INSTITUTIONAL</b> para dentro dele.<br>
            3. Na janela que surgir, vá a "Comum" e marque <b>"Permitir Algo Trading"</b>. De seguida, clique OK.
          </p>
        </div>

        <div class="setup-step">
          <h3><div class="step-number">5</div> O Novo Painel Gráfico (GUI)</h3>
          <p style="font-size: 0.8rem; line-height: 1.5;">
            Assim que clicar OK, o <b>Painel de Controlo Escuro</b> será aberto no seu gráfico.<br>
            Cole a sua Licença e URL, guarde e inicie o robô!
          </p>
        </div>`;

if (targetRegex.test(content)) {
    content = content.replace(targetRegex, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Regex Replacement OK!");
} else {
    console.log("Regex Target Not Found!");
}
