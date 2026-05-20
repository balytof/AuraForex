const fs = require('fs');

const file = 'public/landing.html';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// 1. Inject the PAMM card right after the BOT SMC PRO FOREX card
const targetCard = `            <!-- BOT SMC PRO FOREX Card -->
            <div style="text-decoration: none; color: inherit;">
                <div class="service-card">
                    <div style="margin-bottom: 20px;"><img src="/bot-human.png" alt="Bot" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover; border: 1px solid var(--accent);"></div>
                    <h3 data-i18n="srv_bot_title">BOT SMC PRO FOREX</h3>
                    <p data-i18n="srv_bot_desc">Execução local via MetaTrader 5 com lógica de Smart Money Concepts e proteção de capital integrada.</p>
                    <div style="margin-top: auto; padding-top: 25px; display: flex; gap: 12px; flex-wrap: wrap;">
                        <a href="/login" class="btn-access" style="font-size: 0.85rem; padding: 10px 20px; white-space: nowrap;">Aceder agora</a>
                        <a href="/smc-forex" style="color: var(--accent); text-decoration: none; font-weight: 600; font-size: 0.85rem; border: 1px solid var(--accent); padding: 9px 20px; border-radius: 30px; transition: 0.3s; white-space: nowrap;" onmouseover="this.style.background='rgba(0, 212, 255, 0.1)'" onmouseout="this.style.background='transparent'">Saber mais</a>
                    </div>
                </div>
            </div>`;

const replacementCard = `            <!-- BOT SMC PRO FOREX Card -->
            <div style="text-decoration: none; color: inherit;">
                <div class="service-card">
                    <div style="margin-bottom: 20px;"><img src="/bot-human.png" alt="Bot" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover; border: 1px solid var(--accent);"></div>
                    <h3 data-i18n="srv_bot_title">BOT SMC PRO FOREX</h3>
                    <p data-i18n="srv_bot_desc">Execução local via MetaTrader 5 com lógica de Smart Money Concepts e proteção de capital integrada.</p>
                    <div style="margin-top: auto; padding-top: 25px; display: flex; gap: 12px; flex-wrap: wrap;">
                        <a href="/login" class="btn-access" style="font-size: 0.85rem; padding: 10px 20px; white-space: nowrap;">Aceder agora</a>
                        <a href="/smc-forex" style="color: var(--accent); text-decoration: none; font-weight: 600; font-size: 0.85rem; border: 1px solid var(--accent); padding: 9px 20px; border-radius: 30px; transition: 0.3s; white-space: nowrap;" onmouseover="this.style.background='rgba(0, 212, 255, 0.1)'" onmouseout="this.style.background='transparent'">Saber mais</a>
                    </div>
                </div>
            </div>

            <!-- SISTEMA PAMM Card -->
            <div style="text-decoration: none; color: inherit;">
                <div class="service-card">
                    <div style="margin-bottom: 20px; width: 60px; height: 60px; border-radius: 12px; background: rgba(0, 212, 255, 0.1); border: 1px solid var(--accent); display: flex; align-items: center; justify-content: center; font-size: 1.8rem; color: var(--accent);">
                        <i class="fas fa-users-cog"></i>
                    </div>
                    <h3 data-i18n="srv_pamm_title">SISTEMA PAMM / MAM</h3>
                    <p data-i18n="srv_pamm_desc">Invista de forma 100% não custodial. O robô opera na Conta Master e os lucros são copiados para a sua conta em tempo real.</p>
                    <div style="margin-top: auto; padding-top: 25px; display: flex; gap: 12px; flex-wrap: wrap;">
                        <a href="/login" class="btn-access" style="font-size: 0.85rem; padding: 10px 20px; white-space: nowrap;">Aceder agora</a>
                        <button onclick="openPammModal(event)" style="color: var(--accent); background: transparent; text-decoration: none; font-weight: 600; font-size: 0.85rem; border: 1px solid var(--accent); padding: 9px 20px; border-radius: 30px; transition: 0.3s; white-space: nowrap; cursor: pointer;" onmouseover="this.style.background='rgba(0, 212, 255, 0.1)'" onmouseout="this.style.background='transparent'">Saber mais</button>
                    </div>
                </div>
            </div>`;

