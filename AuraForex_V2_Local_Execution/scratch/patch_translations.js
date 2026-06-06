const fs = require('fs');

let html = fs.readFileSync('../public/landing.html', 'utf8');

const replacements = [
    { old: '>NOVIDADE EXCLUSIVA<', new: ' data-i18n="cp_badge">NOVIDADE EXCLUSIVA<' },
    { old: '>COMO FUNCIONA?<', new: ' data-i18n="cp_how_title">COMO FUNCIONA?<' },
    { old: '>ABRA SUA CONTA<', new: ' data-i18n="cp_step1_title">ABRA SUA CONTA<' },
    { old: '>Crie sua conta gratuita na plataforma AuraTrade.<', new: ' data-i18n="cp_step1_desc">Crie sua conta gratuita na plataforma AuraTrade.<' },
    { old: '>REGISTRE-SE COMO PROVEDOR<', new: ' data-i18n="cp_step2_title">REGISTRE-SE COMO PROVEDOR<' },
    { old: '>Ative sua conta como provedor de sinais e configure seu perfil.<', new: ' data-i18n="cp_step2_desc">Ative sua conta como provedor de sinais e configure seu perfil.<' },
    { old: '>ADQUIRA O AURA MASTER<', new: ' data-i18n="cp_step3_title">ADQUIRA O AURA MASTER<' },
    { old: '>Conecte-se ao robô institucional e receba sinais.<', new: ' data-i18n="cp_step3_desc">Conecte-se ao robô institucional e receba sinais.<' },
    { old: '>COMPARTILHE SEU TOKEN<', new: ' data-i18n="cp_step4_title">COMPARTILHE SEU TOKEN<' },
    { old: '>Compartilhe seu token com copiadores e comece a ganhar!<', new: ' data-i18n="cp_step4_desc">Compartilhe seu token com copiadores e comece a ganhar!<' },
    { old: '>VANTAGENS DE SER UM PROVEDOR<', new: ' data-i18n="cp_adv_title">VANTAGENS DE SER UM PROVEDOR<' },
    { old: '>RENDA PASSIVA<', new: ' data-i18n="cp_adv2_title">RENDA PASSIVA<' },
    { old: '>Ganhe enquanto seus sinais trabalham por você.<', new: ' data-i18n="cp_adv2_desc">Ganhe enquanto seus sinais trabalham por você.<' },
    { old: '>CONSTRUA SUA COMUNIDADE<', new: ' data-i18n="cp_adv3_title">CONSTRUA SUA COMUNIDADE<' },
    { old: '>Tenha seus copiadores e expanda sua rede.<', new: ' data-i18n="cp_adv3_desc">Tenha seus copiadores e expanda sua rede.<' },
    { old: '>PAINEL DE DESEMPENHO<', new: ' data-i18n="cp_adv5_title">PAINEL DE DESEMPENHO<' },
    { old: '>SEJA PROVEDOR. LIDERE. GANHE.<', new: ' data-i18n="cp_btn_provider">SEJA PROVEDOR. LIDERE. GANHE.<' },
    { old: '30%', new: '<span data-i18n="cp_banner_pct">30%</span>' }
];

for (const rep of replacements) {
    html = html.replace(rep.old, rep.new);
    html = html.replace(rep.old.replace('Ê', 'S'), rep.new);
    html = html.replace(rep.old.replace('Á', '?'), rep.new);
    html = html.replace(rep.old.replace('É', '%'), rep.new);
    html = html.replace(rep.old.replace('É', '%').replace('É', '%'), rep.new);
    html = html.replace(rep.old.replace('Ã', 'ǟ'), rep.new);
}

