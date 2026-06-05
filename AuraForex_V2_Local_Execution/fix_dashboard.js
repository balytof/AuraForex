const fs = require('fs');
const filePath = 'smc_bot_dashboard.html';
let content = fs.readFileSync(filePath, 'utf8');

const targetStart = "  list.innerHTML = positions.map(pos => {";
const targetEnd = "  }).join(\"\");";

const startIndex = content.indexOf(targetStart);
const endIndex = content.indexOf(targetEnd, startIndex) + targetEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
    const replacement = `  list.innerHTML = positions.map(pos => {
    const pnlVal = pos.pnl || 0;
    const pnlClass = pnlVal >= 0 ? 'bull' : 'bear';
    const direction = (pos.type && pos.type.includes('BUY')) ? 'BUY' : 'SELL';
    const dirColor = direction === 'BUY' ? 'var(--bull)' : 'var(--bear)';

    const peak = maxProfitTrack[pos.id] || (pnlVal > 0 ? pnlVal : 0);
    const drop = peak - pnlVal;
    const dropPercentOfProfit = (peak > 2.0) ? (drop / peak) * 100 : 0;
    let dropTrigger = "--";
    if (peak > 5.0) {
        dropTrigger = \`-\${dropPercentOfProfit.toFixed(1)}% / 30%\`;
    }

    return \`
      <div class="signal-card" style="border-left: 4px solid \${dirColor}; margin-bottom: 15px; position: relative; background: rgba(255,255,255,0.02); padding: 15px; border-radius: 8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="signal-pair" style="font-size:1.1rem; font-weight:900;">\${pos.symbol || pos.pair}</div>
          <div style="font-family:'Space Mono',monospace; font-size:0.85rem; font-weight:700; color:var(--text); opacity: 0.6;">Lote: \${pos.lotSize || pos.lots}</div>
          <button onclick="closeTradeNow('\${pos.id}', '\${pos.symbol || pos.pair}')" style="
            background: rgba(255,68,68,0.2); color: var(--bear); border: 1px solid rgba(255,68,68,0.3);
            border-radius: 4px; padding: 4px 10px; font-size: 0.62rem; 
            font-weight: 800; cursor: pointer; transition: all 0.2s;
            text-transform: uppercase;
          " onmouseover="this.style.background='var(--bear)'; this.style.color='#fff';" onmouseout="this.style.background='rgba(255,68,68,0.2)'; this.style.color='var(--bear)';">
            <span data-i18n="close_trade">FECHAR</span>
          </button>
          <span class="signal-dir \${direction.toLowerCase()}" style="font-size: 0.7rem; padding: 2px 6px;">\${direction}</span>
        </div>
        
        <div class="signal-grid" style="margin-top: 15px;">
          <div class="sig-item"><span><span data-i18n="entry">ENTRADA</span></span><span>\${pos.openPrice ? pos.openPrice.toFixed(5) : '--'}</span></div>
          <div class="sig-item"><span>STOP LOSS</span><span style="color:var(--bear)">\${pos.sl ? pos.sl.toFixed(5) : '--'}</span></div>
          <div class="sig-item"><span>TAKE PROFIT</span><span style="color:var(--bull)">\${pos.tp ? pos.tp.toFixed(5) : '--'}</span></div>
        </div>
        
        <div class="score-bar" style="margin-top: 15px;"><div class="score-fill" style="width:100%; background: linear-gradient(90deg, var(--accent), var(--accent2));"></div></div>

        <div class="pnl-float-badge" style="
          margin-top: 15px;
          padding: 10px 14px;
          background: rgba(0,0,0,0.3);
          border-radius: 8px;
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 6px;
        ">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.75rem; color:var(--muted); font-weight:bold; letter-spacing:1px;" data-i18n="live_profit">LUCRO AO VIVO:</span>
            <span class="\${pnlClass}" style="font-weight:900; font-family:'Space Mono',monospace; font-size:1.1rem;">\${(pnlVal >= 0 ? "+" : "") + formatCurrency(pnlVal, brokerInfo.currency)}</span>
          </div>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top:8px;">
             <div style="display:flex; flex-direction:column;">
                <span style="font-size:0.6rem; color:var(--muted); text-transform:uppercase;" data-i18n="peak_reached">PICO ATINGIDO:</span>
                <span style="font-size:0.85rem; font-family:'Space Mono',monospace; color:var(--accent);">$ \${peak.toFixed(2)}</span>
             </div>
             <div style="display:flex; flex-direction:column; align-items:flex-end;">
                <span style="font-size:0.6rem; color:var(--muted); text-transform:uppercase;" data-i18n="lock_trigger">GATILHO LOCK:</span>
                <span style="font-size:0.85rem; font-family:'Space Mono',monospace; color:var(--warn);">\${dropTrigger}</span>
             </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px solid rgba(255,255,255,0.05); padding-top:8px;">
            <span style="font-size:0.65rem; color:var(--muted); text-transform:uppercase;" data-i18n="broker_levels">NÍVEIS BROKER:</span>
            <span style="font-size:0.7rem; font-family:'Space Mono',monospace;">
              SL: <span style="color:var(--bear)">\${pos.sl ? pos.sl.toFixed(5) : '--'}</span> | 
              TP: <span style="color:var(--bull)">\${pos.tp ? pos.tp.toFixed(5) : '--'}</span>
            </span>
          </div>
        </div>
      </div>
    \`;
  }).join("");`;

    const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log("Successfully replaced the HTML block.");
} else {
    console.log("Could not find the target block.");
}
