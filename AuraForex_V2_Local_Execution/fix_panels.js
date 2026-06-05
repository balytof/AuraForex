const fs = require('fs');
const filePath = 'smc_bot_dashboard.html';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `    <div style="display:flex; flex-direction:column; gap:20px; flex-grow:1;">      <!-- LOG -->`;

if (content.includes(targetStr)) {
    const replacement = `    <div style="display:flex; flex-direction:column; gap:20px; flex-grow:1;">
      <!-- ACTIVE POSITIONS -->
      <div class="panel" id="activePositionsPanel" style="display:none; border: 1px solid var(--accent); background: rgba(0, 255, 170, 0.02);">
        <div class="panel-header" style="border-bottom: 1px solid rgba(0, 255, 170, 0.1);">
          <div class="panel-title"><span class="icon">🟢</span> Posições Ativas</div>
          <span id="activePositionsCount" style="font-size:0.75rem; color:var(--accent); font-family:'Space Mono',monospace; padding:2px 8px; background:rgba(0,255,170,0.1); border-radius:4px;">0</span>
        </div>
        <div id="activePositionsList" style="padding:15px; display:flex; flex-direction:column; gap:10px;">
          <!-- Cards injetados aqui via JS -->
        </div>
      </div>

      <!-- SIGNALS -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title"><span class="icon">🎯</span> Sinais & Execuções</div>
          <div style="display:flex;gap:10px;align-items:center;">
             <div class="nav-controls" id="signalNav" style="display:none; gap:6px;">
                <button class="btn-nav" onclick="prevSignal()">◀</button>
                <span id="signalIndex" style="font-size:0.65rem; font-family:'Space Mono',monospace; min-width:30px; text-align:center;">1/1</span>
                <button class="btn-nav" onclick="nextSignal()">▶</button>
             </div>
             <span style="font-size:0.72rem;color:var(--muted);font-family:'Space Mono',monospace;">Execução automática ativada</span>
          </div>
        </div>
        <div class="signals-list" id="signalsList">
          <div class="empty-state">
            <div class="em-icon">🔗</div>
            <p>Conecte uma corretora e inicie o bot<br>para receber sinais SMC com execução automática.</p>
          </div>
        </div>
      </div>

      <!-- LOG -->`;
    
    content = content.replace(targetStr, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully restored missing HTML panels.");
} else {
    console.log("Could not find the target string!");
}