// Regex replacements
html = html.replace(/AURATRADE <br><span class="highlight".*?>COPY TRADING<\/span>/, '<span data-i18n="cp_title_pt1">AURATRADE</span> <br><span class="highlight" style="color: var(--accent-purple); -webkit-text-fill-color: initial; background: none;" data-i18n="cp_title_pt2">COPY TRADING</span>');
html = html.replace(/>QUALQUER PESSOA PODE SE TORNAR UM PROVEDOR DE SINAIS E GANHAR <span.*?>COMISS.* AT.* 30%<\/span> SOBRE OS RESULTADOS!</, '><span data-i18n="cp_subtitle_pt1">QUALQUER PESSOA PODE SE TORNAR UM PROVEDOR DE SINAIS E GANHAR</span> <span style="color: #00e676;" data-i18n="cp_subtitle_pt2">COMISSÕES DE ATÉ 30%</span> <span data-i18n="cp_subtitle_pt3">SOBRE OS RESULTADOS!</span><');
html = html.replace(/>SEM EXPERI.*NCIA\? SEM PROBLEMA!</, ' data-i18n="cp_alert_title">SEM EXPERIÊNCIA? SEM PROBLEMA!<');
html = html.replace(/>AURA COPY.* PARA TODOS.</, ' data-i18n="cp_alert_desc">AURA COPY É PARA TODOS.<');
html = html.replace(/>GANHE AT.* 30% DE COMISS.*</, ' data-i18n="cp_adv1_title">GANHE ATÉ 30% DE COMISSÃO<');
html = html.replace(/>Receba comiss.*es sobre os lucros gerados pelos copiadores.</, ' data-i18n="cp_adv1_desc">Receba comissões sobre os lucros gerados pelos copiadores.<');
html = html.replace(/>SEGURO E AUTOM.*TICO</, ' data-i18n="cp_adv4_title">SEGURO E AUTOMÁTICO<');
html = html.replace(/>Execu.*o transparente e com total controle de risco.</, ' data-i18n="cp_adv4_desc">Execução transparente e com total controle de risco.<');
html = html.replace(/>Acompanhe ganhos e comiss.*es em tempo real.</, ' data-i18n="cp_adv5_desc">Acompanhe ganhos e comissões em tempo real.<');
html = html.replace(/>TRANSFORME SUA ESTRAT.*GIA EM UMA <span style="color: #00e676;">FONTE DE RENDA!<\/span></, ' data-i18n="cp_banner_title_pt1">TRANSFORME SUA ESTRATÉGIA EM UMA </span><span style="color: #00e676;" data-i18n="cp_banner_title_pt2">FONTE DE RENDA!</span><');
html = html.replace(/>Com AuraTrade Copy Trading, voc.* n.*o precisa operar por todos. Deixe que outros copiem seus sinais e ganhe com cada resultado positivo!</, ' data-i18n="cp_banner_desc">Com AuraTrade Copy Trading, você não precisa operar por todos. Deixe que outros copiem seus sinais e ganhe com cada resultado positivo!<');
html = html.replace(/>GANHE AT.*</, ' data-i18n="cp_banner_earn">GANHE ATÉ<');
html = html.replace(/>DE COMISS.*</, ' data-i18n="cp_banner_comm">DE COMISSÃO<');

const ptObj = `
                  cp_badge: "NOVIDADE EXCLUSIVA",
                  cp_title_pt1: "AURATRADE",
                  cp_title_pt2: "COPY TRADING",
                  cp_subtitle_pt1: "QUALQUER PESSOA PODE SE TORNAR UM PROVEDOR DE SINAIS E GANHAR",
                  cp_subtitle_pt2: "COMISSÕES DE ATÉ 30%",
                  cp_subtitle_pt3: "SOBRE OS RESULTADOS!",
                  cp_alert_title: "SEM EXPERIÊNCIA? SEM PROBLEMA!",
                  cp_alert_desc: "AURA COPY É PARA TODOS.",
                  cp_how_title: "COMO FUNCIONA?",
                  cp_step1_title: "ABRA SUA CONTA",
                  cp_step1_desc: "Crie sua conta gratuita na plataforma AuraTrade.",
                  cp_step2_title: "REGISTRE-SE COMO PROVEDOR",
                  cp_step2_desc: "Ative sua conta como provedor de sinais e configure seu perfil.",
                  cp_step3_title: "ADQUIRA O AURA MASTER",
                  cp_step3_desc: "Conecte-se ao robô institucional e receba sinais.",
                  cp_step4_title: "COMPARTILHE SEU TOKEN",
                  cp_step4_desc: "Compartilhe seu token com copiadores e comece a ganhar!",
                  cp_adv_title: "VANTAGENS DE SER UM PROVEDOR",
                  cp_adv1_title: "GANHE ATÉ 30% DE COMISSÃO",
                  cp_adv1_desc: "Receba comissões sobre os lucros gerados pelos copiadores.",
                  cp_adv2_title: "RENDA PASSIVA",
                  cp_adv2_desc: "Ganhe enquanto seus sinais trabalham por você.",
                  cp_adv3_title: "CONSTRUA SUA COMUNIDADE",
                  cp_adv3_desc: "Tenha seus copiadores e expanda sua rede.",
                  cp_adv4_title: "SEGURO E AUTOMÁTICO",
                  cp_adv4_desc: "Execução transparente e com total controle de risco.",
                  cp_adv5_title: "PAINEL DE DESEMPENHO",
                  cp_adv5_desc: "Acompanhe ganhos e comissões em tempo real.",
                  cp_banner_title_pt1: "TRANSFORME SUA ESTRATÉGIA EM UMA ",
                  cp_banner_title_pt2: "FONTE DE RENDA!",
                  cp_banner_desc: "Com AuraTrade Copy Trading, você não precisa operar por todos. Deixe que outros copiem seus sinais e ganhe com cada resultado positivo!",
                  cp_banner_earn: "GANHE ATÉ",
                  cp_banner_pct: "30%",
                  cp_banner_comm: "DE COMISSÃO",
                  cp_btn_provider: "SEJA PROVEDOR. LIDERE. GANHE.",
`;

