const fs = require('fs');
let html = fs.readFileSync('smc_bot_dashboard.html', 'utf8');

html = html.replace(
    /if \(mainBtn\.dataset\.state !== "profitlocked"\) \{ mainBtn\.textContent = ".*?";/g,
    'if (mainBtn.dataset.state !== "profitlocked") { mainBtn.textContent = `Meta Atingida: $${(status.dailyPnl||0).toFixed(2)}`;'
);

html = html.replace(
    /lockOverlay\.style\.display = "flex";/g,
    `lockOverlay.style.display = "flex";
        const lockText = document.getElementById("dailyLockText");
        if(lockText) {
            lockText.innerHTML = \`O bot atingiu a meta de lucro definida.<br><br><span style="font-size: 1.5rem; color: var(--bull); font-weight: bold;">Lucro do Dia: $\${(status.dailyPnl||0).toFixed(2)}</span><br><br>As operações automáticas estão bloqueadas para proteger os seus ganhos de hoje.\`;
        }`
);

fs.writeFileSync('smc_bot_dashboard.html', html, 'utf8');