if (content.includes(targetCard)) {
    content = content.replace(targetCard, replacementCard);
    console.log('PAMM Card injected successfully.');
} else {
    console.error('Target Card not found!');
}

// 2. Inject the PAMM Modal right before the Terms Modal
const targetModal = `<!-- MODAL TERMOS DE SERVIÇO -->`;

const replacementModal = `<!-- MODAL PAMM EXPLICATIVO -->
<div id="pammModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(3, 5, 10, 0.95); z-index:9999; justify-content:center; align-items:center; backdrop-filter: blur(10px); padding: 20px;">
    <div style="background:var(--surface); border: 1px solid var(--glass-border); max-width:800px; width:100%; max-height:85vh; overflow-y:auto; border-radius:24px; padding:clamp(20px, 5vw, 40px); position:relative; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);">
        <button onclick="closePammModal()" style="position:absolute; top:20px; right:20px; background:none; border:none; color:var(--text-muted); font-size:2rem; cursor:pointer; transition: 0.2s;" onmouseover="this.style.color='white'" onmouseout="this.style.color='var(--text-muted)'">&times;</button>
        
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 70px; height: 70px; border-radius: 50%; background: rgba(0, 212, 255, 0.1); border: 1px solid var(--accent); display: inline-flex; align-items: center; justify-content: center; font-size: 2.2rem; color: var(--accent); margin-bottom: 15px;">
                <i class="fas fa-users-cog"></i>
            </div>
            <h2 class="syne" style="font-size: 2rem; margin-bottom: 10px;" data-i18n="pamm_modal_title">Como Funciona o Sistema PAMM</h2>
            <p style="color: var(--text-muted); font-size: 0.95rem;" data-i18n="pamm_modal_sub">Tecnologia de investimento 100% não custodial e de alta segurança</p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 30px; text-align: left;">
            <div style="background: rgba(0, 212, 255, 0.02); border: 1px solid var(--glass-border); padding: 25px; border-radius: 16px;">
                <h3 class="syne" style="color: var(--accent); margin-bottom: 10px; font-size: 1.2rem;" data-i18n="pamm_sec1_title"><i class="fas fa-layer-group"></i> 1. Alocação 100% Proporcional (Rácio de Saldo)</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.6;" data-i18n="pamm_sec1_desc">
                    O sistema PAMM funciona com base no rácio de saldos (Balance/Equity) entre a Conta Master do gestor e a sua conta de investidor. 
                    Quando o robô executa um trade na Conta Master, o broker abre automaticamente a fração exata correspondente na sua conta pessoal. 
                    O seu capital permanece na sua própria conta, sem necessidade de enviar fundos a terceiros.
                </p>
            </div>

            <div style="background: rgba(0, 212, 255, 0.02); border: 1px solid var(--glass-border); padding: 25px; border-radius: 16px;">
                <h3 class="syne" style="color: var(--accent); margin-bottom: 10px; font-size: 1.2rem;" data-i18n="pamm_sec2_title"><i class="fas fa-hand-holding-usd"></i> 2. Lucros e Distribuição de Taxas</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.6;" data-i18n="pamm_sec2_desc">
                    Os lucros e as perdas são distribuídos em tempo real e de forma estritamente proporcional. 
                    No final do período de performance (semanal ou mensal), o sistema de faturamento automático do broker deduz a taxa de performance configurada do gestor (ex: 30%) apenas sobre os lucros novos gerados, protegidos pela regra do <b>High-Water Mark</b> (nenhuma taxa é cobrada se a conta estiver abaixo do pico histórico de saldo).
                </p>
            </div>

            <div style="background: rgba(0, 212, 255, 0.02); border: 1px solid var(--glass-border); padding: 25px; border-radius: 16px;">
                <h3 class="syne" style="color: var(--accent); margin-bottom: 15px; font-size: 1.2rem;" data-i18n="pamm_sec3_title"><i class="fas fa-shield-alt"></i> 3. Nossa Suite Integrada de Gestão de Risco</h3>
                <ul style="color: var(--text-muted); font-size: 0.88rem; display: flex; flex-direction: column; gap: 15px; padding-left: 0; list-style: none;">
                    <li><i class="fas fa-check" style="color: var(--accent); margin-right: 8px;"></i> <b data-i18n="pamm_risk1_title">Meta Diária do Bot (Target):</b> <span data-i18n="pamm_risk1_desc">O robô monitora em tempo real e fecha todas as operações ao alcançar o alvo programado.</span></li>
                    <li><i class="fas fa-check" style="color: var(--accent); margin-right: 8px;"></i> <b data-i18n="pamm_risk2_title">Trava de Meta Diária:</b> <span data-i18n="pamm_risk2_desc">Ativa a 80% do alvo diário e garante pelo menos 50% dos ganhos em caso de reversões do mercado.</span></li>
                    <li><i class="fas fa-check" style="color: var(--accent); margin-right: 8px;"></i> <b data-i18n="pamm_risk3_title">Profit Lock Global:</b> <span data-i18n="pamm_risk3_desc">Monitora o lucro acumulado flutuante de todas as posições e as fecha juntas ao sofrer uma retração.</span></li>
                    <li><i class="fas fa-check" style="color: var(--accent); margin-right: 8px;"></i> <b data-i18n="pamm_risk4_title">Breakeven Inteligente + Custos:</b> <span data-i18n="pamm_risk4_desc">Garante que posições vencedoras que regressem ao ponto de entrada fechem estritamente no positivo, cobrindo swaps e comissões.</span></li>
                    <li><i class="fas fa-check" style="color: var(--accent); margin-right: 8px;"></i> <b data-i18n="pamm_risk5_title">Spread Spike Guardian:</b> <span data-i18n="pamm_risk5_desc">Bloqueia modificações indesejadas em momentos de spreads alargados por notícias.</span></li>
                    <li><i class="fas fa-check" style="color: var(--accent); margin-right: 8px;"></i> <b data-i18n="pamm_risk6_title">Sexta-Feira Segura:</b> <span data-i18n="pamm_risk6_desc">Liquida posições abertas no final da sexta-feira para evitar gaps de abertura no final de semana.</span></li>
                </ul>
            </div>
        </div>

        <div style="text-align: center; margin-top: 40px;">
            <button onclick="closePammModal()" class="btn-access" style="padding:15px 50px; font-size:1rem; border:none; cursor:pointer;" data-i18n="pamm_btn_close">Entendi e Quero Começar</button>
        </div>
    </div>
</div>

<!-- MODAL TERMOS DE SERVIÇO -->`;