const enObj = `
                  cp_badge: "EXCLUSIVE NEWS",
                  cp_title_pt1: "AURATRADE",
                  cp_title_pt2: "COPY TRADING",
                  cp_subtitle_pt1: "ANYONE CAN BECOME A SIGNAL PROVIDER AND EARN",
                  cp_subtitle_pt2: "UP TO 30% COMMISSION",
                  cp_subtitle_pt3: "ON RESULTS!",
                  cp_alert_title: "NO EXPERIENCE? NO PROBLEM!",
                  cp_alert_desc: "AURA COPY IS FOR EVERYONE.",
                  cp_how_title: "HOW IT WORKS?",
                  cp_step1_title: "OPEN YOUR ACCOUNT",
                  cp_step1_desc: "Create your free account on the AuraTrade platform.",
                  cp_step2_title: "REGISTER AS A PROVIDER",
                  cp_step2_desc: "Activate your signal provider account and set up your profile.",
                  cp_step3_title: "GET AURA MASTER",
                  cp_step3_desc: "Connect to the institutional bot and receive signals.",
                  cp_step4_title: "SHARE YOUR TOKEN",
                  cp_step4_desc: "Share your token with copiers and start earning!",
                  cp_adv_title: "ADVANTAGES OF BEING A PROVIDER",
                  cp_adv1_title: "EARN UP TO 30% COMMISSION",
                  cp_adv1_desc: "Receive commissions on the profits generated by copiers.",
                  cp_adv2_title: "PASSIVE INCOME",
                  cp_adv2_desc: "Earn while your signals work for you.",
                  cp_adv3_title: "BUILD YOUR COMMUNITY",
                  cp_adv3_desc: "Have your copiers and expand your network.",
                  cp_adv4_title: "SECURE AND AUTOMATIC",
                  cp_adv4_desc: "Transparent execution with full risk control.",
                  cp_adv5_title: "PERFORMANCE DASHBOARD",
                  cp_adv5_desc: "Track earnings and commissions in real-time.",
                  cp_banner_title_pt1: "TURN YOUR STRATEGY INTO A ",
                  cp_banner_title_pt2: "SOURCE OF INCOME!",
                  cp_banner_desc: "With AuraTrade Copy Trading, you don't need to trade for everyone. Let others copy your signals and earn with every positive result!",
                  cp_banner_earn: "EARN UP TO",
                  cp_banner_pct: "30%",
                  cp_banner_comm: "COMMISSION",
                  cp_btn_provider: "BE A PROVIDER. LEAD. EARN.",
`;

const esObj = `
                  cp_badge: "NOVEDAD EXCLUSIVA",
                  cp_title_pt1: "AURATRADE",
                  cp_title_pt2: "COPY TRADING",
                  cp_subtitle_pt1: "CUALQUIERA PUEDE CONVERTIRSE EN PROVEEDOR DE SEÑALES Y GANAR",
                  cp_subtitle_pt2: "¡COMISIONES DE HASTA 30%",
                  cp_subtitle_pt3: "SOBRE LOS RESULTADOS!",
                  cp_alert_title: "¿SIN EXPERIENCIA? ¡NO HAY PROBLEMA!",
                  cp_alert_desc: "AURA COPY ES PARA TODOS.",
                  cp_how_title: "¿CÓMO FUNCIONA?",
                  cp_step1_title: "ABRE TU CUENTA",
                  cp_step1_desc: "Crea tu cuenta gratuita en la plataforma AuraTrade.",
                  cp_step2_title: "REGÍSTRATE COMO PROVEEDOR",
                  cp_step2_desc: "Activa tu cuenta como proveedor de señales y configura tu perfil.",
                  cp_step3_title: "ADQUIERE AURA MASTER",
                  cp_step3_desc: "Conéctate al robot institucional y recibe señales.",
                  cp_step4_title: "COMPARTE TU TOKEN",
                  cp_step4_desc: "¡Comparte tu token con copiadores y empieza a ganar!",
                  cp_adv_title: "VENTAJAS DE SER UN PROVEEDOR",
                  cp_adv1_title: "GANA HASTA 30% DE COMISIÓN",
                  cp_adv1_desc: "Recibe comisiones sobre las ganancias generadas por los copiadores.",
                  cp_adv2_title: "INGRESOS PASIVOS",
                  cp_adv2_desc: "Gana mientras tus señales trabajan por ti.",
                  cp_adv3_title: "CONSTRUYE TU COMUNIDAD",
                  cp_adv3_desc: "Ten a tus copiadores y expande tu red.",
                  cp_adv4_title: "SEGURO Y AUTOMÁTICO",
                  cp_adv4_desc: "Ejecución transparente y con total control de riesgos.",
                  cp_adv5_title: "PANEL DE RENDIMIENTO",
                  cp_adv5_desc: "Sigue ganancias y comisiones en tiempo real.",
                  cp_banner_title_pt1: "¡CONVIERTE TU ESTRATEGIA EN UNA ",
                  cp_banner_title_pt2: "FUENTE DE INGRESOS!",
                  cp_banner_desc: "Con AuraTrade Copy Trading, no necesitas operar por todos. ¡Deja que otros copien tus señales y gana con cada resultado positivo!",
                  cp_banner_earn: "GANA HASTA",
                  cp_banner_pct: "30%",
                  cp_banner_comm: "DE COMISIÓN",
                  cp_btn_provider: "SÉ PROVEEDOR. LIDERA. GANA.",
`;

