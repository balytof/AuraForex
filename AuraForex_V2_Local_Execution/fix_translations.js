const fs = require('fs');
let txt = fs.readFileSync('smc_bot_dashboard.html', 'utf8');

txt = txt.replace(
  'mainBtn.textContent = "Mercado Fechado (Fim de Semana)";',
  'if (mainBtn.dataset.state !== "weekend") { mainBtn.textContent = "Mercado Fechado (Fim de Semana)"; mainBtn.dataset.state = "weekend"; }'
);

txt = txt.replace(
  'mainBtn.textContent = "Meta Atingida";',
  'if (mainBtn.dataset.state !== "locked") { mainBtn.textContent = "Meta Atingida"; mainBtn.dataset.state = "locked"; }'
);

txt = txt.replace(
  'mainBtn.textContent = "Parar Bot";',
  'if (mainBtn.dataset.state !== "running") { mainBtn.textContent = "Parar Bot"; mainBtn.dataset.state = "running"; }'
);

txt = txt.replace(
  'mainBtn.textContent = "Iniciar Bot";',
  'if (mainBtn.dataset.state !== "stopped") { mainBtn.textContent = "Iniciar Bot"; mainBtn.dataset.state = "stopped"; }'
);

txt = txt.replace(
  'document.getElementById("weekendLockTimer").textContent = `Domingo às ${sundayHour}h00`;',
  'const wlt = document.getElementById("weekendLockTimer"); if (wlt.dataset.val !== String(sundayHour)) { wlt.textContent = `Domingo às ${sundayHour}h00`; wlt.dataset.val = String(sundayHour); }'
);

txt = txt.replace(
  'document.getElementById("countdown").textContent = `Retoma em: ${h}h ${m}m ${s}s`;',
  'const cd = document.getElementById("countdown"); const nStr = `Retoma em: ${h}h ${m}m ${s}s`; if (cd.dataset.val !== nStr) { cd.textContent = nStr; cd.dataset.val = nStr; }'
);

fs.writeFileSync('smc_bot_dashboard.html', txt, 'utf8');
console.log('Fixed continuous text overwriting.');