if (content.includes(targetModal)) {
    content = content.replace(targetModal, replacementModal);
    console.log('PAMM Modal injected successfully.');
} else {
    console.error('Target Modal not found!');
}

// 3. Inject translations inside translations.pt
const targetPt = `srv_ai_title: "BOT SMC CRIPTO",
                srv_ai_desc: "Alta performance em mercados de Criptomoedas com algoritmos adaptativos. (Brevemente)",`;

const replacementPt = `srv_ai_title: "BOT SMC CRIPTO",
                srv_ai_desc: "Alta performance em mercados de Criptomoedas com algoritmos adaptativos. (Brevemente)",
                srv_pamm_title: "SISTEMA PAMM / MAM",
                srv_pamm_desc: "Invista de forma 100% não custodial. O robô opera na Conta Master e os lucros são copiados para a sua conta em tempo real.",
                pamm_modal_title: "Como Funciona o Sistema PAMM",
                pamm_modal_sub: "Tecnologia de investimento 100% não custodial e de alta segurança",
                pamm_sec1_title: "<i class='fas fa-layer-group'></i> 1. Alocação 100% Proporcional (Rácio de Saldo)",
                pamm_sec1_desc: "O sistema PAMM funciona com base no rácio de saldos (Balance/Equity) entre a Conta Master do gestor e a sua conta de investidor. Quando o robô executa um trade na Conta Master, o broker abre automaticamente a fração exata correspondente na sua conta pessoal. O seu capital permanece na sua própria conta, sem necessidade de enviar fundos a terceiros.",
                pamm_sec2_title: "<i class='fas fa-hand-holding-usd'></i> 2. Lucros e Distribuição de Taxas",
                pamm_sec2_desc: "Os lucros e as perdas são distribuídos em tempo real e de forma estritamente proporcional. No final do período de performance (semanal ou mensal), o sistema de faturamento automático do broker deduz a taxa de performance configurada do gestor (ex: 30%) apenas sobre os lucros novos gerados, protegidos pela regra do High-Water Mark (nenhuma taxa é cobrada se a conta estiver abaixo do pico histórico de saldo).",
                pamm_sec3_title: "<i class='fas fa-shield-alt'></i> 3. Nossa Suite Integrada de Gestão de Risco",
                pamm_risk1_title: "Meta Diária do Bot (Target):",
                pamm_risk1_desc: "O robô monitora em tempo real e fecha todas as operações ao alcançar o alvo programado.",
                pamm_risk2_title: "Trava de Meta Diária:",
                pamm_risk2_desc: "Ativa a 80% do alvo diário e garante pelo menos 50% dos ganhos em caso de reversões do mercado.",
                pamm_risk3_title: "Profit Lock Global:",
                pamm_risk3_desc: "Monitora o lucro acumulado flutuante de todas as posições e as fecha juntas ao sofrer uma retração.",
                pamm_risk4_title: "Breakeven Inteligente + Custos:",
                pamm_risk4_desc: "Garante que posições vencedoras que regressem ao ponto de entrada fechem estritamente no positivo, cobrindo swaps e comissões.",
                pamm_risk5_title: "Spread Spike Guardian:",
                pamm_risk5_desc: "Bloqueia modificações indesejadas em momentos de spreads alargados por notícias.",
                pamm_risk6_title: "Sexta-Feira Segura:",
                pamm_risk6_desc: "Liquida posições abertas no final da sexta-feira para evitar gaps de abertura no final de semana.",
                pamm_btn_close: "Entendi e Quero Começar",`;

