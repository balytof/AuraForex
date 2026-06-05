const fs = require('fs');
const filePath = 'smc_bot_dashboard.html';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr1 = `<div class="setup-step">
          <h3><div class="step-number">3</div> Ativar e Aplicar</h3>`;

const endTarget = `          </table>
        </div>`;

const startIndex = content.indexOf(targetStr1);
if (startIndex !== -1) {
    const endIndex = content.indexOf(endTarget, startIndex) + endTarget.length;
    
    const replacement = `<div class="setup-step">
          <h3><div class="step-number">3</div> Ativar o Bot no Gráfico</h3>
          <p style="font-size: 0.8rem; line-height: 1.5;">
            1. Certifique-se que o botão <b>"Algotrading"</b> no topo do MT5 está <b>VERDE</b>.<br>
            2. Abra um gráfico (ex: EURUSD H1) e arraste o <b>AuraForex_V8_INSTITUTIONAL</b> para dentro dele.<br>
            3. Na janela que surge, vá a "Comum" e marque <b>"Permitir Algo Trading"</b>. De seguida, clique OK.
          </p>
        </div>

        <div class="setup-step">
          <h3><div class="step-number">4</div> O Novo Painel Gráfico (GUI)</h3>
          <p style="font-size: 0.8rem; line-height: 1.5;">
            Assim que clicar OK, o <b>Painel de Controlo Escuro</b> será injetado diretamente no seu gráfico.<br><br>
            <b>1.</b> Cole a sua <b>Chave de Licença</b> e o <b>Link do Servidor API</b> no primeiro separador.<br>
            <b>2.</b> Ajuste os seus Limites e Risco nos separadores seguintes.<br>
            <b>3.</b> Por fim, clique no botão <b>INICIAR BOT</b> no próprio painel!
          </p>
          <div style="margin-top: 10px; font-size: 0.75rem; color: var(--accent); background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
            <b>Chave de Licença Pessoal:</b> <br><span id="eaLicenseKey" style="user-select: all; font-family: monospace; display:block; margin-bottom: 5px;">...</span>
            <b>Link da API:</b> <br><span id="eaApiUrl" style="user-select: all; font-family: monospace; display:block;">...</span>
          </div>
        </div>`;
    
    const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log("Successfully replaced the HTML.");
} else {
    console.log("Target string not found!");
}
