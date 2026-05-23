const fs = require('fs');
let text = fs.readFileSync('smc_bot_dashboard.html', 'utf8');

// Use regex to strip emojis from HTML, but we need to be careful not to strip them from JS functions if we don't want to.
// The user said: "deixa apenas nos cards de notificaçoes" (leave only in notification cards).
// The notification cards use addLog().

// Let's manually replace the known UI strings.
const replacements = [
  ['⚠️ Atenção', 'Atenção'],
  ['🔑 Alterar Password', 'Alterar Password'],
  ['<div style="font-size: 2.5rem; margin-bottom: 10px;">🏆</div>', '<div style="font-size: 2.5rem; margin-bottom: 10px; display: none;"></div>'],
  ['<div style="font-size: 2.5rem; margin-bottom: 10px;">💤</div>', '<div style="font-size: 2.5rem; margin-bottom: 10px; display: none;"></div>'],
  ['<span class="icon">💼</span>', '<span class="icon"></span>'],
  ['<span class="icon">🎯</span>', '<span class="icon"></span>'],
  ['<div class="em-icon">📊</div>', '<div class="em-icon" style="display:none;"></div>'],
  ['<span class="icon">📋</span>', '<span class="icon"></span>'],
  ['<span class="icon">📜</span>', '<span class="icon"></span>'],
  ['<div class="ai-icon">🤖</div>', '<div class="ai-icon" style="display:none;"></div>'],
  ['<span class="icon">💳</span>', '<span class="icon"></span>'],
  ['<span class="icon">⚙️</span>', '<span class="icon"></span>'],
  ['💾 Guardar', 'Guardar'],
  ['✅ API Key guardada!', 'API Key guardada!'],
  ['<div style="font-size: 1.8rem;">🚨</div>', ''],
  ['<div style="font-size: 1.8rem;">⚠️</div>', ''],
  ['<span class="icon">📈</span>', '<span class="icon"></span>'],
  ['<div class="em-icon" style="font-size: 2.5rem; margin-bottom: 12px;">📊</div>', ''],
  ['<span class="icon">🔑</span>', '<span class="icon"></span>'],
  ['🔒 A sua senha é guardada', 'A sua senha é guardada'],
  ['✅ Guardado!', 'Guardado!'],
  ['🛡️ PAINEL ADMIN', 'PAINEL ADMIN'],
  ['👥 AFILIADOS', 'AFILIADOS'],
  ["btn.textContent = show ? '🙈' : '👁️';", "btn.textContent = show ? 'Ocultar' : 'Mostrar';"],
  ['>👁️<', '>Ver<'],
  ['✅ Password alterada', 'Password alterada'],
  ["❌ ' +", "' +"],
  ['🚫 Mercado Fechado', 'Mercado Fechado'],
  ['🔒 Meta Atingida', 'Meta Atingida'],
  ['❌ <b>CÓPIA SUSPENSA:</b>', '<b>CÓPIA SUSPENSA:</b>'],
  ['⚠️ <b>SALDO BAIXO:</b>', '<b>SALDO BAIXO:</b>'],
  ["<div class=\"em-icon\">${brokerConnected ? '🔍' : '🔗'}</div>", ""],
  ['<div class="broker-logo">💎</div>', ''],
  ['⚠️ ATENÇÃO:', 'ATENÇÃO:'],
  ['🧹 Limpar Infra', 'Limpar Infra'],
  ['<div class="em-icon" style="font-size: 2.5rem; margin-bottom: 12px;">🔑</div>', ''],
  ['🚀 Passo Inicial', 'Passo Inicial'],
  ['💎 Planos de Licença', 'Planos de Licença'],
  ['<div style="font-size:3rem;margin-bottom:15px;">🚀</div>', ''],
  ['💳 Adesão ao PAMM', 'Adesão ao PAMM']
];

for (const [search, replace] of replacements) {
  text = text.split(search).join(replace);
}

fs.writeFileSync('smc_bot_dashboard.html', text, 'utf8');
console.log('Dashboard Emojis stripped successfully!');