const frObj = `
                  cp_badge: "NOUVEAUTÉ EXCLUSIVE",
                  cp_title_pt1: "AURATRADE",
                  cp_title_pt2: "COPY TRADING",
                  cp_subtitle_pt1: "TOUT LE MONDE PEUT DEVENIR FOURNISSEUR DE SIGNAUX ET GAGNER",
                  cp_subtitle_pt2: "JUSQU'À 30% DE COMMISSIONS",
                  cp_subtitle_pt3: "SUR LES RÉSULTATS !",
                  cp_alert_title: "PAS D'EXPÉRIENCE ? PAS DE PROBLÈME !",
                  cp_alert_desc: "AURA COPY EST POUR TOUT LE MONDE.",
                  cp_how_title: "COMMENT ÇA MARCHE ?",
                  cp_step1_title: "OUVREZ VOTRE COMPTE",
                  cp_step1_desc: "Créez votre compte gratuit sur la plateforme AuraTrade.",
                  cp_step2_title: "INSCRIVEZ-VOUS COMME FOURNISSEUR",
                  cp_step2_desc: "Activez votre compte fournisseur de signaux et configurez votre profil.",
                  cp_step3_title: "OBTENEZ AURA MASTER",
                  cp_step3_desc: "Connectez-vous au robot institutionnel et recevez des signaux.",
                  cp_step4_title: "PARTAGEZ VOTRE JETON",
                  cp_step4_desc: "Partagez votre jeton avec des copieurs et commencez à gagner !",
                  cp_adv_title: "AVANTAGES D'ÊTRE FOURNISSEUR",
                  cp_adv1_title: "GAGNEZ JUSQU'À 30% DE COMMISSION",
                  cp_adv1_desc: "Recevez des commissions sur les bénéfices générés par les copieurs.",
                  cp_adv2_title: "REVENU PASSIF",
                  cp_adv2_desc: "Gagnez pendant que vos signaux travaillent pour vous.",
                  cp_adv3_title: "CONSTRUISEZ VOTRE COMMUNAUTÉ",
                  cp_adv3_desc: "Ayez vos copieurs et étendez votre réseau.",
                  cp_adv4_title: "SÉCURISÉ ET AUTOMATIQUE",
                  cp_adv4_desc: "Exécution transparente avec un contrôle total des risques.",
                  cp_adv5_title: "TABLEAU DE BORD DE PERFORMANCE",
                  cp_adv5_desc: "Suivez les gains et les commissions en temps réel.",
                  cp_banner_title_pt1: "TRANSFORMEZ VOTRE STRATÉGIE EN UNE ",
                  cp_banner_title_pt2: "SOURCE DE REVENUS !",
                  cp_banner_desc: "Avec AuraTrade Copy Trading, vous n'avez pas besoin de trader pour tout le monde. Laissez d'autres copier vos signaux et gagnez à chaque résultat positif !",
                  cp_banner_earn: "GAGNEZ JUSQU'À",
                  cp_banner_pct: "30%",
                  cp_banner_comm: "DE COMMISSION",
                  cp_btn_provider: "SOYEZ FOURNISSEUR. DIRIGEZ. GAGNEZ.",
`;

html = html.replace('pt: {', 'pt: {\\n' + ptObj);
html = html.replace('en: {', 'en: {\\n' + enObj);
html = html.replace('es: {', 'es: {\\n' + esObj);
html = html.replace('fr: {', 'fr: {\\n' + frObj);

fs.writeFileSync('../public/landing.html', html);
console.log("Translations injected into landing.html");