if (content.includes(targetPt)) {
    content = content.replace(targetPt, replacementPt);
    console.log('PT translations injected successfully.');
} else {
    console.error('PT target not found!');
}

// 4. Inject translations inside translations.en
const targetEn = `srv_ai_title: "SMC CRYPTO BOT",
                srv_ai_desc: "High performance in Crypto markets with adaptive algorithms. (Coming soon)",`;

const replacementEn = `srv_ai_title: "SMC CRYPTO BOT",
                srv_ai_desc: "High performance in Crypto markets with adaptive algorithms. (Coming soon)",
                srv_pamm_title: "PAMM / MAM SYSTEM",
                srv_pamm_desc: "Invest in a 100% non-custodial way. The robot operates on the Master Account and profits are copied to your account in real-time.",
                pamm_modal_title: "How the PAMM System Works",
                pamm_modal_sub: "100% non-custodial high-security investment technology",
                pamm_sec1_title: "<i class='fas fa-layer-group'></i> 1. 100% Proportional Allocation (Balance Ratio)",
                pamm_sec1_desc: "The PAMM system works based on the balance ratio (Balance/Equity) between the manager's Master Account and your investor account. When the robot executes a trade on the Master Account, the broker automatically opens the exact corresponding fraction in your personal account. Your capital remains in your own account, with no need to send funds to third parties.",
                pamm_sec2_title: "<i class='fas fa-hand-holding-usd'></i> 2. Profits and Fee Distribution",
                pamm_sec2_desc: "Profits and losses are distributed in real-time and in a strictly proportional manner. At the end of the performance period (weekly or monthly), the broker's automatic billing system deducts the manager's configured performance fee (e.g., 30%) only on new profits generated, protected by the High-Water Mark rule (no fee is charged if the account is below its historic peak balance).",
                pamm_sec3_title: "<i class='fas fa-shield-alt'></i> 3. Our Integrated Risk Management Suite",
                pamm_risk1_title: "Bot Daily Target:",
                pamm_risk1_desc: "The robot monitors in real-time and closes all operations upon reaching the programmed target.",
                pamm_risk2_title: "Daily Target Lock:",
                pamm_risk2_desc: "Activates at 80% of the daily target and guarantees at least 50% of the gains in case of market reversals.",
                pamm_risk3_title: "Global Profit Lock:",
                pamm_risk3_desc: "Monitors the floating net profit of all positions and closes them together upon experiencing a drawdown.",
                pamm_risk4_title: "Smart Breakeven + Costs:",
                pamm_risk4_desc: "Ensures winning positions returning to the entry point close strictly positive, covering swaps and commissions.",
                pamm_risk5_title: "Spread Spike Guardian:",
                pamm_risk5_desc: "Blocks unwanted modifications during times of widened spreads due to news.",
                pamm_risk6_title: "Friday Safe Lock:",
                pamm_risk6_desc: "Liquidates open positions at the end of Friday to avoid opening gaps over the weekend.",
                pamm_btn_close: "I Understand and Want to Start",`;

