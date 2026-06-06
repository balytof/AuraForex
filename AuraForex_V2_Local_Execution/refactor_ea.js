const fs = require('fs');

let eaCode = fs.readFileSync('public/AuraForex_V8_INSTITUTIONAL.mq5', 'utf8');

// 1. Inserir a biblioteca AuraGUI no topo
if (!eaCode.includes('#include "AuraGUI.mqh"')) {
    eaCode = eaCode.replace('#include "JAson.mqh"', '#include "JAson.mqh"\n#include "AuraGUI.mqh"\n\nCAuraPanel *g_Panel;\n');
}

// 2. Renomear os inputs originais para Tester_ (para não dar conflito com g_)
const inputNames = [
    'LicenseKey', 'ServerUrl', 'IsCentAccount', 'RiskPercent', 'MagicNumber', 'TimerSeconds',
    'MaxSLForex', 'MaxSLJPY', 'MaxSLOuro', 'MaxOrders', 'MaxBuys', 'MaxSells', 'TradeCooldown',
    'ProfitLockMin', 'ProfitLockDrop', 'TrailingEnabled', 'TrailingStart_XAU', 'TrailingDistance_XAU', 'TrailingStep_XAU', 'TrailingStart_JPY', 'TrailingDistance_JPY', 'TrailingStep_JPY', 'TrailingStart_Forex', 'TrailingDistance_Forex', 'TrailingStep_Forex',
    'ManageManualOrders', 'DailyTargetPct', 'MaxDailyLossPct', 'DailyTargetLockActive', 'DailyTargetLockPct', 'DailyTargetFloorPct',
    'BreakevenEnabled', 'BreakevenTrigger', 'BreakevenSecure', 'FridaySafeLock', 'FridayHour', 'FridayMinute',
    'SpreadGuardianActive', 'MaxSpreadPips', 'SessionFilter'
];

inputNames.forEach(name => {
    // Regex para substituir apenas nas definições de input (ex: input string InpLicenseKey)
    const defRegex = new RegExp(`(input\\s+[a-zA-Z]+\\s+)Inp${name}`, 'g');
    eaCode = eaCode.replace(defRegex, `$1Tester_${name}`);
    
    // Regex para substituir todas as outras menções no código para g_Name
    const varRegex = new RegExp(`\\bInp${name}\\b`, 'g');
    eaCode = eaCode.replace(varRegex, `g_${name}`);
});

// 3. Adicionar inicialização no OnInit
if (!eaCode.includes('g_Panel = new CAuraPanel();')) {
    const onInitTarget = 'int OnInit()';
    const initCode = `
   // --- AURA GUI INIT ---
   g_Panel = new CAuraPanel();
   if(!g_Panel.Create(0, "AuraDashboard", 0, 10, 10, 420, 320)) {
       Print("Falha ao criar o painel Aura GUI.");
       return INIT_FAILED;
   }
   // Copiar valores do Tester para as globais caso o ficheiro txt não exista (Fallback)
   if(!FileIsExist("AuraForexConfig.txt", FILE_COMMON)) {
       g_LicenseKey = Tester_LicenseKey;
       g_ServerUrl = Tester_ServerUrl;
       g_IsCentAccount = Tester_IsCentAccount;
       g_RiskPercent = Tester_RiskPercent;
       g_MagicNumber = Tester_MagicNumber;
   }
   // ---------------------
`;
    // Find the opening brace of OnInit
    let idx = eaCode.indexOf(onInitTarget);
    if(idx !== -1) {
        let braceIdx = eaCode.indexOf('{', idx);
        eaCode = eaCode.slice(0, braceIdx + 1) + initCode + eaCode.slice(braceIdx + 1);
    }
}

// 4. Adicionar OnChartEvent
if (!eaCode.includes('void OnChartEvent(')) {
    const eventCode = `
//+------------------------------------------------------------------+
//| ChartEvent function                                              |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(g_Panel != NULL) g_Panel.OnEvent(id, lparam, dparam, sparam);
}
`;
    eaCode += eventCode;
}

// 5. Adicionar Destruição no OnDeinit
if (!eaCode.includes('delete g_Panel;')) {
    const onDeinitTarget = 'void OnDeinit(const int reason)';
    let idx = eaCode.indexOf(onDeinitTarget);
    if(idx !== -1) {
        let braceIdx = eaCode.indexOf('{', idx);
        eaCode = eaCode.slice(0, braceIdx + 1) + '\n   if(g_Panel != NULL) { g_Panel.Destroy(); delete g_Panel; }\n' + eaCode.slice(braceIdx + 1);
    }
}

fs.writeFileSync('public/AuraForex_V8_INSTITUTIONAL.mq5', eaCode);
console.log('✅ EA refatorado com sucesso para suportar Aura GUI.');