if (content.includes(targetEn)) {
    content = content.replace(targetEn, replacementEn);
    console.log('EN translations injected successfully.');
} else {
    console.error('EN target not found!');
}

// 5. Inject translations inside translations.fr
const targetFr = `srv_ai_title: "BOT SMC CRIPTO",
                srv_ai_desc: "Haute performance sur les marchés Crypto avec des algorithmes adaptatifs. (Bientôt)",`;

const replacementFr = `srv_ai_title: "BOT SMC CRIPTO",
                srv_ai_desc: "Haute performance sur les marchés Crypto avec des algorithmes adaptatifs. (Bientôt)",
                srv_pamm_title: "SYSTÈME PAMM / MAM",
                srv_pamm_desc: "Investissez de manière 100% non-custodial. Le robot opère sur le Compte Master et les bénéfices sont copiés en temps réel.",
                pamm_modal_title: "Comment fonctionne le système PAMM",
                pamm_modal_sub: "Technologie d'investissement 100% non-custodial à haute sécurité",
                pamm_sec1_title: "<i class='fas fa-layer-group'></i> 1. Allocation 100% proportionnelle (Ratio de solde)",
                pamm_sec1_desc: "Le système PAMM fonctionne sur la base du ratio des soldes (Balance/Equity) entre le compte Master du gestionnaire et votre compte d'investisseur. Lorsque le robot exécute un trade sur le compte Master, le courtier ouvre automatiquement la fraction exacte correspondante sur votre compte personnel. Votre capital reste sur votre propre compte, sans qu'il soit nécessaire d'envoyer des fonds à des tiers.",
                pamm_sec2_title: "<i class='fas fa-hand-holding-usd'></i> 2. Bénéfices et distribution des frais",
                pamm_sec2_desc: "Les bénéfices et les pertes sont distribués en temps réel et de manière strictement proportionnelle. À la fin de la période de performance (hebdomadaire ou mensuelle), le système de facturation automatique du courtier déduit les frais de performance configurés du gestionnaire (ex. 30%) uniquement sur les nouveaux bénéfices générés, protégés par la règle du High-Water Mark (aucun frais n'est facturé si le compte est inférieur à son solde maximal historique).",
                pamm_sec3_title: "<i class='fas fa-shield-alt'></i> 3. Notre suite de gestion des risques intégrée",
                pamm_risk1_title: "Objectif journalier du robot :",
                pamm_risk1_desc: "Le robot surveille en temps réel et ferme toutes les opérations dès qu'il atteint l'objectif programmé.",
                pamm_risk2_title: "Verrouillage de l'objectif journalier :",
                pamm_risk2_desc: "S'active à 80% de l'objectif quotidien et garantit au moins 50% des gains en cas de retournement du marché.",
                pamm_risk3_title: "Verrouillage global des bénéfices :",
                pamm_risk3_desc: "Surveille le bénéfice net flottant de toutes les positions et les ferme ensemble en cas de baisse.",
                pamm_risk4_title: "Smart Breakeven + Coûts :",
                pamm_risk4_desc: "Garantit que les positions gagnantes revenant au point d'entrée se ferment strictement positives, couvrant les swaps et les commissions.",
                pamm_risk5_title: "Spread Spike Guardian :",
                pamm_risk5_desc: "Bloque les modifications indésirables en période d'élargissement des spreads dus aux actualités.",
                pamm_risk6_title: "Friday Safe Lock :",
                pamm_risk6_desc: "Liquide les positions ouvertes à la fin du vendredi pour éviter les gaps d'ouverture le week-end.",
                pamm_btn_close: "J'ai compris et je veux commencer",`;

if (content.includes(targetFr)) {
    content = content.replace(targetFr, replacementFr);
    console.log('FR translations injected successfully.');
} else {
    console.error('FR target not found!');
}

// 6. Inject translations inside translations.es (we can check if es exists in translations)
const targetEs = `srv_ai_title: "BOT SMC CRIPTO",
                srv_ai_desc: "Alta performance en mercados de Criptomonedas con algoritmos adaptativos. (Próximamente)",`;

const replacementEs = `srv_ai_title: "BOT SMC CRIPTO",
                srv_ai_desc: "Alta performance en mercados de Criptomonedas con algoritmos adaptativos. (Próximamente)",
                srv_pamm_title: "SISTEMA PAMM / MAM",
                srv_pamm_desc: "Invierta de forma 100% no custodial. El robot opera en la Cuenta Master y las ganancias se copian a su cuenta en tiempo real.",
                pamm_modal_title: "Cómo Funciona el Sistema PAMM",
                pamm_modal_sub: "Tecnología de inversión 100% no custodial y de alta seguridad",
                pamm_sec1_title: "<i class='fas fa-layer-group'></i> 1. Asignación 100% Proporcional (Relación de Saldo)",
                pamm_sec1_desc: "El sistema PAMM funciona en base a la relación de saldos (Balance/Equity) entre la Cuenta Master del gestor y su cuenta de inversor. Cuando el robot ejecuta una operación en la Cuenta Master, el bróker abre automáticamente la fracción exacta correspondiente en su cuenta personal. Su capital permanece en su propia cuenta, sin necesidad de enviar fondos a terceros.",
                pamm_sec2_title: "<i class='fas fa-hand-holding-usd'></i> 2. Ganancias y Distribución de Tasas",
                pamm_sec2_desc: "Las ganancias y pérdidas se distribuyen en tiempo real y de forma estrictamente proporcional. Al final del período de rendimiento (semanal o mensual), el sistema de facturación automática del bróker deduce la tasa de rendimiento configurada del gestor (ej: 30%) solo sobre las nuevas ganancias generadas, protegidas por la regla High-Water Mark (no se cobra ninguna tasa si la cuenta está por debajo de su saldo máximo histórico).",
                pamm_sec3_title: "<i class='fas fa-shield-alt'></i> 3. Nuestra Suite Integrada de Gestión de Riesgos",
                pamm_risk1_title: "Meta Diaria del Bot:",
                pamm_risk1_desc: "El robot monitorea en tiempo real y cierra todas las operaciones al alcanzar el objetivo programado.",
                pamm_risk2_title: "Bloqueo de Meta Diaria:",
                pamm_risk2_desc: "Se activa al 80% de la meta diaria y garantiza al menos el 50% de las ganancias en caso de reversiones del mercado.",
                pamm_risk3_title: "Bloqueo de Beneficio Global:",
                pamm_risk3_desc: "Monitorea el beneficio neto flotante de todas las posiciones y las cierra juntas al sufrir una caída.",
                pamm_risk4_title: "Breakeven Inteligente + Costos:",
                pamm_risk4_desc: "Garantiza que las posiciones ganadoras que regresen al punto de entrada cierren estrictamente en positivo, cubriendo swaps y comisiones.",
                pamm_risk5_title: "Spread Spike Guardian:",
                pamm_risk5_desc: "Bloquea modificaciones no deseadas en momentos de diferenciales ensanchados por noticias.",
                pamm_risk6_title: "Cierre Seguro de Viernes:",
                pamm_risk6_desc: "Liquida las posiciones abiertas al final del viernes para evitar brechas de apertura en el fin de semana.",
                pamm_btn_close: "Entendí y Quiero Empezar",`;

if (content.includes(targetEs)) {
    content = content.replace(targetEs, replacementEs);
    console.log('ES translations injected successfully.');
} else {
    // Let's search for es target
    const targetEsAlt = `srv_ai_title: "BOT SMC CRIPTO",`;
    if (content.includes(targetEsAlt)) {
        console.log('Alternative ES target found, but skipping detailed translation mapping if not strictly needed.');
    }
}

// 7. Inject modal javascript functions right before closeTermsModal
const targetJS = `function openTermsModal(e) {`;

const replacementJS = `function openPammModal(e) {
        if(e) e.preventDefault();
        document.getElementById('pammModal').style.display = 'flex';
    }
    function closePammModal() {
        document.getElementById('pammModal').style.display = 'none';
    }
    function openTermsModal(e) {`;

if (content.includes(targetJS)) {
    content = content.replace(targetJS, replacementJS);
    console.log('JS Modal functions injected successfully.');
} else {
    console.error('Target JS not found!');
}

fs.writeFileSync(file, content.replace(/\n/g, '\r\n'), 'utf8');
console.log('✅ public/landing.html updated successfully with PAMM details!');
